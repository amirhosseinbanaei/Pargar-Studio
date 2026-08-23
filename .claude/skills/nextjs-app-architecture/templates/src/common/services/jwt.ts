// src/common/services/jwt.ts
/**
 * Minimal, UNVERIFIED JWT inspection: decode the payload to read `exp` so the request
 * interception layer can decide when to rotate a token pre-emptively, and so a cookie's
 * `maxAge` can match the life of the token inside it.
 *
 * This file must NEVER be treated as authentication. The signature is not checked, the
 * issuer is not checked, and nothing here may gate access to data — the backend stays
 * authoritative. It answers exactly one question: "is this token still worth sending?"
 *
 * It must also NEVER use `Buffer`. `Buffer` is Node-only, and this module is imported by
 * the request interception layer (`proxy.ts` / `middleware.ts`), which many deployments
 * run on an edge runtime. A `Buffer` reference there fails at build or, worse, at the
 * first request in production only. `atob` + `TextDecoder` are Web APIs available in
 * every runtime this code can land in — Node 16+, edge, and the browser.
 */

/**
 * Decode one base64url segment to a UTF-8 string. `atob` yields a *binary* string, so
 * the bytes are re-decoded through `TextDecoder`: skipping that step corrupts any
 * non-ASCII claim (a name, an email with an IDN domain) and can throw mid-JSON.
 */
function decodeBase64Url(segment: string): string | null {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/** Unix seconds at which the token expires, or `null` if that cannot be determined. */
export function getTokenExpiry(token: string): number | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const payloadSegment = parts[1];
  if (!payloadSegment) return null;

  const decoded = decodeBase64Url(payloadSegment);
  if (decoded === null) return null;

  try {
    // Silent catch is justified here: the only recovery is "treat it as unreadable",
    // the caller already handles `null` as "no usable expiry", and it is not
    // user-visible. See the error guide's rules for acceptable silent catches.
    const payload = JSON.parse(decoded) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

/**
 * True when the token is missing, unparseable, or expires within `skewMs` of now.
 *
 * Treating an undecodable token as expired is intentional — refreshing is cheap, and
 * sending garbage guarantees a 401. The skew exists because a request that starts a few
 * hundred milliseconds before expiry arrives *after* it: without a window, a healthy
 * session produces sporadic, unreproducible 401s under normal latency.
 */
export function isTokenExpired(token: string | null | undefined, skewMs = 0): boolean {
  if (!token) return true;
  const exp = getTokenExpiry(token);
  if (exp == null) return true;
  return exp * 1000 <= Date.now() + skewMs;
}
