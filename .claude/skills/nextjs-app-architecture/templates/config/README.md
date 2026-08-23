# Config templates — index

Repository-level configuration. Each file's first line states its **target path**; several are
named differently here than at their destination (dotfiles and files that would otherwise be
picked up by tooling inside this folder), so read the header before copying.

**Required** means the architecture does not hold without it — the boundary contract, the type
gate, or the env contract stops being enforced. **Optional** means it is a real choice: adopt it
or deliberately skip it.

| Template | Target path | Purpose | Status |
| --- | --- | --- | --- |
| `tsconfig.json` | `tsconfig.json` | `strict`, `moduleResolution: bundler`, `isolatedModules`, the `@/*` alias the whole boundary contract is written against, and the generated-route-type include paths. `tsc --noEmit` is the single source of type truth. | **Required** |
| `eslint.config.mjs` | `eslint.config.mjs` | The boundary enforcer: generated per-module zones, `common/` isolation, the barrel rule for `app/`, the primitives exemption. Encodes that flat config *replaces* rather than merges rule options, so every zone declares its complete pattern set. | **Required** |
| `package.scripts.json` | merge into `package.json` | The four fixed gate script names (`typecheck`, `lint`, `build`, `test`) plus `typegen`, `format`, workshop and `prepare`, and the `lint-staged` block. Strip the comments — `package.json` is strict JSON. | **Required** |
| `env.example` | `.env.example` | The configuration contract: every variable the app reads, documented, with the build-time-vs-runtime distinction spelled out. Ships with no real secrets and no production-critical localhost default in code. | **Required** |
| `next.config.ts` | `next.config.ts` | Image-optimizer `remotePatterns` derived from env rather than hardcoded (fails closed), `output: 'standalone'`, and the deliberately-off `typedRoutes` / React Compiler switches with the reasoning kept next to them. | **Required** |
| `.prettierrc` | `.prettierrc` | Formatting only — ESLint owns correctness. Registers the class sorter last in `plugins` and points it at the theme stylesheet and every class-composing helper. | Optional (strongly recommended) |
| `vitest.config.ts` | `vitest.config.ts` | jsdom environment, colocated test globs, the `@/*` alias mirrored from tsconfig, and the `server-only` → empty-module alias that makes server code testable at all. | Optional (required if you test) |
| `test-setup.ts` | `src/test/setup.ts` | Per-file test setup: the a11y matcher, four jsdom gaps that would otherwise read as product bugs, and the fenced request-mock lifecycle. | Optional (pairs with `vitest.config.ts`) |
| `test-empty-module.ts` | `src/test/empty-module.ts` | The alias target for `server-only` under test. Two lines, and the reason server services are unit-testable. | Optional (pairs with `vitest.config.ts`) |
| `ci.yml` | `.github/workflows/ci.yml` | CI runs the **same** gate commands in the same order as the local hooks, with public env vars set on the build step (they are inlined there and can never change afterwards). | Optional (strongly recommended) |
| `husky-pre-commit.sh` | `.husky/pre-commit` | `lint-staged` on staged files only. Fast by design — a slow pre-commit hook is a bypassed hook. | Optional |
| `husky-commit-msg.sh` | `.husky/commit-msg` | Runs commitlint against the message file, with `--no-install` so a commit never hangs on a network fetch. | Optional (pairs with `commitlint.config.ts`) |
| `husky-pre-push.sh` | `.husky/pre-push` | The local half of the merge gate: `typecheck && lint && test`. `build` is deliberately left to CI. | Optional |
| `commitlint.config.ts` | `commitlint.config.ts` | Conventional commits with a **required kebab-case scope**, which is what makes per-module history and changelogs possible — and makes a boundary-crossing commit visible at review. | Optional |
| `storybook-main.ts` | `.storybook/main.ts` | Component-workshop config: one recursive story glob so stories live beside their component, and the framework preset that supplies aliases, CSS and image handling. | Optional (design-system projects) |
| `storybook-preview.tsx` | `.storybook/preview.tsx` | Global decorators and parameters: the app stylesheet, the writing-direction toggle, and a11y checks set to fail rather than report. | Optional (pairs with `storybook-main.ts`) |
| `Dockerfile` | `Dockerfile` | Multi-stage build on traced standalone output, with the public-env-vars-are-inlined-at-build-time trap documented at the top and passed as build `ARG`s. | Optional (containerized deploys) |
| `.dockerignore` | `.dockerignore` | Keeps the host's `node_modules` and `.next` out of the build context, which otherwise poison the image with host-built native modules. | Optional (required with `Dockerfile`) |
| `compose.yaml` | `compose.yaml` | Local full-stack composition. Exists mainly to encode one rule: the browser-facing URL and the container-internal URL are two different values and both are needed. | Optional |
| `AGENTS.md.template` | `AGENTS.md` (or `CLAUDE.md`) | A ~40-line **router**, not a manual: stack line, gate, pointers, and repo-specific bans. Replace every `{{PLACEHOLDER}}`; do not copy the architecture into it. | Optional (strongly recommended) |

## Order

1. `tsconfig.json`, `package.scripts.json`, `env.example` — nothing else works before the alias,
   the script names and the env contract exist.
2. `eslint.config.mjs`, `next.config.ts` — the enforcement and framework layer.
3. `vitest.config.ts` + `test-setup.ts` + `test-empty-module.ts`, `.prettierrc`.
4. `husky-*.sh` + `commitlint.config.ts`, then `ci.yml` — hooks first, so CI mirrors something that
   already passes locally.
5. `Dockerfile` + `.dockerignore` + `compose.yaml`, `storybook-*`, `AGENTS.md.template` — as needed.

## Coupled pairs

Adopting one of these without the other leaves a broken reference:

- `vitest.config.ts` ↔ `test-setup.ts` ↔ `test-empty-module.ts` (the config names both paths).
- `husky-commit-msg.sh` ↔ `commitlint.config.ts`.
- `husky-pre-commit.sh` ↔ the `lint-staged` block in `package.scripts.json`.
- `Dockerfile` ↔ `.dockerignore`, and both ↔ `output: 'standalone'` in `next.config.ts`.
- `storybook-main.ts` ↔ `storybook-preview.tsx`, and both ↔ the `storybook` scripts.
- `env.example` ↔ `src/common/config/env.ts` — a key in one and not the other is the defect this
  pair exists to prevent.
