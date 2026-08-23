<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Kavan Studio — agent instructions

Next.js 16.3 (App Router, React 19, TypeScript strict), **Cache Components on**
(`cacheComponents: true`). Tailwind v4, zod 4. Dev server: `npm run dev` on :3000.

## Architecture

This project follows the `nextjs-app-architecture` skill. Before writing or changing any
framework-specific code (routing, caching, data fetching, Server Actions, forms, error
handling, session), read the matching guide in
`.claude/skills/nextjs-app-architecture/references/` — start from its index.

Layering is machine-enforced in `eslint.config.mjs`: `app → modules → common`, one way,
no cross-module imports, modules consumed through their `index.ts` barrel only. Adding a
module means adding its name to the `MODULES` array **first** — it is empty today, and a
module with no entry there has no boundary rules at all.

## Verification

After any non-trivial change run, in this order:

```bash
npm run typecheck && npm run lint && npm run build && npm run test
```

All four pass, or the change is not done.

## Project decisions

- **Next 16.3, not 15.x.** Every later prompt uses `'use cache'`, `cacheLife`, `cacheTag`
  and `updateTag` — Cache Components APIs that do not exist on 15.x.
- **Data is Turso / libSQL.** `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`; prompt 2 wires
  the driver.
- **Bilingual content is per-locale COLUMNS on one row** (`title_en`, `title_fa`), not a
  translations table. Every record carries both locales or neither.
- **The shell keeps its CSS.** `legacy/css/shell.css` and `panel.css` are ported as real
  CSS imported by the shell module (prompt 4) and are not rewritten as utilities — 32KB of
  precisely tuned geometry a utility rewrite would not reproduce faithfully. Tailwind
  utilities are for the dashboard.
- **Tokens are declared twice in `src/app/globals.css`**: `@theme` for what dashboard
  utilities must reach, raw `:root` custom properties for the ported shell CSS, which
  references them by name. That file says which token is which and why some are suffixed.
- **Zero webfont bytes.** The geometric system stack in `--f-sans` is kept exactly as-is:
  no `next/font`, no CDN font CSS, so no FOIT and no CLS.

## Deviations from the architecture playbook

Each is deliberate. Re-enable conditions are stated so the next agent does not "fix" them.

- **No MSW / no `src/mocks/` front-db** (skips A14). This app's SQLite database _is_ its
  own local data source, so a seeded dev database gives the same standalone-run property
  MSW would. Re-enable if an external HTTP backend is ever introduced.
- **No Storybook** (skips the workshop half of A12 and the `build-storybook` CI step).
  Deferred under a two-day delivery deadline, not rejected. `eslint-plugin-storybook` is
  therefore absent, and its import and spread are deleted from `eslint.config.mjs` — a
  config referencing an uninstalled plugin cannot load at all. Re-enable when the `ds/`
  tier is stable and there is time for a11y stories.
- **`db → repository → service` replaces the HTTP transport ring** (A8's
  `http → api-client → services`) in prompt 2. There is no backend to talk to and no wire
  response to zod-parse; the ring's invariants still hold, one layer lower. This is why
  `common/constants/api.ts` exports no `API_URL` and `common/config/env.ts` declares no
  API origin.
- **A single signed HttpOnly cookie replaces A9's three-legged JWT rotation** in prompt 6.
  There is one admin and no user table, so there is no refresh token to rotate and no
  session ring to single-flight. Re-enable the full ring only if multi-user auth arrives.
- **No production error tracker.** `common/observability/dev-log.ts` stays dev-only; its
  three reporting call sites report nowhere. Reason and re-enable condition are in that
  file.

## Bans

- **Nothing under `src/` imports anything under `legacy/`.** `legacy/` is the original
  static site, kept byte-for-byte as a read-only reference and **deleted in prompt 7**.
  Read it with your eyes; port values deliberately. Lint enforces this.
- **Do not edit, reformat or "clean up" anything under `legacy/`.** It is the record of
  how the original site worked, and later prompts read it expecting it unchanged.
- No `any`. Use `unknown` plus a type guard, or parse with a schema — `any` disables
  checking transitively for everything downstream.
- No colour, radius, duration or z-index literal in a component. If a token is genuinely
  missing, add it to `src/app/globals.css`; never inline the hex.
- No suppression: `typescript.ignoreBuildErrors`, `eslint.ignoreDuringBuilds`,
  `git commit/push --no-verify`, file-level or blanket `eslint-disable`, `.skip` on a test
  you just broke. A narrow, single-rule, one-line disable naming the false positive is the
  only sanctioned escape hatch.
- No new dependency for something `common/` or the design system already does; check
  first, and say what you checked.
