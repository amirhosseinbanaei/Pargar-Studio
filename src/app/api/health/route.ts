// src/app/api/health/route.ts
/**
 * Liveness probe for the container `HEALTHCHECK` and the orchestrator. Deliberately
 * trivial: it must answer even if the database is unreachable, or a Turso outage takes the
 * whole container down with it — the process being up and able to serve HTTP is the only
 * claim this route makes.
 *
 * No cache directive, and none is needed: with `cacheComponents: true`
 * (`next.config.ts`), a route handler is dynamic by default unless it explicitly opts into
 * `'use cache'`, which this one never does — so it is never prerendered, and the segment
 * config that would have said so on 15.x (`export const dynamic = 'force-dynamic'`) is
 * incompatible with Cache Components and fails the build outright if added back.
 */
export function GET(): Response {
  return Response.json({ ok: true });
}
