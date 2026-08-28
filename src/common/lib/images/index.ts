// src/common/lib/images/index.ts
/**
 * Pure byte-level work on uploaded images: what a file is, and how big it says it is.
 *
 * SERVER-SAFE BY CONTRACT, exactly as `common/lib/art/` is, and for a different reason: art
 * is pure so it can run on the server, this is pure so it can be TESTED without a
 * filesystem or a request. Nothing here touches `node:fs`, `next/*` or `process.env` — the
 * module that does is `common/services/upload-store.ts`, behind `server-only`.
 */
export { sniffImage, SNIFF_BYTES, type SniffedImage } from './sniff';
