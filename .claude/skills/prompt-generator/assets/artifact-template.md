<!--
  TEMPLATE — copy to prompts/prompt-<S>.md (one prompt) or prompts/prompt-<S>-<E>.md
  (a batch numbered S..E) and fill every {{PLACEHOLDER}}.

  Numbering: prompt numbers are one running sequence across prompts/, shared with the
  port-temp-page skill and spanning both .md and .html artifacts. A batch of K prompts claims
  K consecutive numbers. Every heading and branch below carries the prompt's OWN number — a
  file covering prompts 10..12 has "## Prompt 10" .. "## Prompt 12", never "## Prompt 1".

  Placeholders:
    {{H1}}           short noun phrase, e.g. "Landing testimonials section"
    {{RANGE}}        "Prompt 10" or "Prompts 10-12"
    {{LEDE}}         2-3 sentences: what this asks for, and what will be true when it lands
    {{INDEX}}        one "- Prompt <n> — <title>" line per prompt, in order. Drop the whole
                     "## Index" block when there is only one prompt.
    {{FOOTER_NOTE}}  one line: what must be true before these prompts are sent

  Per prompt section:
    {{N}}            the prompt's own number
    {{TITLE}}        e.g. "Add the testimonials section to the landing page"
    {{BADGE}}        e.g. "Opus 5 - High effort"
    {{BRANCH}}       "prompt-{{N}}-<short-kebab-topic>" - unique per prompt, never shared.
                     When Step 0 chose to work in place, this is the currently checked-out
                     branch plus "(in place)", e.g. "main (in place)" - never left empty.
    {{SUMMARY}}      one sentence of what the prompt covers
    {{PROMPT_TEXT}}  the prompt, verbatim, inside the fence - nothing escaped, nothing reflowed

  The "- [ ] Sent" line is a task-list checkbox the user ticks by hand — one per prompt, and
  the only place sent-state lives. A .md artifact has no localStorage; do not fake one.

  The fence below is four backticks so the prompt may contain ordinary ``` blocks. If the
  prompt text itself contains a four-backtick fence, widen this one to five.

  prompts/ is in .prettierignore, so this file is never reformatted. Keep it that way.

  Delete this comment block from the generated file.
-->

# {{H1}}

**{{RANGE}}**

{{LEDE}}

## Index

{{INDEX}}

---

<!-- ===== repeat this section once per prompt ===== -->

## Prompt {{N}} — {{TITLE}}

- **Model:** {{BADGE}}
- **Branch:** `{{BRANCH}}`
- [ ] Sent

{{SUMMARY}}

````text
{{PROMPT_TEXT}}
````

---

<!-- ===== end section ===== -->

> {{FOOTER_NOTE}}
