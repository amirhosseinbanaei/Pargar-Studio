# Target path in a real project: <repo-root>/Dockerfile
# syntax=docker/dockerfile:1
#
# Multi-stage build on traced standalone output (`output: 'standalone'` in next.config.ts).
# The runtime image contains a Node runtime, the traced server, and nothing else: no
# node_modules tree, no source, no build toolchain.
#
# ╔══════════════════════════════════════════════════════════════════════════════════╗
# ║ THE PRODUCTION SURPRISE: PUBLIC ENV VARS ARE INLINED AT BUILD TIME.               ║
# ║                                                                                   ║
# ║ Every `NEXT_PUBLIC_*` value is baked into the JavaScript the browser downloads,    ║
# ║ during `npm run build`, by static text substitution. Consequences:                 ║
# ║                                                                                   ║
# ║  • Setting `NEXT_PUBLIC_API_URL` on a RUNNING container does nothing at all. The   ║
# ║    browser keeps calling whatever URL was present on the machine that built the    ║
# ║    image. This is consistently misdiagnosed as a caching or CORS problem.          ║
# ║  • They must be passed as build `ARG`s in the BUILDER stage (below), and they must ║
# ║    match what CI used, or the same source yields two different bundles.            ║
# ║  • One image per public-config target. If staging and production need different    ║
# ║    public URLs, they need different builds — or that value must be delivered as    ║
# ║    runtime data from a server route instead of as a public env var.                ║
# ║                                                                                   ║
# ║ SERVER-ONLY vars (secrets, internal service URLs) are the opposite: read per        ║
# ║ request at runtime, supplied by the orchestrator. NEVER bake a secret into a        ║
# ║ layer — `docker history` reads it back out.                                        ║
# ╚══════════════════════════════════════════════════════════════════════════════════╝

FROM node:24-alpine AS base
WORKDIR /app

# ── Dependencies ──────────────────────────────────────────────────────────────────
# Its own stage so this layer is cached on the lockfile alone: a source-only change
# skips the install entirely.
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ── Builder ───────────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Public values — INLINED here, at build time. See the box above. Add one ARG/ENV pair
# per public variable your env module declares.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── Runner ────────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# The port is arbitrary — pick one and keep it consistent across Dockerfile, compose,
# healthcheck and reverse proxy.
ENV PORT=3000
# REQUIRED. The standalone server binds loopback by default: without this the container
# starts, reports healthy, and refuses every connection from outside itself.
ENV HOSTNAME=0.0.0.0

# Run as a non-root user: a container process running as root turns any RCE into
# host-adjacent access. Create the user here and `--chown` on copy — a later `chown -R`
# duplicates every copied layer and doubles the image size.
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 appuser

# Standalone tracing DELIBERATELY omits `public/` and `.next/static`. Forgetting either
# gives you a running app that serves HTML with no CSS, no JS chunks and no images — the
# single most common standalone-container bug, and it looks like a broken deploy rather
# than a missing COPY.
COPY --from=builder --chown=appuser:nodejs /app/public ./public
COPY --from=builder --chown=appuser:nodejs /app/.next/standalone ./
COPY --from=builder --chown=appuser:nodejs /app/.next/static ./.next/static

USER appuser
EXPOSE 3000

# Hits a REAL route (add a trivial `src/app/api/health/route.ts` returning 200). A
# healthcheck that only proves the port is open will happily report a crashed render loop
# as healthy, so the orchestrator never restarts it.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# `server.js` is emitted by the standalone trace; there is no npm script in this image.
CMD ["node", "server.js"]
