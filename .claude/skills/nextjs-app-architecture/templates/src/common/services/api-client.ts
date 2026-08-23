// src/common/services/api-client.ts
/**
 * Ring 2: authenticated, validated backend access. Prefixes the API base URL, attaches
 * the bearer token from the session cookie, zod-parses the response, and performs the
 * single in-render refresh-and-retry on a 401.
 *
 * This file must NEVER be imported by a Client Component — `import 'server-only'` turns
 * that mistake into a build failure instead of a token leak. It must also never contain
 * an endpoint path, a domain type, or user-facing copy; those belong to ring 3 services.
 *
 * The failure it prevents: casting a response (`(await res.json()) as Invoice`) is a lie
 * the compiler believes. A renamed backend field becomes `undefined` three components
 * deep, at render time, in production. Parsing here makes the network edge the single
 * place backend shapes are trusted, so contract drift fails loudly at the boundary.
 */
import 'server-only';
import type { z } from 'zod';
import { http } from './http';
import type { RequestOptions } from './http-types';
import { HttpError } from './http-types';
import { readSession, refreshAccess } from './session';
import { API_URL } from '@/common/constants/api';
import { devError } from '@/common/observability/dev-log';

interface ApiOptions extends Omit<RequestOptions, 'headers'> {
  /** Attach the session bearer token (default true). Public endpoints pass false. */
  auth?: boolean;
  /** Internal: the access token used by the in-render 401-retry path. */
  accessOverride?: string;
}

/**
 * `Omit<RequestOptions, 'headers'>` is deliberate. If callers could pass `headers`, one
 * of them would eventually overwrite `Authorization` and produce an unexplainable 401.
 * TODO(project): if you need per-call headers (an idempotency key, a locale), add a
 * narrow `extraHeaders` option here that is merged BELOW `Authorization`.
 */
export async function apiFetch<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  { auth = true, accessOverride, ...options }: ApiOptions = {},
): Promise<z.infer<S>> {
  const access = accessOverride ?? (auth ? (await readSession()).access : null);

  try {
    const raw = await http(`${API_URL}${path}`, {
      ...options,
      headers: access ? { Authorization: `Bearer ${access}` } : undefined,
    });
    // `parse`, never `safeParse` + a fallback shape: a backend that changed shape is a
    // bug, and swallowing it means shipping against a contract you no longer match.
    //
    // No `as z.infer<S>` here, deliberately. `parse` already returns exactly that type,
    // and these schemas lean on `.transform()` (see `@/common/schemas/helpers`), where
    // input and output types genuinely differ — an assertion sitting on the parse
    // boundary would absorb an input/output mismatch the day this signature is edited.
    return schema.parse(raw);
  } catch (err) {
    // The in-render refresh: a single retry when the access token died mid-render.
    // `accessOverride` is the loop guard — the retried call can 401 only once, so a
    // genuinely revoked session cannot spin here.
    //
    // It exists because an RSC render cannot persist `cookies().set()`, so the fresh
    // token can only serve THIS request; the interception layer owns the persistent
    // rotation, and sign-in/sign-out own the explicit writes.
    if (err instanceof HttpError && err.status === 401 && auth && !accessOverride) {
      const { refresh } = await readSession();
      if (refresh) {
        const rotated = await refreshAccess(refresh);
        if (rotated) {
          return apiFetch(path, schema, { ...options, auth, accessOverride: rotated.access });
        }
      }
    }
    // Development-only: surface the failing request with its path, method, status and
    // body. A 401 that was successfully refreshed already returned above, so this logs
    // genuine failures only. `instanceof` is acceptable here and only here: the error
    // was constructed one module away, with no serialization boundary in between.
    if (err instanceof HttpError) {
      devError('api', err, { path, method: options.method ?? 'GET' });
    }
    throw err;
  }
}
