# Kavan Studio

An architecture-studio site and its own content-management dashboard, built on Next.js 16
(App Router, React 19, TypeScript strict, Cache Components). The public site is bilingual
(English/Persian); the dashboard behind `/dashboard` is where the studio edits every piece
of it — projects, design works, media, the studio page, the contact page, and the inbox
those visitors write into.

This project began as a port of a dependency-free static site (`legacy/` in this
repository's git history, deleted once its content and behaviour had fully moved into the
database and `src/`) and has since grown a write side: nothing here is edited by hand-typed
data anymore. What was true about the original site and still is:

- **Every image is drawn at runtime unless someone uploaded one.** `src/common/lib/art/`
  holds eight procedural SVG generators (elevation, massing, courtyard, section, plan, jali
  screen, site contour, portrait), seeded from a record's slug so a drawing is unique,
  reproducible, and identical on every render. This layer is pure (no `document`, `window`,
  `Date`, or `Math.random`) and runs on the server — `'use client'` must never be added
  under `src/common/lib/art/`.

  The dashboard grew photograph uploads, and **the drawings are the fallback, not a
  placeholder that got replaced**: a record with no photograph renders its generated art
  exactly as it always did, on the card and on its page, so a grid of 76 projects with two
  photographs among them still looks finished. Uploaded files live on local disk under
  `UPLOAD_DIR` and are served by the app itself at `/api/media/<path>` — see Deploying.

- **Persian is a first-class locale, not a translated string table.** `/en/...` and
  `/fa/...` are independently cached, independently crawlable routes; bilingual content is
  a pair of columns on one database row (`title_en` / `title_fa`), never a translations
  table, so every dashboard form edits both languages side by side.
- **Motion follows four invariants** — CSS owns every resting state, `anim.done` (never
  `anim.finished`), one shared `requestAnimationFrame`, frame-rate-independent damping — kept
  from the original build in `src/common/lib/motion/anim.ts` and enforced by tests.

## Architecture

This project follows the `nextjs-app-architecture` skill in
`.claude/skills/nextjs-app-architecture/`. Read `AGENTS.md` first — it is the router for
this codebase's specific decisions, deviations, and bans; the skill's `references/` hold the
general architecture the decisions are made against. In short:

```
src/app/            routing and composition only — no domain logic
src/modules/         one folder per feature: projects, design, media, studio, contact, dashboard
src/common/           shared, domain-agnostic: the design system, the data layer, schemas, i18n
```

Layering (`app → modules → common`, one way, no cross-module imports) is machine-enforced in
`eslint.config.mjs`.

## Running it

```bash
npm install
cp .env.example .env.local   # fill in the values — see the comments in that file
npm run dev                  # http://localhost:3000
```

`.env.local` needs, at minimum, a `TURSO_DATABASE_URL` (a local `file:./kavan.db` works for
development), an `ADMIN_PASSWORD` for the dashboard, a `SESSION_SECRET` (32+ characters —
generate one with `openssl rand -base64 32`), and an **`UPLOAD_DIR`**: an ABSOLUTE path to a
directory for uploaded images, with no default (`<repo>/uploads` locally, which `.gitignore`
covers — write the path out in full, dotenv does not expand `$PWD`). See `.env.example` for
the full contract.

### The database

The schema lives in `src/common/services/schema.ts`; migrations are generated and committed
to `drizzle/` — `drizzle-kit push` is never the deploy path.

```bash
npm run db:migrate   # apply every committed migration
```

**There is no seed script.** The database was seeded once, during this project's migration
off a static site, from data files that lived at `legacy/` — that tree, and the one-time
`scripts/seed.ts` that read it, are gone from the working tree by design (AGENTS.md records
why, and the original content is still reachable in git history before the commit that
removed them). The database is now the only copy of the studio's content; there is nothing
left to re-seed FROM. To stand up a new environment, restore from a backup (below) rather
than re-running a migration script that no longer has a data source.

### The gate

```bash
npm run typecheck && npm run lint && npm run build && npm run test
```

All four pass, or the change is not done. `npm run typegen` regenerates framework route
types and should run first on a clean checkout, or after touching routing.

## Deploying

The app builds to a standalone Node server (`output: 'standalone'`) and ships as a
multi-stage Docker image (`Dockerfile`, `.dockerignore`).

**There are two stateful things now, not one.** The database is Turso, reached over the
network. Uploaded images are FILES, on local disk under `UPLOAD_DIR`, served by the app —
which is why `compose.yaml` mounts a named `uploads` volume at `/data/uploads`.

> **Deploy without that volume and every uploaded photograph is destroyed.** A container's
> writable layer is discarded when the container is replaced, which is what a redeploy does.
> The database keeps its paths, the pages fall back to their generated drawings, and nothing
> anywhere reports an error. Do not remove the volume as tidying.

The mount point is created in the `Dockerfile` owned by the non-root `appuser` the container
runs as, because Docker seeds a new named volume from the image's directory — ownership
included. Leaving that to Docker's default gives a root-owned volume and the FIRST upload
fails, in production only, with nothing useful in `docker logs`.

1. **Back up first.** The database is the one copy of the studio's content:
   ```bash
   turso db shell <database-name> ".dump" > backup-$(date +%F).sql
   ```
2. **Build the image**, passing the public build-time vars (inlined into the client bundle —
   see the box at the top of `Dockerfile`):
   ```bash
   docker build \
     --build-arg NEXT_PUBLIC_SITE_URL=https://your-domain \
     --build-arg NEXT_PUBLIC_MEDIA_URL= \
     -t kavan-studio .
   ```
3. **Run migrations** against the production database (safe to re-run — already-applied
   migrations are recorded and skipped):
   ```bash
   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run db:migrate
   ```
4. **Start the container**, supplying the server-only variables at runtime (never baked into
   the image — see `compose.yaml`):

   ```bash
   docker run -p 3000:3000 \
     -e TURSO_DATABASE_URL=... \
     -e TURSO_AUTH_TOKEN=... \
     -e ADMIN_PASSWORD=... \
     -e SESSION_SECRET=... \
     kavan-studio
   ```

   Or `docker compose up` — see `compose.yaml`, which wires the same four variables from
   `.env.local` and sets `UPLOAD_DIR` to the volume's mount point itself.

   Running with `docker run` instead of compose means mounting the volume by hand:
   `-v kavan_uploads:/data/uploads -e UPLOAD_DIR=/data/uploads`.

5. **Back up the images too.** The database backup in step 1 does not contain them — they
   are files. `docker run --rm -v kavan_uploads:/data -v "$PWD:/backup" alpine tar czf
/backup/uploads-$(date +%F).tar.gz -C /data .`

### Reclaiming orphaned images

An image is written the moment it is uploaded, before the record referencing it is saved, so
an editor who uploads a picture and then closes the tab leaves a file nothing points at.
This is deliberate — see AGENTS.md for why a two-phase commit between a filesystem and a
database was not built for a studio's photographs — and the cost is that `UPLOAD_DIR` grows
slowly and forever unless it is swept.

The sweep is a set difference: every path on disk (`listAllStoredPaths()` in
`src/common/services/upload-store.ts`) minus every path any record references
(`projects.cover_image` and `gallery_en`, the same two on `design_works`, `media.cover_image`,
and `studio.founders[].image`). Run it manually a couple of times a year, or on a schedule;
**take a backup first**, and never delete a file younger than a day — one being uploaded
right now is legitimately unreferenced.

A dashboard write purges exactly the public cache tags that record touches
(`src/common/services/cache-tags.ts`), so a saved change is live at its public URL
immediately — no rebuild and no redeploy are needed for content changes, only for code
changes.
