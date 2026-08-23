---
name: prompt-generator
description: Turn a plain-language request into a numbered, copy-ready prompt artifact in prompts/ — the same discipline as port-temp-page, but sourced from what the user asks for instead of from a src/temp/ drop. Asks four setup questions first — .md or .html, new branch or in place, commit or leave uncommitted, graphify or skip — then grounds the request in the repo and emits one self-contained prompt for a fresh session. Use whenever the user says "generate a prompt", "write me a prompt for X", "make the next prompt", or wants work handed to another session, with no legacy source dropped.
allowed-tools: Read, Write, Edit, Glob, Grep, AskUserQuestion, Bash(ls *), Bash(find *), Bash(wc *), Bash(rg *), Bash(cp *), Bash(git log *), Bash(git branch *), Bash(git status)
---

# Generate a prompt artifact from a plain request

`port-temp-page` turns a legacy source drop into a rebuild prompt. This skill runs the same
process from a different input: **a sentence from the user**. There is no `src/temp/`, no
`.cshtml`, no stylesheet to diff — the source material is the request plus this repo.

Everything else is identical. The output is a numbered artifact in `prompts/`, addressed to a
session with **no memory of this conversation**, that stands entirely on its own.

**This skill produces a prompt, not the implementation.** Do not start editing `src/` yourself
unless the user explicitly asks for the build in this same session.

## Step 0 — Ask the four setup questions. First. Always.

Before reading a single file, ask all four in **one** `AskUserQuestion` call. The first picks the
artifact's format; the other three decide which closing clauses the generated prompt carries.

```
AskUserQuestion — four questions, one call

  header "Format"    — what this skill writes
    "HTML artifact (Recommended)"  — prompts/prompt-<N>.html: copy button, sent checkbox,
                                     progress strip, model/effort badge. The project default.
    "Markdown file"                — prompts/prompt-<N>.md: plain, diff-friendly, readable in
                                     any editor. No copy button; the prompt sits in a fenced
                                     block. Pick this when the prompt will be pasted around,
                                     reviewed in a PR, or fed to another tool.

  header "Branch"    — Clause 0 of the generated prompt
    "New branch (Recommended)"     — the prompt opens with "Work on a new branch:
                                     prompt-<N>-<topic>. Create and switch to it before making
                                     any changes." Each prompt claims its own branch (Step 4).
    "Work in place"                — no branch is claimed or named. The prompt opens by telling
                                     the session to work on the branch that is already checked
                                     out and not to create one.

  header "Commit"    — Clause 8 of the generated prompt
    "Commit (Recommended)"         — the prompt ends by telling the session to switch to Sonnet
                                     at medium effort and commit via the git-commit-flow skill,
                                     one logical change per commit, never to main.
    "Leave uncommitted"            — the prompt says to leave the work uncommitted in the
                                     working tree for the user to review.

  header "Graphify"  — Clause 8 of the generated prompt
    "Run graphify (Recommended)"   — the prompt ends with `graphify --update` to refresh the
                                     project's knowledge graph.
    "Skip graphify"                — that step is omitted entirely.
```

These three answers gate what the **generated prompt** tells the next session to do. They do not
change what this session does with the artifact file: this skill writes `prompts/<file>` and
stops. It never branches, commits or runs graphify on its own — see Step 7.

Two exceptions, and only two:

- The user already answered one in their request ("generate it as md", "no commit step", "skip
  graphify"). Then use it, say which you used, and drop that question from the call — do not ask
  again.
- The user is regenerating an artifact that already exists. Read it first and keep its format,
  its numbers and its closing clauses stable. Ask only what the artifact cannot tell you.

Never guess an answer from the request's shape, and never default silently.

`AskUserQuestion` takes at most four questions. If the request is **also** ambiguous in a way
that changes what the prompt says, and the user's request already answered one of the four, put
the ambiguity in the freed slot — one round trip. If all four slots are taken, ask the ambiguity
in a second call immediately after, still before reading any files. Two round trips, never three.

## Step 1 — Understand the request

Restate the request to yourself in one sentence: *what will be true after the session that runs
this prompt is done?* If you cannot write that sentence, you do not yet have a request — ask.

Judge ambiguity the way you would for any task:

- **Different readings produce materially different prompts** → ask, per Step 0's slot rule.
- **Routine judgment call** → decide, and write the decision into the prompt as an explicit
  stated assumption ("Assumption: <X>. If that is wrong, stop and say so before building.").

Never write a prompt that tells the next session to "figure out what the user meant". The whole
value of the artifact is that the ambiguity was resolved here, once.

## Step 2 — Ground the request in the repo

**Never write a prompt from the request alone.** A prompt that says "add a testimonials
section" is worth nothing; a prompt that says "add a testimonials section to
`src/modules/landing/`, as a `ContentPageContent` block registered in `blocks.tsx:44`, with its
copy in `data/landing.ts`" is worth the session it saves.

Read, in this order, whatever the request touches:

1. `AGENTS.md` — the project's recorded decisions, bans, deferrals and placeholder routes. A
   prompt that contradicts it is a bug.
2. `.claude/skills/nextjs-app-architecture/references/README.md`, then the topic guides the
   request actually needs (`02-design-system.md`, `03-server-data-layer.md`, `07-forms.md`,
   `10-routing-and-app-shell.md` are the usual ones).
3. The module and route the request lands in — `src/modules/<name>/` and its page under
   `src/app/(site)/`. Read the real files, in full where they are small.
4. `src/app/globals.css` when colour, spacing or tokens are involved.
5. `src/app/(site)/` directory listing when links or navigation are involved — every link the
   prompt names must resolve to a real route or a deliberate placeholder.

Then work `references/grounding-checklist.md` end to end.

Two things are required of every statement of fact in the generated prompt, no exceptions:

- **A file reference.** `src/modules/landing/data/landing.ts:212`, not "the landing data file".
- **A stated consequence.** Say what will happen concretely: "`ConsultationForm` already posts
  to `submitConsultation`, so the new form reuses it rather than adding a second action."

Never state a suspicion as fact. If you did not open the file, do not describe what is in it.

## Step 3 — Decide how many prompts

**The default is one.** This skill exists for single, self-contained prompts, and a request that
fits in one session should never be cut into three.

Split only when the work genuinely cannot land in one session — a shared primitive that several
later passes depend on, or a change whose parts must merge in a fixed order. When you split:

- Each prompt claims its **own number**, and its own branch when Step 0 chose a new branch
  (Step 4).
- Each names its dependencies **by number**, never by position — "prompt 11 added …", never
  "step 1 added …". Add the branch when there is one: "prompt 11 (branch
  `prompt-11-form-primitives`) added …".
- They all go in **one** artifact, named for the range.

If you split, say why in your reply. Do not quietly turn a one-prompt request into five.

## Step 4 — Number the prompt, and claim its branch if Step 0 asked for one

```
ls prompts/
git branch -a
git log --oneline -15
```

`prompts/` is a **single running sequence shared with `port-temp-page`**, across both `.md` and
`.html` artifacts. The extension is irrelevant to numbering; the number is not.

Find the next free number `S`: take the highest number appearing in any `prompts/` filename —
for a range file such as `prompt-8-16.html` that is the **end** of the range, `16` — and add
one. Cross-check with `git branch -a`: every `prompt-<n>-*` branch must fall inside a range
already claimed by a file. Never reuse a number, even for a run that was abandoned.

A run producing `K` prompts claims `S … E`, where `E = S + K - 1`:

| Thing            | Shape                                                                       |
| ---------------- | --------------------------------------------------------------------------- |
| Artifact, K = 1  | `prompts/prompt-<S>.md` or `prompts/prompt-<S>.html`                          |
| Artifact, K > 1  | `prompts/prompt-<S>-<E>.<ext>` — three prompts starting at 10 → `prompt-10-12` |
| Branch           | `prompt-<n>-<short-kebab-topic>`, where `n` is that prompt's **own** number — only when Step 0 chose a new branch |
| Chip / ids       | the prompt's own number `n` — not its position in the file                     |
| Storage key      | `asansabt-prompt-` + `n` (HTML only); per-number keys cannot collide           |
| Badge            | model · effort, per prompt (see Step 5)                                       |

**Two prompts never share a number.** A file holding three prompts numbered 10–12 carries three
branches — `prompt-10-…`, `prompt-11-…`, `prompt-12-…` — one apiece, with a distinct kebab topic
each. Two branches carrying the same prompt number is the failure this rule prevents: the number
stops identifying the prompt, and `git branch` stops telling you what has been run.

**When Step 0 chose "Work in place"**, no branch is claimed and none is invented. Numbering is
unchanged — the `prompts/` sequence still advances, and `git branch -a` is still worth reading to
see which numbers have already been run. The templates' `{{BRANCH}}` placeholder takes the
currently checked-out branch followed by `(in place)`, e.g. `main (in place)`; read it with
`git branch --show-current`. Do not leave `{{BRANCH}}` empty and do not delete the field — the
HTML template is shared with `port-temp-page` and is never forked (Step 7).

If an artifact covering these numbers already exists, you are regenerating it — read it first
and keep its numbers, branch names, filename and format stable rather than claiming a fresh
range.

## Step 5 — Pick the model and effort for the badge

Judge the **implementation** session, not your own analysis. Weigh: how much code must be
written or reproduced faithfully, whether a new dependency or a data-layer move is involved, how
many decisions the prompt leaves open, and how many architectural constraints are lint-enforced.

| Signal                                                                                                                     | Badge                 |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Large surface, new dependency, RTL/interaction work, data-layer move, cross-module refactor, or a list of bugs to fix        | **Opus 5 · high**     |
| A well-understood change onto components that already exist                                                                  | **Sonnet 5 · high**   |
| Small, mechanical, additive change with no new patterns                                                                      | **Sonnet 5 · medium** |

The commit pass is always **Sonnet · medium**, per this project's established convention — this
applies only when Step 0 kept the commit clause; with "Leave uncommitted" there is no commit pass
to badge.

## Step 6 — Write the prompt body

Read `references/prompt-contract.md`. It lists the clauses every generated prompt carries — the
architecture non-negotiables, the verification gate, and the closing branch → commit → graphify
sequence — with the exact wording this project uses, and the wording each clause takes when Step
0 turned it off.

Clause 0 and the three items of Clause 8 are assembled from Step 0's answers. Everything else in
the contract is unconditional. Whichever way the answers fell, the prompt states it outright — it
never leaves the next session to guess whether to branch, commit or graphify.

The prompt is addressed to a session with **no memory of this conversation**. It must stand
alone: it names the files, states the goal, states what is already true in the repo, states what
"done" means. Never write "as discussed", "the approach we agreed", or "the file you looked at".

Write it as **plain text**, not Markdown-with-flourishes — it is going to be pasted into a chat
box, where a table renders as noise. Short numbered sections, one idea each.

## Step 7 — Emit the artifact

### If the user chose Markdown

Copy `assets/artifact-template.md` to `prompts/prompt-<N>.md` and fill its placeholders.

- The prompt text goes inside a fenced block so it survives copy-paste and diffs intact. The
  fence must be **longer than any fence inside the prompt text** — default to four backticks,
  and go to five if the prompt itself contains a four-backtick fence.
- Use the `text` info string. No syntax highlighter should touch a prompt.
- Nothing inside the fence is escaped or reflowed. `prompts/` is in `.prettierignore`, so
  `npm run format` will not rewrite it — keep it that way.
- The "sent" box is a Markdown task-list checkbox the user ticks by hand. There is no
  `localStorage` in a `.md` file; do not fake one.

### If the user chose HTML

The HTML template is **shared with `port-temp-page`** — one source of truth for the card markup,
the copy button, the checkbox wiring and the per-number storage keys:

```
cp .claude/skills/port-temp-page/assets/artifact-template.html prompts/prompt-<N>.html
```

Then fill its placeholders. **Do not fork it, and do not redesign it per run.** If it genuinely
needs a change, change it in `port-temp-page/assets/` so both skills get the fix.

Every per-card placeholder keyed on `{{N}}` takes the prompt's **own number** — chip text,
`data-card`, `data-prompt`, `data-copy`, `data-sent`, `data-seg`. `{{NUMBERS}}` is that list as
a JS array body, in order.

Escape the prompt text before it goes inside `<pre>`: `&` → `&amp;`, `<` → `&lt;`,
`>` → `&gt;`. An unescaped `<script>` or `&&` in the prompt body breaks the page silently.

### Either format

Verify after writing:

- `grep '{{' prompts/<file>` returns nothing — no placeholder survived.
- The card/section count matches the number range in the filename.
- Each prompt body's Clause 0 and Clause 8 match Step 0's answers — the branch line, the commit
  step and the `graphify --update` step are each present or absent, never half-stated.
- With a new branch: every branch name is distinct, each one's number matches its section's
  number, and the first line of each prompt body names that prompt's own branch.
- Working in place: no `prompt-<n>-<topic>` branch name appears anywhere in the artifact, and
  each `{{BRANCH}}` field carries the current branch plus `(in place)`.

This skill writes the artifact and stops. Do **not** create a branch, commit the file or run
`graphify --update` for it — Step 0's branch/commit/graphify answers govern the generated
prompt's own closing sequence, not this run. Leave `prompts/<file>` in the working tree for the
user, and do **not** call the Artifact tool: these are local files, not published pages.

## Step 8 — Report

Tell the user, briefly:

- The format you used, and whether you asked or they specified it
- The branch, commit and graphify answers, and the line each one produced in the prompt — e.g.
  "branches as `prompt-12-hero-tokens`, commits via git-commit-flow, no graphify step"
- What the prompt tells the next session to do, in one or two sentences
- What you grounded it against — the files you read that shaped it, with paths
- Any decision you could not make for them. Put these in the prompt as explicit decision points
  rather than choosing silently
- The artifact path, the branch name if there is one, and the model/effort you badged it with
  and why

Do not paste the whole prompt back into the reply. It is in the artifact.

## Standing rules

These hold on every run, and every generated prompt repeats them:

- **Ask the four setup questions before anything else** — format, branch, commit, graphify — in
  one `AskUserQuestion` call. `.md` and `.html` are both first-class outputs of this skill;
  neither is assumed, and neither is any closing clause.
- **Step 0's answers bind the generated prompt, not this run.** This skill writes the artifact
  and stops; it never branches, commits or runs graphify itself.
- **One number, one prompt, one branch.** The `prompts/` sequence is shared with
  `port-temp-page` and spans both extensions. A batch of K prompts claims K consecutive numbers,
  and the file is named for the range. When Step 0 chose a new branch, each prompt branches as
  `prompt-<its own number>-<topic>`; when it chose to work in place, no branch is claimed and
  none is invented — the numbering is unchanged either way.
- **The prompt stands alone.** No reference to this conversation, to "the analysis above", or to
  anything the receiving session cannot read for itself.
- **Every factual claim about the repo is verified.** If you did not open the file, the prompt
  does not describe it.
- **Never `--no-verify`, never `ignoreBuildErrors`, never commit to `main`.** Every prompt ends
  with the closing sequence in `references/prompt-contract.md`, cut to Step 0's answers. The
  four-command verification gate and the AGENTS.md update are never cut — they hold even when
  the prompt neither branches, commits nor graphifies.
