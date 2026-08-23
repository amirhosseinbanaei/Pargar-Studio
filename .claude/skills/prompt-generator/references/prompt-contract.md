# Prompt contract

The clauses every generated prompt carries, with the wording this project uses. Adapt the
specifics to the request you were given; do not drop a clause because it "obviously applies".

**Four clauses are set by Step 0's answers, and only those four**: Clause 0 (branch), and the
commit and graphify items of Clause 8. Each has a wording for "yes" and a wording for "no" below
— the prompt always states which, never leaves it open. Every other clause here is
unconditional, the verification gate and the AGENTS.md update included.

The prompt is addressed to a session with **no memory of your conversation**. It stands alone.

---

## Shape

Plain text, short numbered sections. It gets pasted into a chat box — no Markdown tables, no
nested bullets three levels deep, no decorative headers. One idea per numbered item.

```
0. Branch          — the one-liner, before anything else
1. Context         — what exists today, with paths; why this change is being made
2. Goal            — what is true when the session is done
3. Scope           — what is in, and explicitly what is out
4. Specifics       — the actual work, numbered, each item with its file and its outcome
5. Decisions       — assumptions made here, and the open ones the session must not resolve alone
6. Architecture    — the non-negotiables
7. Verification    — the four-command gate, then the manual check
8. Then            — AGENTS.md, then commit and graphify as Step 0 answered
```

Sections 3 and 5 are the ones people skip and then regret. A prompt with no stated
**out of scope** produces a session that refactors half the repo.

## Clause 0 — Branch first — set by Step 0

The prompt's **first line**, before any context.

**Step 0 chose a new branch:**

> Work on a new branch: prompt-<N>-<topic>. Create and switch to it before making any changes.

`<N>` is **this prompt's own number**, not the number of a batch it shipped in. In a file
covering prompts 10–12, the three branches are `prompt-10-…`, `prompt-11-…` and `prompt-12-…`,
each with its own topic suffix. Two prompts never share a number, and no branch is ever named
after the batch.

This clause appears **twice** on purpose — here, so the session branches before touching
anything, and again in Clause 8 as part of the closing sequence.

**Step 0 chose to work in place:**

> Work on the branch that is already checked out. Do not create a new branch. Run
> `git branch --show-current` first and stop if it reports `main` — this project never commits
> to main.

Say it outright; silence reads as "branch first" to a session that has run these prompts before.
The line appears once, in Clause 0 only, and no `prompt-<N>-<topic>` name appears anywhere in the
prompt.

## Clause 1 — Read first

> Read AGENTS.md and the nextjs-app-architecture skill references in
> .claude/skills/nextjs-app-architecture/references/ (start from README.md) before writing any
> code. Then read <the specific files this change touches, by path>.

Name the files. "Read the relevant files" is not an instruction.

## Clause 2 — Goal

One paragraph, stated as an end state, not as a task list:

> When this is done, <X> — expressed properly: three-layer architecture (app → modules →
> common), module consumed through its index.ts barrel only, semantic design tokens with no
> colour literal anywhere, Server Components by default with 'use client' only on the leaves
> that need it, next/image everywhere with no hand-rolled lazy-loading, Tailwind v4 utilities
> with no legacy prefix, no inline <style> blocks and no !important.

Trim the clauses that cannot apply. Keep every one that can.

## Clause 3 — Scope

Both halves, always:

> In scope: <the list, by module and file>.
> Out of scope: <the neighbouring things a reasonable session would otherwise touch>. Do not
> refactor them in this pass; if one blocks the work, stop and say so.

## Clause 4 — Specifics

Numbered. Each item: what to do, the `file:line` it lands in, and the outcome that proves it
worked. When the item is a fix, state the concrete failure it removes:

> 3. `src/modules/landing/data/landing.ts:212` — the stat band's third entry renders its «%» as
>    a suffix; the source shows it as a prefix. Fix the value, keep the number.

Never write "fix any bugs you find" or "improve the component" — that is not a specification.
If your grounding turned up a smell you could not confirm, say so in those words and give the
check that would confirm it.

## Clause 5 — Decisions

Two lists, both explicit:

> Assumptions made when this prompt was written: <each one, with what it would mean if wrong>.
> If an assumption is wrong, stop and say so before building.
>
> Open decisions — do not resolve these silently: <each one, with the recommended option and
> why>. Record whichever you choose in AGENTS.md.

If the change alters user-visible copy, add the project's standing rule:

> Per AGENTS.md's content-fidelity policy, record each copy decision in AGENTS.md rather than
> silently changing text.

## Clause 6 — Architecture non-negotiables

> - No colour literal outside src/app/globals.css. Add a new semantic token if one is genuinely
>   missing; do not inline the hex.
> - Reuse what exists: Container, Button, Input, Badge, NavLink, ConsultationForm,
>   Form/FormInput/FormButton, ErrorState, LoadingState. Extend them rather than forking.
> - All static content lives in the module's data.ts as typed readonly data, not inline in JSX.
> - Any new ds/ tier component ships with a story and an axe test, per 02-design-system.md.
> - Carousels are Embla (embla-carousel-react, plus -autoplay and -fade as needed), through the
>   shared Carousel primitive in src/common/components/ds/. Never a hand-rolled setInterval
>   slider, never Splide/Flickity/Slick/Owl.
> - No popup, modal or interstitial that overlays the page on load.
> - No any. No ignoreBuildErrors / ignoreDuringBuilds / --no-verify.
> - Fonts stay on next/font/local; do not add CDN font CSS.
> - Every link resolves to a real page or a deliberate ComingSoonState placeholder.

Drop the lines the change genuinely cannot touch. Keep the rest — they are cheap to repeat and
expensive to omit.

## Clause 7 — Verification

> npm run typecheck && npm run lint && npm run build && npm run test
>
> All four pass, or the change is not done.

Then the check specific to this change — what the session must actually look at:

> Then run the dev server and <the concrete manual check: the route to open, the widths to test,
> the interaction to try, in RTL>. Report anything you could not verify, and why.

## Clause 8 — Then — items 2 and 3 set by Step 0

Always last, always in this order. Item 1 is unconditional; items 2 and 3 take the wording Step 0
chose. Number whatever survives from 1 with no gaps — a prompt that skips the graphify step ends
at 2, not at 3.

> 1. Update AGENTS.md: what changed, every decision recorded above, and any new placeholder
>    routes.

**Commit — Step 0 said commit:**

> 2. Switch to Sonnet at medium effort and commit the work following the git-commit-flow skill
>    — one logical change per commit, type(scope) subjects, why-first bodies. Never commit
>    directly to main.

**Commit — Step 0 said leave uncommitted:**

> 2. Do not commit. Leave the work in the working tree and end with `git status` plus a one-line
>    summary of what changed, so it can be reviewed before anything is committed.

**Graphify — Step 0 said run it:**

> 3. Run `graphify --update` to refresh the project's knowledge graph with everything this
>    prompt added or changed.

**Graphify — Step 0 said skip it:** omit the item entirely. Do not replace it with "skip
graphify" — an instruction not to run a command the session was never told to run is noise.

Then repeat Clause 0's line as the closing sentence, in whichever form Step 0 chose:

> Work on a new branch: prompt-<N>-<topic>. Create and switch to it before making any changes.

or

> Work on the branch that is already checked out. Do not create a new branch.

## Cross-references between prompts in a batch

When a prompt depends on an earlier one, name it by number and branch, and state the check:

> Prompt 10 (branch prompt-10-form-primitives) added <the thing this prompt needs>. Confirm it
> exists before starting; if it does not, prompt 10 has not been merged and this prompt is not
> ready to run.

When Step 0 chose to work in place there is no branch to name, so name the number and the check:

> Prompt 10 added <the thing this prompt needs>. Confirm it exists before starting; if it does
> not, prompt 10 has not been run and this prompt is not ready to run.

Never refer to a sibling by its position in the file ("step 1 of 3", "the last one"). Positions
change when a batch is re-cut; numbers do not. The same applies to ownership notes — "prompt 12
deletes the old data file", not "the last prompt deletes it".
