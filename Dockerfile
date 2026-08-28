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
# ║  • Setting `NEXT_PUBLIC_SITE_URL` on a RUNNING container does nothing at all. The  ║
# ║    browser keeps calling whatever URL was present on the machine that built the    ║
# ║    image. This is consistently misdiagnosed as a caching or CORS problem.          ║
# ║  • They must be passed as build `ARG`s in the BUILDER stage (below), and they must ║
# ║    match what CI used, or the same source yields two different bundles.            ║
# ║  • One image per public-config target. Staging and production with different       ║
# ║    public URLs need different builds.                                              ║
# ║                                                                                   ║
# ║ SERVER-ONLY vars are the opposite: read per request at runtime, supplied by the     ║
# ║ orchestrator. This project's server-only set is `TURSO_DATABASE_URL`,               ║
# ║ `TURSO_AUTH_TOKEN`, `ADMIN_PASSWORD` and `SESSION_SECRET` — none of them is an ARG   ║
# ║ here, and none is baked into any layer (`docker history` reads a layer's build args ║
# ║ and copied files straight back out, so a secret ARG is a published secret).         ║
# ╚══════════════════════════════════════════════════════════════════════════════════╝
#
# THE DATABASE NEEDS NO VOLUME — it is Turso, reached over the network. UPLOADED IMAGES DO.
# Prompt 10 writes them to `UPLOAD_DIR` on local disk, and a container's writable layer is
# destroyed on every redeploy, so `compose.yaml` mounts a named volume at `/data/uploads`.
# The mount point is created below, owned by the non-root user this image runs as, because
# Docker seeds a new named volume from the image's directory — ownership included. Without
# that the volume arrives root-owned and the very FIRST upload fails in production and
# nowhere else.

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

# Public values — INLINED here, at build time. See the box above.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_MEDIA_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_MEDIA_URL=$NEXT_PUBLIC_MEDIA_URL
ENV NEXT_TELEMETRY_DISABLED=1

# The server-env schema (`common/config/server-env.ts`) throws at import time if any of
# these are missing, and the build imports it transitively through the dashboard's session
# module. Dummy values that satisfy the SHAPE (a real secret is never baked into an image
# layer) are enough — nothing at build time actually authenticates or opens a connection to
# a database that has to exist yet; `npm run build`'s prerender pass talks to whatever
# TURSO_DATABASE_URL names, which is why a real, reachable database URL is required here,
# not just a shape-satisfying placeholder.
ARG TURSO_DATABASE_URL
ARG TURSO_AUTH_TOKEN=""
ENV TURSO_DATABASE_URL=$TURSO_DATABASE_URL
ENV TURSO_AUTH_TOKEN=$TURSO_AUTH_TOKEN
ENV ADMIN_PASSWORD="build-time-placeholder"
ENV SESSION_SECRET="build-time-placeholder-at-least-32-characters"
# Also required by the schema at import time, also not a secret, and also never read during
# a build — nothing prerenders an upload. The runtime value comes from the orchestrator; see
# `compose.yaml`, which sets it to the volume's mount point.
ENV UPLOAD_DIR="/data/uploads"

RUN npm run build

# ── Runner ────────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
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
# gives you a running app that serves HTML with no CSS, no JS chunks and no images.
# THE UPLOAD DIRECTORY, CREATED BEFORE THE VOLUME EXISTS AND OWNED BY THE RUNTIME USER.
#
# Docker initializes an empty named volume FROM the image's contents at that path,
# ownership and permissions included. Creating it here is therefore what makes the mounted
# volume writable by `appuser`; leaving it to Docker gives a root-owned directory, and the
# container — which runs as uid 1001 by design — gets EACCES on the first upload. That
# failure appears only in production, only on the first write, and produces no useful line
# in `docker logs` (a production Next server logs no per-request access log).
RUN mkdir -p /data/uploads && chown -R appuser:nodejs /data

COPY --from=builder --chown=appuser:nodejs /app/public ./public
COPY --from=builder --chown=appuser:nodejs /app/.next/standalone ./
COPY --from=builder --chown=appuser:nodejs /app/.next/static ./.next/static

USER appuser
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# `server.js` is emitted by the standalone trace; there is no npm script in this image.
CMD ["node", "server.js"]
