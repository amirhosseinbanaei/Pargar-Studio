# Grounding checklist

A plain-language request is not a specification. This checklist turns one into a prompt a fresh
session can execute without asking a single follow-up question.

Work every section that the request touches. Skip a section only when it genuinely cannot apply
— and if you are unsure whether it applies, it applies.

Every finding you carry into the prompt needs a `file:line` reference and a stated consequence,
per SKILL.md Step 2.

---

## A. The end state

Before anything else, write the sentence: *what is true after the session runs this prompt?*

1. Name the artefact that will exist or change — a route, a module, a component, a data file.
2. Name how the user will see it. A change nobody can observe is either infrastructure (say so)
   or not a change (say that too).
3. Name what must **not** change. This is the sentence that stops the receiving session from
   refactoring its way out of scope.

## B. What already exists

The most common failure in a generated prompt is describing work that is already done, or
work that contradicts what is there.

1. Does the module already exist? `ls src/modules/` — if yes, read its `index.ts` barrel first;
   the barrel is the module's public surface and the prompt must respect it.
2. Does the route already exist? `ls src/app/\(site\)/` — a new page in an occupied path is a
   replacement, and the prompt must say so explicitly.
3. Does a component that does this already exist in `src/common/components/`? Check `ds/`
   before proposing anything new. A prompt that adds a second Button is a bug.
4. Is there a data file the content belongs in? Static content lives in the module's `data.ts`
   as typed readonly data — never inline in JSX.
5. `rg -n '<the thing the user named>' src/` — the request's own noun is the best search term.

Record what you find as *facts the prompt states*, not as things the session should discover.

## C. AGENTS.md constraints

`AGENTS.md` is this project's memory. Check it for:

1. A **ban** the request would violate (a library, a pattern, a directory).
2. A **decision already recorded** about this area — the prompt must not silently reverse it.
3. A **deferral** — something explicitly postponed, which the request may be un-postponing. If
   so, say that in the prompt.
4. **Placeholder routes** — if the request adds a link, is its target real or a
   `ComingSoonState`?
5. The **content-fidelity policy** — if copy changes, the prompt must require the decision be
   recorded, not silently applied.

## D. Architecture fit

From `.claude/skills/nextjs-app-architecture/references/`:

1. **Layer.** Does this belong in `app/`, `modules/` or `common/`? State it. A component in the
   wrong layer is a lint failure, not a style preference.
2. **Server or client.** Server Component unless it needs state, effects or browser APIs. If it
   needs `'use client'`, say which leaf gets it and why — never the whole page.
3. **Data.** Static, or fetched? If fetched, it goes through the server data layer
   (`03-server-data-layer.md`), not a `fetch` in a component.
4. **Mutations.** Any write is a Server Action with a Zod schema
   (`04-actions-and-mutations.md`, `05-contracts-and-schemas.md`).
5. **Forms.** react-hook-form + zodResolver through the existing Form primitives
   (`07-forms.md`). Never a hand-rolled `onSubmit`.
6. **Errors and loading.** Which `ErrorState` / `LoadingState` does this use?
7. **Tokens.** Every colour, radius and shadow through `globals.css` semantic tokens. If the
   request implies a colour that has no token, name the token to add.

## E. RTL, Persian and accessibility

This site is Persian, RTL, single-locale. Every prompt inherits that.

1. Directional properties: `margin-inline`, `padding-inline`, `start`/`end` — never `left`/
   `right` where direction matters.
2. Persian copy goes in the prompt **verbatim**, in Persian. Do not translate it, do not
   paraphrase it, do not "fix" its spacing.
3. Persian digits stay Persian where the source uses them.
4. Keyboard reachability, focus-visible, and correct ARIA for anything interactive.
5. `prefers-reduced-motion` for anything animated.

## F. Links and routes

For every link the change introduces or touches:

1. Does the target route exist under `src/app/(site)/`?
2. If not — is it a deliberate `ComingSoonState` placeholder, or an error? Say which.
3. Is the slug English, per the route-map convention in `docs/`? Finglish paths were retired.

## G. Scope boundary

List, explicitly, the things a reasonable session would touch next and must not touch now:

1. The neighbouring components that share the file.
2. The tests that would need updating for a *different* change.
3. The tempting refactor sitting next to the work.

These become Clause 3 of the prompt. Without them, "in scope" has no edge.

## H. Verification

What proves this worked, beyond the four-command gate?

1. The exact route to open in `npm run dev`.
2. The widths to check — mobile, md, lg, xl — and that RTL is the default, not a variant.
3. The specific interaction to try, if any.
4. What a reviewer should compare against, if there is a reference.

A prompt whose only verification is "make sure it builds" has not specified the work.
