// @vitest-environment node
/**
 * The byte sniff, and the attack it exists to stop.
 *
 * The case that motivates this whole module is the first `it` in the second block: a text
 * file renamed to `.jpg`. A browser labels it `image/jpeg` from the extension alone, so the
 * `Content-Type` header on the upload says exactly what an attacker wants it to say — and
 * the only statement about that file its sender did not compose is the leading bytes.
 *
 * The signatures below are REAL file headers, hand-assembled rather than copied from a
 * fixture directory: this repository ships zero image files by design (AGENTS.md), and a
 * test that needed a `.png` on disk would be the first one — and would then be uploading
 * itself into the very directory the sweep is supposed to keep empty.
 */
import { describe, expect, it } from 'vitest';
import { sniffImage } from '../sniff';

/** `89 50 4E 47 0D 0A 1A 0A` + a length + `IHDR` + two big-endian 32-bit dimensions. */
function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0, 0, 0, 13], 8);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // 'IHDR'
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

/** SOI, an APP0 segment of `padding` bytes, then an SOF0 carrying height then width. */
function jpeg(width: number, height: number, padding = 16): Uint8Array {
  const app0 = 2 + padding;
  const bytes = new Uint8Array(2 + 2 + app0 + 2 + 2 + 6);
  const view = new DataView(bytes.buffer);
  let at = 0;
  bytes.set([0xff, 0xd8], at);
  at += 2; // SOI
  bytes.set([0xff, 0xe0], at);
  at += 2; // APP0
  view.setUint16(at, app0);
  at += app0; // its length covers its own payload
  bytes.set([0xff, 0xc0], at);
  at += 2; // SOF0
  view.setUint16(at, 8 + 3);
  at += 2; // segment length
  bytes[at] = 8;
  at += 1; // sample precision
  view.setUint16(at, height);
  at += 2; // HEIGHT comes first in a SOFn
  view.setUint16(at, width);
  return bytes;
}

/** `RIFF` + size + `WEBP` + `VP8 ` + a lossy frame header. */
function webpLossy(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(32);
  const ascii = (text: string, at: number) =>
    text.split('').forEach((c, i) => (bytes[at + i] = c.charCodeAt(0)));
  ascii('RIFF', 0);
  ascii('WEBP', 8);
  ascii('VP8 ', 12);
  const view = new DataView(bytes.buffer);
  view.setUint16(26, width, true);
  view.setUint16(28, height, true);
  return bytes;
}

/** `GIF89a` + a little-endian logical screen descriptor. */
function gif(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(10);
  'GIF89a'.split('').forEach((c, i) => (bytes[i] = c.charCodeAt(0)));
  const view = new DataView(bytes.buffer);
  view.setUint16(6, width, true);
  view.setUint16(8, height, true);
  return bytes;
}

describe('sniffImage — the formats it accepts', () => {
  it('reads a PNG and its dimensions from IHDR', () => {
    expect(sniffImage(png(1600, 1200))).toEqual({
      type: 'image/png',
      extension: 'png',
      width: 1600,
      height: 1200,
    });
  });

  it('reads a JPEG by WALKING the marker segments, not by scanning for FFC0', () => {
    // The APP0 segment before the frame is what a scan gets wrong: a real photograph's EXIF
    // block is tens of kilobytes and routinely contains the SOF0 byte pair inside a
    // thumbnail, so a scanner reports the dimensions of the thumbnail or of nothing.
    expect(sniffImage(jpeg(4032, 3024, 64))).toEqual({
      type: 'image/jpeg',
      extension: 'jpg',
      width: 4032,
      height: 3024,
    });
  });

  it('reads a lossy WebP', () => {
    expect(sniffImage(webpLossy(800, 600))).toMatchObject({
      type: 'image/webp',
      extension: 'webp',
      width: 800,
      height: 600,
    });
  });

  it('reads a GIF', () => {
    expect(sniffImage(gif(320, 240))).toMatchObject({ type: 'image/gif', width: 320, height: 240 });
  });

  it('reports the extension from the SNIFFED type, never from a name', () => {
    // This is what stops a PNG being stored as `.jpg` and later served as `image/jpeg`:
    // the store takes its extension from here and never from the upload.
    expect(sniffImage(png(10, 10))?.extension).toBe('png');
    expect(sniffImage(jpeg(10, 10))?.extension).toBe('jpg');
  });
});

describe('sniffImage — what it refuses', () => {
  it('REFUSES a text file whatever it is called or claims to be', () => {
    // `mv notes.txt photo.jpg`, then a browser labels it `image/jpeg`. The header is the
    // only part of that request its sender did not choose.
    const text = new TextEncoder().encode('the quick brown fox jumps over the lazy dog\n');
    expect(sniffImage(text)).toBeNull();
  });

  it('refuses an SVG — it is a document, not a bitmap', () => {
    // Served from this app's own origin by `/api/media`, an SVG executes with the session
    // cookie in scope. `ACCEPTED_IMAGE_TYPES` omits it deliberately.
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(sniffImage(svg)).toBeNull();
  });

  it('refuses a valid signature whose dimensions cannot be read', () => {
    // "I could not tell" must fail closed. A truncated header means this module cannot make
    // the size claim the decompression-bomb cap depends on, and passing it through would
    // hand an unbounded image to the optimizer.
    const truncated = png(100, 100).subarray(0, 12);
    expect(sniffImage(truncated)).toBeNull();
  });

  it('refuses a zero dimension', () => {
    expect(sniffImage(png(0, 100))).toBeNull();
  });

  it('refuses an empty buffer', () => {
    expect(sniffImage(new Uint8Array(0))).toBeNull();
  });
});

describe('sniffImage — the bomb', () => {
  it('reports the DECLARED dimensions, however small the file is', () => {
    // 24 bytes claiming 60000 x 60000. Nothing here refuses it — the CAP is the caller's,
    // in `/api/uploads` — but the number it refuses on has to be this one, read before
    // anything is decoded or stored.
    const bomb = png(60_000, 60_000);
    expect(bomb.byteLength).toBeLessThan(64);
    expect(sniffImage(bomb)).toMatchObject({ width: 60_000, height: 60_000 });
  });
});
