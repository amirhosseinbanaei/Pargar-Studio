// src/common/lib/images/sniff.ts
/**
 * What a file ACTUALLY is, read from its own leading bytes — and how big it says it is.
 *
 * ─── WHY THE HEADER AND NOT THE `Content-Type` ────────────────────────────────────
 * The `Content-Type` header and the filename extension are both supplied by the caller and
 * prove nothing whatsoever. `mv notes.txt photo.jpg` is the entire attack, and a browser
 * will happily label it `image/jpeg` from the extension alone. Every format below starts
 * with a fixed signature that the encoder wrote, so the first few dozen bytes are the one
 * statement about a file that its sender did not compose.
 *
 * ─── AND WHY THE DIMENSIONS ARE READ HERE TOO ─────────────────────────────────────
 * Not decoded — READ, out of the header the format already carries. That is what makes the
 * decompression-bomb check cheap enough to run before anything is stored: a file declaring
 * 60000 × 60000 pixels is refused after parsing a few dozen bytes rather than after asking
 * the image optimizer for fourteen gigabytes of bitmap. The same numbers are what
 * `/api/uploads` reports back to the uploader.
 *
 * ─── PURE, AND THEREFORE TESTABLE ─────────────────────────────────────────────────
 * One function of a `Uint8Array`. No filesystem, no `Buffer`-only APIs, no `server-only`,
 * no dependency — AGENTS.md bans adding one for something the platform already does, and
 * the platform does this in about a hundred lines. `__tests__/sniff.test.ts` feeds it real
 * signatures and the renamed-text-file case that motivates it.
 *
 * A format is UNRECOGNIZED unless its signature matches AND its dimensions parse. That is
 * deliberate: a truncated or malformed header means this module cannot make the size claim
 * the cap depends on, and "I could not tell" must fail closed, not fall through to "fine".
 */
import { ACCEPTED_IMAGE_TYPES, type AcceptedImageType } from '@/common/constants/uploads';

/** What a recognized file is, and how big it says it is. */
export interface SniffedImage {
  type: AcceptedImageType;
  /** The stored filename's extension, from the SNIFFED type — never from the client. */
  extension: string;
  width: number;
  height: number;
}

/**
 * The most bytes any parser below needs before it can answer.
 *
 * JPEG is the reason it is not smaller: its dimensions live in a `SOFn` marker that sits
 * after however many comment, EXIF and quantization segments the encoder emitted, and a
 * phone photograph routinely carries a 30–60 KB EXIF block with an embedded thumbnail. A
 * caller that streams only the first kilobyte will sniff the signature correctly and then
 * fail to find the size, which — per the header — is a refusal.
 */
export const SNIFF_BYTES = 128 * 1024;

/* ── little helpers over a byte array ──────────────────────────────────────────── */

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32be = (b: Uint8Array, i: number) =>
  ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);

/** ASCII compare at an offset, bounds-checked. */
function ascii(bytes: Uint8Array, offset: number, text: string): boolean {
  if (offset + text.length > bytes.length) return false;
  for (let i = 0; i < text.length; i += 1) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, i) => bytes[i] === byte);
}

type Size = { width: number; height: number } | null;

/* ── per-format dimension readers ──────────────────────────────────────────────── */

/** PNG: `IHDR` is mandated to be the first chunk, so the size is always at a fixed offset. */
function pngSize(b: Uint8Array): Size {
  if (b.length < 24 || !ascii(b, 12, 'IHDR')) return null;
  return { width: u32be(b, 16), height: u32be(b, 20) };
}

/** GIF: a fixed-layout logical screen descriptor, little-endian, right after the header. */
function gifSize(b: Uint8Array): Size {
  if (b.length < 10) return null;
  return { width: u16le(b, 6), height: u16le(b, 8) };
}

/**
 * JPEG: walk the marker segments until a start-of-frame.
 *
 * Every segment is `FF <marker> <2-byte length>`, so the walk is exact rather than a scan
 * for a byte pattern — scanning finds `FFC0` inside compressed image data and reports the
 * dimensions of nothing. The `SOFn` family excludes `C4` (Huffman tables), `C8` (reserved)
 * and `CC` (arithmetic tables), which share the range but are not frames.
 */
function jpegSize(b: Uint8Array): Size {
  let i = 2; // past SOI
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null; // not on a marker boundary: give up rather than guess
    const marker = b[i + 1];
    // Standalone markers carry no length payload.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const length = u16be(b, i + 2);
    if (length < 2) return null;
    const isFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) {
      // SOFn payload: precision(1) height(2) width(2)
      if (i + 9 >= b.length) return null;
      return { width: u16be(b, i + 7), height: u16be(b, i + 5) };
    }
    i += 2 + length;
  }
  return null;
}

/**
 * WebP: three container flavours, and all three have to be handled.
 *
 * `VP8 ` is lossy, `VP8L` lossless, `VP8X` extended (which is what an animated or
 * alpha-carrying file uses). Reading only the lossy layout — the version most examples
 * show — silently fails on every screenshot saved as lossless WebP.
 */
function webpSize(b: Uint8Array): Size {
  if (b.length < 30) return null;
  if (ascii(b, 12, 'VP8 ')) {
    // Lossy: a 3-byte start code then two 14-bit dimensions.
    return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  }
  if (ascii(b, 12, 'VP8L')) {
    // Lossless: 14 bits of width-1 then 14 bits of height-1, packed little-endian.
    const bits = u32be(b, 21);
    const packed = ((bits >>> 24) | ((bits >>> 8) & 0xff00) | ((bits << 8) & 0xff0000)) >>> 0;
    return { width: (packed & 0x3fff) + 1, height: ((packed >>> 14) & 0x3fff) + 1 };
  }
  if (ascii(b, 12, 'VP8X')) {
    // Extended: canvas size as two 24-bit little-endian values, each minus one.
    return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  }
  return null;
}

/**
 * AVIF: an ISO-BMFF box tree; the size lives in an `ispe` box somewhere inside `meta`.
 *
 * Walking the tree properly means implementing four container box types. Locating the
 * four-byte `ispe` type and reading the two big-endian values that follow its version and
 * flags is the whole of what is needed, and the box type is not a value that occurs in
 * compressed AV1 data at a 4-byte alignment by accident often enough to matter — a wrong
 * read here produces an implausible size, which the caller's cap then refuses. The scan is
 * bounded to the header window the caller supplies.
 */
function avifSize(b: Uint8Array): Size {
  for (let i = 0; i + 12 < b.length; i += 1) {
    if (ascii(b, i, 'ispe')) {
      return { width: u32be(b, i + 8), height: u32be(b, i + 12) };
    }
  }
  return null;
}

/* ── the one export ────────────────────────────────────────────────────────────── */

const SIGNATURES: ReadonlyArray<{
  type: AcceptedImageType;
  matches: (bytes: Uint8Array) => boolean;
  size: (bytes: Uint8Array) => Size;
}> = [
  {
    type: 'image/png',
    matches: b => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    size: pngSize,
  },
  { type: 'image/jpeg', matches: b => startsWith(b, [0xff, 0xd8, 0xff]), size: jpegSize },
  {
    type: 'image/gif',
    matches: b => ascii(b, 0, 'GIF87a') || ascii(b, 0, 'GIF89a'),
    size: gifSize,
  },
  { type: 'image/webp', matches: b => ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP'), size: webpSize },
  // `ftyp` at offset 4, then a brand. `avis` is the animated (image sequence) brand.
  {
    type: 'image/avif',
    matches: b => ascii(b, 4, 'ftyp') && (ascii(b, 8, 'avif') || ascii(b, 8, 'avis')),
    size: avifSize,
  },
];

/**
 * Identify a file from its leading bytes, or answer `null`.
 *
 * `null` means "not one of the formats this app accepts, or not readable enough to be
 * sure" — the caller turns both into the same refusal, because to a person uploading a
 * file they are the same thing and distinguishing them would only tell a probe which
 * malformed header got further.
 *
 * Pass at least `SNIFF_BYTES`; passing fewer makes a legitimate JPEG with a large EXIF
 * block indistinguishable from a corrupt one.
 */
export function sniffImage(bytes: Uint8Array): SniffedImage | null {
  const candidate = SIGNATURES.find(signature => signature.matches(bytes));
  if (!candidate) return null;

  const size = candidate.size(bytes);
  // A signature with no readable size is a refusal, not a pass — see the header.
  if (!size || size.width <= 0 || size.height <= 0) return null;

  return {
    type: candidate.type,
    extension: ACCEPTED_IMAGE_TYPES[candidate.type].extension,
    width: size.width,
    height: size.height,
  };
}
