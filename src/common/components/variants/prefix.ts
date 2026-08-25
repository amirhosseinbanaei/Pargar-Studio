// src/common/components/variants/prefix.ts
/**
 * `prefix('placeholder:', ['text-sm']) -> 'placeholder:text-sm'`
 *
 * The same VISUAL state needs a different Tailwind prefix per control: a native
 * input uses `placeholder:`, a listbox trigger `data-[placeholder]:`; focus is
 * `focus:` on an input but `data-[state=open]:` on a popover trigger. Storing
 * the tokens once and prefixing per control is what keeps the two from drifting.
 *
 * Use this helper, never `tokens.join(' placeholder:')`. That trick needs a
 * leading `null` element AND a leading space inside the separator; getting
 * either wrong silently emits one fused garbage class
 * (`placeholder:text-smplaceholder:text-t-xlo`) that no type check and no test
 * catches.
 *
 * EVERY class this produces must also appear in an `@source inline(...)` in
 * `src/app/globals.css`. Tailwind v4's scanner reads source TEXT and will never
 * see a class composed at runtime, so the utility is not generated and the style
 * is missing — in the production build only.
 */
export const prefix = (mod: string, tokens: readonly string[]): string =>
  tokens.map(t => mod + t).join(' ');
