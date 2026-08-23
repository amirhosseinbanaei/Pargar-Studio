# The three-tier component system: ui / ds / form

**Read this when:** you are adding or restyling a component, deciding which tier it belongs to, a
class override is not winning, a skeleton causes layout shift, or an axe test fails.

How to structure a component library inside a Next.js App Router app so primitives stay
regenerable, product code depends on a stable API, and form wiring lives in exactly one place.
Targets Next.js 16 (15.x differences are noted inline) + React 19 + Tailwind v4 + CVA +
react-hook-form. Every rule states the failure it prevents — keep the reasoning when you copy the
rule.

> **Versions.** Every example leads with the **Next.js 16 / Tailwind v4** form; the 15.x / v3
> equivalent is given inline wherever they differ. This guide contains no zod; for the zod 3
> spellings used elsewhere in the set see `references/05-contracts-and-schemas.md`.

## Invariants

- **Design tokens are declared once, in the CSS entry (`@theme`), and consumed by name.** No hex
  values in a component or a variant table.
- **Dependencies flow one way: `ui/` → `ds/` → `form/`.** Nothing in `common/` imports from `app/`
  or feature modules.
- **Product code (`app/`, `modules/`) imports `ds/` and `form/` only — never `ui/`.** Enforce with
  a lint rule, not a convention.
- **`ui/` is vendored/generated and may be overwritten at any time**: lowercase filenames, `Base*`
  exports, structure only, zero product decisions.
- **`ds/` is your public API**: PascalCase files, stable props, `displayName` set, one file per control.
- **Style lives in `variants/*.ts` (CVA), never inline in a `ds/` component body.**
- **Every class list terminates in `cn()`, with caller overrides merged last.**
- **`ds/` knows nothing about forms; `form/` knows nothing about your API or transport.**
- **Controlled inputs never receive `undefined`** — coalesce to `''` / `false` / `[]`.
- **Skeletons mirror the exact box model of what they replace** (widths, heights, radii, gaps, breakpoints).
- **Every `ds/` control ships a story and a jest-axe test; axe failures fail CI.**
- **Icons are typed components from `outline` / `solid` / `brand` barrels**, drawn in `currentColor`.

---

## 0. The token layer (Tailwind v4, CSS-first)

Everything below this section — `variants/_shared.ts`, `cn()`'s custom class groups, every
`h-control` and `rounded-control` — is meaningless until the tokens exist. On Tailwind v4 they are
declared in **CSS**, not in a `tailwind.config.js`: v4 has no JS config file by default, and adding
one back is a downgrade you will spend the project fighting.

Three files, created once:

```js
// postcss.config.mjs  (repo root)
// v4 ships its PostCSS integration as a separate package; the v3 spelling
// (`tailwindcss: {}` + `autoprefixer: {}`) silently produces an empty stylesheet on v4.
export default { plugins: { '@tailwindcss/postcss': {} } };
```

```json5
// components.json  (repo root) — the component generator's config.
// This is what makes `ui/` REGENERABLE (§1). It must point at ui/, never at ds/:
// a regeneration overwrites everything in its `ui` alias, and pointing it at ds/ would
// erase your branded layer on the next `add` command.
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "tsx": true,
  "tailwind": { "css": "src/app/globals.css", "baseColor": "neutral", "cssVariables": true },
  "aliases": {
    "ui": "@/common/components/ui",
    "lib": "@/common/lib",
    "utils": "@/common/lib/utils"
  }
}
```

```css
/* src/app/globals.css — imported once, by app/layout.tsx. */
@import 'tailwindcss';

/* Class-based dark mode. v4 defaults `dark:` to the OS media query, which cannot be
   overridden by a theme toggle — so a user who picks "light" still gets dark chrome at
   night. This variant makes `.dark` on <html> authoritative. */
@custom-variant dark (&:is(.dark *));

/* ── The token scale. Every `--<namespace>-<name>` here becomes a utility:
      `--radius-control` -> `rounded-control`, `--height-control` -> `h-control`.
      That is the whole contract between this file and `variants/_shared.ts`. ────── */
@theme {
  /* TODO(project): replace with your palette. Keep the SEMANTIC names — components must
     never name a colour ("blue-600"), only a role ("primary"), or a rebrand is a
     repo-wide find-and-replace. */
  --color-surface: oklch(1 0 0);
  --color-surface-muted: oklch(0.97 0 0);
  --color-primary: oklch(0.55 0.2 260);
  --color-primary-foreground: oklch(0.99 0 0);
  --color-destructive: oklch(0.58 0.22 27);
  --color-control: oklch(0.87 0 0);
  --color-control-placeholder: oklch(0.65 0 0);

  /* The control metrics `_shared.ts` composes. One source, so a select trigger and an
     input can never end up 2px apart. */
  --height-control: 2.75rem;
  --min-width-control: 12rem;
  --radius-control: 0.625rem;
  --opacity-disabled: 0.5;

  --animate-in: fade-in 150ms ease-out;
  @keyframes fade-in {
    from { opacity: 0; }
  }
}

/* Dark overrides re-declare only the tokens that change. */
.dark {
  --color-surface: oklch(0.21 0 0);
  --color-surface-muted: oklch(0.27 0 0);
  --color-control: oklch(0.37 0 0);
}

/* ── @source inline: the non-obvious one. ────────────────────────────────────────
   v4's scanner reads your SOURCE TEXT. A class composed at runtime — by `prefix()`
   (§3), by a `data-[state=…]` selector a headless primitive sets, by any string
   concatenation — never appears literally in a file, so the utility is NOT GENERATED
   and the style is simply missing. It works in dev (where other files happen to
   contain the literal) and breaks in the production build, which is the worst
   possible failure timing.
   Enumerate every composed/dynamic class here. Verify once, by grepping the built CSS
   in `.next/static/css/` for one of them. */
@source inline("placeholder:text-sm placeholder:text-control-placeholder");
@source inline("focus:border-primary focus:ring-0 focus:outline-none");
@source inline("data-[state=open]:animate-in data-[side=bottom]:slide-in-from-top-2");
@source inline("data-[placeholder]:text-control-placeholder");
/* TODO(project): add every dynamic state class your primitives emit. */
```

Wire the sorter to this file in `.prettierrc` (`"tailwindStylesheet": "./src/app/globals.css"`,
already set in `templates/config/.prettierrc`), or your custom utilities sort as "unknown" and
drift to the end of every class list.

> **Version note.** The above is Next 16 / Tailwind v4. On Tailwind v3 the equivalents are a
> `tailwind.config.ts` with `theme.extend`, `darkMode: 'class'`, and `safelist: [...]` in place of
> `@source inline(...)`; `postcss.config` uses `tailwindcss` + `autoprefixer`. Nothing else in this
> guide changes.

---

## 1. The three tiers

| Tier          | Path                      | Filenames                                  | Exports                           | May import                             | Imported by                  |
| ------------- | ------------------------- | ------------------------------------------ | --------------------------------- | -------------------------------------- | ---------------------------- |
| Primitive     | `common/components/ui/`   | `select.tsx` (lowercase, generator-shaped) | `BaseSelect`, `BaseSelectTrigger` | headless lib, `cn`, `variants/_shared` | `ds/`, `form/` only          |
| Design system | `common/components/ds/`   | `Select.tsx` (PascalCase)                  | `Select`, `type SelectProps`      | `ui/`, `variants/`, `hooks/`, `icons/` | anything                     |
| Form-bound    | `common/components/form/` | `FormSelect.tsx`                           | `FormSelect`                      | `ds/`, react-hook-form                 | product code inside `<Form>` |

Siblings, same rules: `variants/` (CVA tables), `layout/` (page shells/spacing), `feedback/`
(`ErrorState`, `LoadingState`), `loader/` (`Skeleton`), `icons/`.

Why the split:

- **`ui/` is regenerable.** There are exactly two sanctioned ways to populate it: run a
  component generator pointed at it by `components.json` (§0), or hand-write the primitives there
  yourself. Either way the rule is the same — **nothing outside `ds/` and `form/` may import it,
  and a regeneration must never touch `ds/`.** If product code imports `ui/button` directly, a
  regeneration silently restyles every button and there is no file where you can intercept it.
- **`ds/` gives change a single edit site.** Adding a loading state to all buttons, changing focus
  rings, defaulting an `aria-*` — one file each, but only if nobody bypasses the tier.
- **`form/` quarantines the form library.** Swapping it, or changing how errors render, touches
  ~10 small files instead of every page.

### Enforce the boundary in lint

Convention is not enforcement — an agent under pressure imports `ui/` because autocomplete offered
it. The ban is the `DS_ONLY` pattern object in `templates/config/eslint.config.mjs`, applied to
Zones A, B and D; Zone C (`ui/`, `ds/`, `form/`, stories) is the one scope exempt from it. Do not
write a second config here: flat config **replaces** `no-restricted-imports` per matched scope
instead of merging, so a partial second copy silently disables the rest of the bans. See
`references/01-layering-and-boundaries.md` §7 for the zone table and that trap in full.

### `ui/` primitive shape

A primitive adds structure, a `data-slot` marker, and nothing else — no colors, sizes, spacing.

```tsx
// src/common/components/ui/input.tsx  ('use client')
export function BaseInput({ className, type, ...props }: React.ComponentProps<'input'>) {
  return <input type={type} data-slot="input" className={cn(className)} {...props} />;
}
```

`data-slot` earns its place twice: siblings target it without a wrapper class
(`*:data-[slot=select-value]:line-clamp-1`), and tests get a selector that survives a restyle.

**Version note.** With the unified package: `import { Select as SelectPrimitive } from 'radix-ui'`;
older setups use `import * as SelectPrimitive from '@radix-ui/react-select'`. Only `ui/` files
contain that import, so the migration is one directory.

---

## 2. `cn()` — the one merge helper

Copy `templates/src/common/lib/utils.ts`. Two rules govern how you use and extend it:

1. **Every custom utility that shadows a built-in Tailwind group must be registered** in its
   `extendTailwindMerge({ extend: { classGroups } })` block. Otherwise tailwind-merge cannot know
   `h-control` and `h-12` are the same group, BOTH survive the merge, and the winner is decided by
   CSS source order — an override that works in dev and breaks in the production bundle. Each token
   you add to `@theme` (§0) needs a line here.
2. **Merge order is load-bearing: variants first, state modifiers second, caller `className`
   last** — tailwind-merge keeps the last class of a conflicting group, so a caller merged early
   cannot override anything.

```tsx
className={cn(inputVariants({ variant }), hasLeftIcon && 'pl-9', classNames?.input)}
```

---

## 3. The `variants/` layer

**Put each control's CVA table in `common/components/variants/<control>.ts`, never in the component
file.** Why: a restyle becomes a diff in a file with no JSX and no hooks; two controls can share one
table (a combobox trigger must equal a select trigger); and `VariantProps<typeof xVariants>` types
the component's `variant`/`size` props, so type and CSS cannot drift.

### `_shared.ts` — cross-control tokens

Controls must agree on height, radius, border, disabled opacity and popover motion, or the app
looks assembled from three kits.

```ts
// src/common/components/variants/_shared.ts
export const base =
  'relative flex w-full items-center gap-2 h-control min-w-control rounded-control ' +
  'border border-control px-3 py-2 text-xs text-control outline-none md:text-sm';

// State token LISTS, unprefixed — each control applies its own prefix (below).
export const placeholderTokens = ['text-sm', 'text-control-placeholder'] as const;
export const focusTokens = ['border-primary', 'ring-0', 'outline-none'] as const;

export const disabled =
  'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-disabled';
// Same look for controls that cannot use :disabled (a div/button-based trigger).
export const disabledClass = 'pointer-events-none cursor-not-allowed opacity-disabled';
export const aria = 'aria-expanded:border-control aria-invalid:border-destructive';

// Every floating surface (select, combobox, date picker, menu) shares one look+motion.
export const popoverContent =
  'relative z-50 min-w-control overflow-y-auto rounded bg-popover shadow-md ' +
  'data-[state=open]:animate-in data-[side=bottom]:slide-in-from-top-2';
export const popoverItem =
  'flex w-full cursor-pointer select-none items-center gap-2 rounded-md p-2.5 text-sm hover:bg-accent';
```

The same _visual_ state needs a different Tailwind prefix per control: a native input uses
`placeholder:`, a listbox trigger `data-[placeholder]:`; focus is `focus:` on an input but
`data-[state=open]:` on a popover trigger. Store tokens once, prefix per control:

```ts
// src/common/components/variants/prefix.ts
/** prefix('placeholder:', ['text-sm']) -> 'placeholder:text-sm' */
export const prefix = (mod: string, tokens: readonly string[]) => tokens.map(t => mod + t).join(' ');
```

> Use the helper, not `tokens.join(' placeholder:')`. That trick needs a leading `null` element and
> a leading space inside the separator; getting either wrong silently emits one fused garbage class
> (`placeholder:text-smplaceholder:text-muted`) that no type check and no test catches.

> **Every class `prefix()` produces must be declared in `@source inline(...)`** — see §0. The
> scanner reads source text and will never see a composed class, so the utility is not generated
> and the style is missing in production only.

### A control's variant file

```ts
// src/common/components/variants/input.ts
import { cva } from 'class-variance-authority';
import { aria, base, disabled, focusTokens, placeholderTokens } from './_shared';
import { prefix } from './prefix';

export const inputVariants = cva(
  [base, 'w-full transition-all', prefix('placeholder:', placeholderTokens),
   prefix('focus:', focusTokens), disabled, aria],
  {
    variants: {
      variant: {
        outline: 'bg-surface',
        fill: 'border-0 bg-surface-muted',
        ghost: 'border-0 bg-transparent',
        error: 'border-destructive',
      },
      size: { sm: 'h-9 text-xs', md: 'h-11 text-sm', lg: 'h-12 text-base' },
    },
    defaultVariants: { variant: 'outline', size: 'md' },
  },
);
```

### Variant factory — shared defaults for undesigned controls

Do not invent a fresh table for every new `Card`/`Chip`/`Tile`; consume a factory in
`common/utils/variant-factory.ts` so v1 is already consistent with everything else.

```ts
export const baseVariants = cva('', { variants: {
  tone: { default: '', primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
          outline: 'border border-input bg-background hover:bg-accent',
          destructive: 'bg-destructive text-destructive-foreground' },
  size: { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-base' },
  radius: { none: 'rounded-none', md: 'rounded-lg', full: 'rounded-full' },
}, defaultVariants: { tone: 'default', size: 'md', radius: 'md' } });

export type BaseVariantProps = VariantProps<typeof baseVariants>;
/** One-line adoption in a new ds/ component: className={useBaseVariants(props)} */
export const useBaseVariants = (
  { tone, size, radius, className }: Partial<BaseVariantProps> & { className?: string },
) => cn(baseVariants({ tone, size, radius }), className);
```

| Situation                                           | Use                                                   |
| --------------------------------------------------- | ----------------------------------------------------- |
| Control has designed states (input, select, button) | dedicated `variants/<control>.ts` composing `_shared` |
| New/utility control with no bespoke design          | `baseVariants` / `useBaseVariants`                    |
| Two controls must look identical                    | one variant file imported by both                     |
| One-off spacing on one page                         | caller `className` — no new variant                   |

---

## 4. `ds/` prop-API conventions

Canonical component; every convention below appears in it.

```tsx
// src/common/components/ds/Input.tsx
'use client';
import * as React from 'react';
import type { VariantProps } from 'class-variance-authority';
import { BaseInput } from '@/common/components/ui/input';
import { inputVariants } from '@/common/components/variants/input';
import { useSlots, type SlotOptions } from '@/common/hooks/useSlots';
import { cn } from '@/common/lib/utils';

type InputProps = Omit<React.ComponentProps<typeof BaseInput>, 'className'> &
  VariantProps<typeof inputVariants> & {
    label?: React.ReactNode;
    error?: React.ReactNode;
    slots?: SlotOptions;
    /** Per-region overrides. This renders 4 elements, so one `className` would be
     *  ambiguous — it is deliberately omitted from the props. */
    classNames?: { container?: string; label?: string; input?: string; error?: string };
  };

const Input = React.forwardRef<React.ComponentRef<typeof BaseInput>, InputProps>(
  ({ label, error, slots, classNames, variant, size, ...props }, ref) => {
    const { withTooltip, leftIcon, rightIcon } = useSlots(slots, { iconClass: 'size-4 shrink-0' });
    return withTooltip(
      <div className={cn('flex w-full flex-col gap-1', classNames?.container)}>
        {label && (
          <label htmlFor={props.id} className={cn('text-xs font-medium', classNames?.label)}>{label}</label>
        )}
        <div className="relative flex items-center">
          {leftIcon && <span className="pointer-events-none absolute left-3 z-10">{leftIcon}</span>}
          <BaseInput
            ref={ref}
            aria-invalid={error ? true : undefined}
            className={cn(
              inputVariants({ variant: error ? 'error' : variant, size }),
              leftIcon && 'pl-9', rightIcon && 'pr-9',
              classNames?.input,           // caller wins: merged last
            )}
            {...props}
          />
          {rightIcon && <span className="pointer-events-none absolute right-3 z-10">{rightIcon}</span>}
        </div>
        {error && <span className={cn('text-xs text-destructive', classNames?.error)}>{error}</span>}
      </div>,
    );
  },
);
Input.displayName = 'Input';   // devtools names + Storybook docgen depend on it
export { Input, type InputProps };
```

### Standard prop vocabulary

| Prop                                          | Contract                                                                      | Why                                                           |
| --------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `value` / `defaultValue` / `onChange`         | one controllable value; non-native controls pass the **value**, not the event | product code and `form/` bind identically to every control    |
| `variant` / `size`                            | from `VariantProps<typeof xVariants>`, never hand-written unions              | type cannot drift from the CSS                                |
| `className`                                   | only on single-element components (Button, Badge); merged last                | unambiguous target                                            |
| `classNames`                                  | region map on multi-element components                                        | a bare `className` on a 4-element component is a coin flip    |
| `slots`                                       | `{ leftIcon, rightIcon, tooltip }`, or `{ trigger, item }` on composites      | one decoration API instead of six bespoke props               |
| `triggerProps` / `contentProps` / `itemProps` | escape hatch to the primitive, `Omit<…, 'className'>`                         | callers add `aria-label`/`side` without forking the component |
| `disabled` / `readOnly`                       | `disabled` blocks and dims; `readOnly` shows values, forbids edits            | view-vs-edit screens need both, distinctly                    |
| `error`                                       | `ReactNode`; also sets `aria-invalid`                                         | error styling and a11y state cannot drift apart               |
| `asChild`                                     | render the child element instead of the default tag                           | see composition below                                         |

### Controllable state

```ts
// src/common/hooks/useControllableState.ts
import { useCallback, useState } from 'react';

/**
 * Bridges controlled and uncontrolled state for one value. When `value !== undefined` the
 * hook is controlled: it echoes the prop and keeps no internal state. Otherwise it seeds
 * from `defaultValue`, tracks its own state, and still fires `onChange`. One API, both modes.
 */
export function useControllableState<T>({ value, defaultValue, onChange }: {
  value?: T; defaultValue?: T; onChange?: (value: T) => void;
}) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const isControlled = value !== undefined;
  const state = isControlled ? value : uncontrolled;
  const setState = useCallback((next: T) => {
    if (!isControlled) setUncontrolled(next);
    onChange?.(next);
  }, [isControlled, onChange]);
  return [state, setState] as const;
}
```

**A component must not change controlled-ness during its life.** The classic production failure: a
field renders before its data arrives so `value` is `undefined` (uncontrolled), then a `reset()`
supplies the real value and it flips to controlled. React warns, and headless libraries that keep
internal state can leave the trigger stuck on its placeholder while form state is already correct.
**Coalesce at the binding site**: `value={field.value ?? ''}`, `checked={field.value ?? false}`,
`value={field.value ?? []}`. An empty string is a _controlled_ "nothing selected" and still shows
the placeholder.

### Slots

One decoration API for every control, instead of `leftIcon`/`rightIcon`/`tooltipText`/`tooltipSide`
props re-invented per component.

```tsx
// src/common/hooks/useSlots.tsx (memoize the nodes; rightIcon is identical to leftIcon)
export interface SlotOptions {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  tooltip?: { content: React.ReactNode; side?: 'top' | 'bottom' | 'left' | 'right'; delayDuration?: number };
}

export function useSlots(slots?: SlotOptions, config?: { iconClass?: string }) {
  const cls = cn('shrink-0', config?.iconClass);
  const leftIcon = React.useMemo(
    () => slots?.leftIcon ? <span className={cls} aria-hidden="true">{slots.leftIcon}</span> : null,
    [slots?.leftIcon, cls]);
  const withTooltip = React.useCallback((children: React.ReactNode) => {
    if (!slots?.tooltip) return children;   // no wrapper when unused: no extra DOM, no provider
    return (
      <Tooltip delayDuration={slots.tooltip.delayDuration ?? 200}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={slots.tooltip.side ?? 'top'}>{slots.tooltip.content}</TooltipContent>
      </Tooltip>
    );
  }, [slots?.tooltip]);
  return { leftIcon, rightIcon, withTooltip,
           hasLeftIcon: !!slots?.leftIcon, hasRightIcon: !!slots?.rightIcon } as const;
}
```

Slot icons are `aria-hidden` — decoration. A control whose only label is an icon still needs
`aria-label`. Composite controls namespace their slots (`slots={{ trigger, item }}`).

### Composition: `asChild`

`asChild` swaps the rendered tag for the single child element and merges props onto it (the
`Slot.Root` line in `ui/button.tsx` below). Product code gets a link that looks exactly like a
button, without `<a>` inside `<button>`:

```tsx
<Button variant="secondary" size="sm" asChild>
  <Link href={`/billing/invoices/${invoice.id}`}>View invoice</Link>
</Button>
```

Nesting `<a>` in `<button>` is invalid HTML, breaks keyboard semantics, and axe flags it; `asChild`
merges props onto the child instead.

**Composed `ds/` components are ordinary `ds/` components** — `InputPassword` = `Input` + icon
button; `ButtonIcon` = `Button` + a square-size table. Compose inside `ds/`; never reach back into
`ui/` for the pieces.

**React 19 note:** `ref` is a plain prop, so new components can take `ref` in props and skip
`forwardRef`. Keep `forwardRef` if you also support React 18. Either way, set `displayName`.

### One control, end to end

Build **exactly one** control through all five files — `variants/button.ts` → `ui/button.tsx` →
`ds/Button.tsx` → `ds/Button.stories.tsx` (§7) → `ds/Button.test.tsx` — before building a second. It
proves the tiers, the tokens, the merge order and the a11y gate are all wired; every later control
is then a copy of a working shape rather than five independent guesses. `Button` is the canonical
first one because it is the only control that also exercises `asChild`. The four files below plus
the story in §7 are that chain, in order, and are meant to be copied verbatim and renamed.

```ts
// 1. src/common/components/variants/button.ts — the style table. No JSX, no hooks.
import { cva, type VariantProps } from 'class-variance-authority';
import { disabled } from './_shared';

export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 rounded-control font-medium',
    'transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary',
    disabled,
  ],
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-surface-muted text-control hover:bg-surface-muted/80',
        outline: 'border border-control bg-transparent hover:bg-surface-muted',
        ghost: 'bg-transparent hover:bg-surface-muted',
        destructive: 'bg-destructive text-primary-foreground hover:bg-destructive/90',
      },
      size: { sm: 'h-9 px-3 text-xs', md: 'h-control px-4 text-sm', lg: 'h-12 px-6 text-base' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
```

```tsx
// 2. src/common/components/ui/button.tsx — structure only. No colours, no sizes.
'use client';
import { Slot } from 'radix-ui';
import { cn } from '@/common/lib/utils';

export function BaseButton({
  asChild = false,
  className,
  ...props
}: React.ComponentProps<'button'> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button';
  return <Comp data-slot="button" className={cn(className)} {...props} />;
}
```

```tsx
// 3. src/common/components/ds/Button.tsx — THE public API. Product code imports this.
'use client';
import * as React from 'react';
import { BaseButton } from '@/common/components/ui/button';
import { buttonVariants, type ButtonVariantProps } from '@/common/components/variants/button';
import { cn } from '@/common/lib/utils';

export interface ButtonProps
  extends Omit<React.ComponentProps<typeof BaseButton>, 'className'>,
    ButtonVariantProps {
  /** Shows a spinner AND sets `disabled` — the two must never be settable apart, or a
   *  double-submit slips through while the spinner is up. */
  loading?: boolean;
  className?: string; // single-element component: a bare className is unambiguous here
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, loading = false, disabled, className, children, ...props }, ref) => (
    <BaseButton
      ref={ref}
      // `type` defaults to "submit" inside a <form>. An unstyled action button in a form
      // then submits it on click — the single most common "why did my form post?" bug.
      type={props.type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size }), className)} // caller merged last
      {...props}
    >
      {loading && (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </BaseButton>
  ),
);
Button.displayName = 'Button';
```

```tsx
// 4. src/common/components/ds/Button.test.tsx — the a11y gate, per control.
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('has no axe violations in its default and loading states', async () => {
    const { container } = render(
      <>
        <Button>Save</Button>
        <Button loading>Saving</Button>
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('is disabled while loading, so a double-submit is impossible', () => {
    render(<Button loading>Saving</Button>);
    expect(screen.getByRole('button', { name: 'Saving' })).toBeDisabled();
  });
});
```

`Button.stories.tsx` — the fifth file — is in §7. `asChild` usage and the `<a>`-inside-`<button>`
failure it prevents are described above.

---

## 5. The `form/` tier

| Layer             | Knows about                              | Never knows about                     |
| ----------------- | ---------------------------------------- | ------------------------------------- |
| `ds/Input`        | DOM, styling, a11y wiring                | react-hook-form, schemas              |
| `form/FormInput`  | field name, RHF context, error rendering | HTTP, server actions, schema contents |
| Feature component | schema, submit handler, server call      | class names, error markup             |

### Context plumbing (`form/Form.tsx`)

```tsx
'use client';
import * as React from 'react';
import { Slot } from 'radix-ui';
import { Controller, FormProvider, useFormContext, useFormState,
         type ControllerProps, type FieldPath, type FieldValues } from 'react-hook-form';
import { cn } from '@/common/lib/utils';

const Form = FormProvider;

const FormFieldContext = React.createContext<{ name: string }>({ name: '' });
const FormItemContext = React.createContext<{ id: string }>({ id: '' });

const FormField = <TValues extends FieldValues, TName extends FieldPath<TValues>>(
  props: ControllerProps<TValues, TName>,
) => (
  <FormFieldContext.Provider value={{ name: props.name }}>
    <Controller {...props} />
  </FormFieldContext.Provider>
);

function useFormField() {
  const field = React.useContext(FormFieldContext);
  const item = React.useContext(FormItemContext);
  const { getFieldState } = useFormContext();
  if (!field.name) throw new Error('useFormField must be used within <FormField>');
  // Subscribe BY NAME: this field re-renders only when its own state changes, not on
  // every keystroke anywhere in the form.
  const fieldState = getFieldState(field.name, useFormState({ name: field.name }));
  return { name: field.name, formItemId: `${item.id}-item`,
           formDescriptionId: `${item.id}-description`, formMessageId: `${item.id}-message`,
           ...fieldState };
}

function FormItem({ className, ...props }: React.ComponentProps<'div'>) {
  const id = React.useId();   // SSR-stable; a hand-rolled counter mismatches server vs client
  return (
    <FormItemContext.Provider value={{ id }}>
      <div data-slot="form-item" className={cn('grid gap-2', className)} {...props} />
    </FormItemContext.Provider>
  );
}

/** Injects id + aria wiring onto whichever ds/ control is its single child. */
function FormControl(props: React.ComponentProps<typeof Slot.Root>) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();
  return <Slot.Root id={formItemId} aria-invalid={!!error} {...props}
    aria-describedby={error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId} />;
}

function FormMessage({ className, ...props }: React.ComponentProps<'p'>) {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error?.message ?? '') : props.children;
  if (!body) return null;   // render nothing, not an empty box that reserves height
  return <p id={formMessageId} className={cn('text-xs text-destructive', className)} {...props}>{body}</p>;
}

export { Form, FormField, FormItem, FormControl, FormMessage, useFormField };
```

Add `FormLabel` the same way (reads `error` + `formItemId`, renders `htmlFor={formItemId}` and
`data-error` styling) so label, control, and message always share one generated id.

### A `Form*` control

```tsx
// src/common/components/form/FormInput.tsx
'use client';
import { type FieldValues, type Path, useFormContext } from 'react-hook-form';
import { Input } from '@/common/components/ds/Input';
import { FormControl, FormField, FormItem, FormMessage } from './Form';

export interface FormInputProps<TValues> extends React.ComponentPropsWithRef<typeof Input> {
  name: Path<TValues>;
  formItem?: React.ComponentProps<typeof FormItem>;
}

export function FormInput<TValues extends FieldValues>({
  name, formItem, type = 'text', ...props
}: FormInputProps<TValues>) {
  const form = useFormContext();
  return (
    <FormField
      name={name}
      control={form.control}
      render={({ field }) => (
        <FormItem {...formItem}>
          <FormControl>
            {/* `?? ''`: never hand a controlled input `undefined` (see §4). */}
            <Input {...props} type={type} name={field.name} value={field.value ?? ''}
                   onChange={field.onChange} onBlur={field.onBlur} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
```

Every other `Form*` is the same 20 lines around a different `ds/` control. The submit button reads
form state from context so no page wires `disabled` by hand:

```tsx
export function FormButton({ children, type = 'submit', ...props }: React.ComponentProps<typeof Button>) {
  const { formState: { isValid, isDirty, isSubmitting } } = useFormContext();
  return <Button type={type} disabled={!isValid || !isDirty || isSubmitting} {...props}>{children}</Button>;
}
```

### Usage in product code

This tier is only the binding layer. How a feature component assembles it — schema, `useForm`,
`defaultValues`, submit handler, and mapping the server's field-keyed validation errors back onto
inputs — is `references/07-forms.md` §3. Do not duplicate that shape here.

> **React Compiler × react-hook-form (React 19 / Next 15–16).** The compiler memoizes reads of
> RHF's `formState` Proxy, so `isValid`/`isDirty` stop updating and submit buttons never enable. In
> a form-heavy app leave `reactCompiler` off until the form components are proven compiler-safe,
> and put the reason in `next.config.ts` so nobody re-enables it blindly. Full symptom list and the
> per-component fix: `references/07-forms.md` §9.

---

## 6. `feedback/` and `loader/`

```tsx
// feedback/LoadingState.tsx — route-level fallback
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
      <span aria-hidden className="size-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

// feedback/ErrorState.tsx  ('use client' — it takes an onRetry callback)
export function ErrorState({ title = 'Something went wrong', description = 'Please try again.',
  onRetry }: { title?: string; description?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-xl">{title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      {onRetry && <Button onClick={onRetry}>Try again</Button>}
    </div>
  );
}

// loader/Skeleton.tsx
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="skeleton" className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}
```

`role="status" aria-live="polite"` and `role="alert"` are not decoration: without them a non-visual
user gets silence during a load and no announcement on failure. Wire both at route boundaries —
`app/(app)/billing/loading.tsx` returns `<BillingSkeleton />`, `error.tsx` (a client component
receiving `{ error, reset }`) returns `<ErrorState onRetry={reset} />` after logging the error in an
effect.

### Skeletons mirror the real box, exactly

**A skeleton reproduces the wrapper, widths, heights, radii, gaps and breakpoints of what it
replaces.** A centered spinner in a card grid collapses the container to zero height; when data
lands everything below jumps. That is a layout-shift regression and it makes the load _feel_ slower.

```tsx
// CatalogCard.tsx                                  // CatalogCardLoader.tsx
<div className="relative w-[305px] rounded-xl       <div className="relative w-[305px] rounded-xl
     border bg-card p-5 pt-10">                          border bg-card p-5 pt-10">
  <BookmarkIcon className="absolute top-5 left-5      <Skeleton className="absolute top-5 left-5 size-6" />
       size-6" />
  <div className="flex flex-col items-center          <div className="flex flex-col items-center gap-y-6">
       gap-y-6">
    <Image width={80} height={80} … />                  <Skeleton className="size-20 rounded-full" />
    <p>{product.name}</p>                               <Skeleton className="h-5 w-28 rounded-full" />
    <span className="flex gap-2 text-sm">               <span className="flex items-center gap-2">
      <TagIcon className="size-5" />{product.sku}         <Skeleton className="size-5 rounded-full" />
    </span>                                               <Skeleton className="h-4 w-24 rounded-full" />
                                                        </span>
    <Button size="sm">Open</Button>                     <Skeleton className="h-11 w-44 rounded-full" />
  </div>                                              </div>
</div>                                              </div>
```

- Put the loader **next to** the component (`CatalogCardLoader.tsx` beside `CatalogCard.tsx`) so a
  layout change to one visibly demands a change to the other.
- Keep skeletons **server-safe** (no hooks, no `'use client'`) so they render from `loading.tsx`
  and from server `<Suspense fallback={…}>`.
- Mark the wrapper `aria-hidden` when a sibling `role="status"` already announces loading —
  otherwise a screen reader narrates a tree of empty boxes.
- Repeat rows with `Array.from({ length: n })` matching the real list's page size.
- For a whole route, compose a page skeleton that mirrors the real regions rather than one page
  spinner, so each area resolves visually in place.

---

## 7. Storybook and the accessibility gate

| Gets a story                                                                                                  | Does not                                                    |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Every `ds/` control, one story per meaningful state (default, filled, empty, disabled, read-only, error, max) | `ui/` primitives — no product API, replaced on regeneration |
| Page-level compositions worth reviewing in isolation (`Pages/Checkout`)                                       | one-off layout wrappers                                     |

Copy `templates/config/storybook-main.ts` → `.storybook/main.ts` and
`templates/config/storybook-preview.tsx` → `.storybook/preview.tsx`. Two settings in them are
load-bearing rather than taste: the single recursive `stories` glob (list folders individually and
half your stories are silently never built), and `parameters: { a11y: { test: 'error' } }` — which
makes an axe violation **fail** the story instead of annotating a panel nobody opens. The preview
also ships a writing-direction toolbar toggle; set its `defaultValue` to your app's primary
direction and use it to catch the usual breakages (absolutely-positioned slot icons, chevrons,
popover alignment) that are invisible when stories only ever render one direction.

The doc comment above `meta` becomes the autodocs page — spend a sentence on the interaction model.
This is the fifth and last file of the one-control-end-to-end chain in §4:

```tsx
// src/common/components/ds/Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/nextjs';
import { Button } from './Button';

/**
 * The single-element control. `loading` also disables, so a double-submit is impossible;
 * `asChild` renders a link that looks like a button without nesting <a> in <button>.
 * Toggle the toolbar Direction control to verify icon/spinner placement mirrors.
 */
const meta = {
  title: 'DS/Button',
  component: Button,          // stateless control: `component:` + args drive the Controls panel
  parameters: { layout: 'centered' },
  args: { children: 'Save' },
} satisfies Meta<typeof Button>;
export default meta;

export const Primary: StoryObj<typeof meta> = {};
export const Destructive: StoryObj<typeof meta> = { args: { variant: 'destructive' } };
export const Loading: StoryObj<typeof meta> = { args: { loading: true, children: 'Saving' } };
export const Disabled: StoryObj<typeof meta> = { args: { disabled: true } };
```

**Stateful controls (select, combobox, date picker) need a render wrapper instead** — a story's
`args` cannot hold React state, so write a small `Demo` component holding `useState` and export
`{ render: () => <Demo … /> }` per state. Keep `satisfies Meta` either way: without it, a renamed
prop still type-checks in the story.

### jest-axe is the CI gate

A Storybook panel is not a gate — a11y must fail `npm test`. `expect.extend(toHaveNoViolations)`
and the jsdom API stubs that headless primitives need on mount live in
`templates/config/test-setup.ts`; see `references/09-mocking-and-testing.md` §1 for what belongs in
that file and what must never be imported into it. The canonical test file is `ds/Button.test.tsx`
in §4; two things generalize from it to every other control:

- **Assert the always-rendered surface.** A portalled listbox or popover only mounts on open, so
  axe over the closed trigger is what CI can check cheaply — and `triggerProps` is the component's
  channel for giving that trigger an accessible name.
- **Pair the axe assertion with one behavioural assertion** (loading implies disabled, error sets
  `aria-invalid`). Axe alone passes a component whose props do nothing.

jest-axe ships Jest matcher types only — add a `.d.ts` declaring `toHaveNoViolations()` on Vitest's
`Assertion`, or the assertion will not type-check. Keep `jsx-a11y` rules at `error` too: axe checks
rendered output, `jsx-a11y` checks source patterns; you want both.

---

## 8. Icons

```
src/common/icons/
  outline/  Chevron.tsx  Search.tsx  index.ts
  solid/    Check.tsx    Triangle.tsx index.ts
  brand/    Google.tsx   Github.tsx   index.ts
```

- **Split by weight, not by feature.** `outline` and `solid` are two visual systems; one folder
  guarantees screens that mix both. `brand` is separate because those glyphs carry
  licensing/trademark constraints and must not be recolored or restyled.
- **Icons are hand-written components, not raw `.svg` imports.** A component takes `className`,
  defaults its own size, and tree-shakes; a raw import needs an SVGR loader plus an ambient module
  declaration and gives no typed props. If you do use SVGR, add
  `declare module '*.svg' { const C: React.FC<React.SVGProps<SVGSVGElement>>; export default C; }`
  in `src/common/types/svg.d.ts`.
- **One shared prop type:**

```ts
// src/common/types/svg.ts
import type { RefAttributes, SVGProps } from 'react';
export interface SvgIcon extends RefAttributes<SVGSVGElement>, Partial<SVGProps<SVGSVGElement>> {
  size?: string | number;
}
```

- **Draw with `currentColor`, size via `className`**, so an icon inherits the color of whatever
  `ds/` control hosts it and needs no color prop.
- **Barrel with an `Icon` suffix** so call sites never collide with domain names
  (`Search` the icon vs `Search` the component): `export { Search as SearchIcon } from './Search';`

```tsx
export function Chevron({ className, ...props }: SvgIcon) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         aria-hidden="true" className={cn('size-4 text-current', className)} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m6 9 6 6 6-6" />
    </svg>
  );
}
```

`aria-hidden="true"` by default — an icon inside a labelled control is decoration. When the icon is
a button's only content, the _button_ carries `aria-label`.

---

## Anti-patterns

| Never                                                            | Why it breaks                                                                                                                                    | Do instead                                                               |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Import `ui/button` from a page or feature                        | Regenerating the primitive silently restyles the product; no single place to change button behavior app-wide                                     | Import `ds/Button`; add the lint ban in §1                               |
| Write `cva(...)` inline in a `ds/` component                     | Restyles now touch hook/JSX code; two controls cannot share the table                                                                            | `variants/<control>.ts`, consumed via `VariantProps`                     |
| `className={\`${inputVariants({variant})} ${className}\`}`       | No conflict resolution: `px-4` and `px-8` both survive and CSS order decides — an override that "sometimes works"                                | `cn(inputVariants({ variant }), className)`                              |
| Put the caller's `className` before the variant classes          | tailwind-merge keeps the _last_ conflicting class, so the caller loses                                                                           | Caller `className`/`classNames.x` always merged last                     |
| Expose a bare `className` on a multi-element component           | Ambiguous target; callers style the wrapper meaning the input, then fight it with `!important`                                                   | Omit `className`; expose a `classNames` region map                       |
| `value={field.value}` when the value may be `undefined`          | Mounts uncontrolled, flips to controlled when data lands: React warning, and the control can stay on its placeholder while form state is correct | `?? ''` / `?? false` / `?? []`, plus complete `defaultValues`            |
| Hand-written `variant: 'primary' \| 'ghost'` prop union          | Drifts from the CVA table; a deleted variant still type-checks                                                                                   | `VariantProps<typeof xVariants>`                                         |
| `ds/` component importing react-hook-form                        | Control becomes unusable outside a form (filters, toolbars, stories) and stories need a fake provider                                            | RHF stays in `form/`; `ds/` takes `value`/`onChange`                     |
| `form/` component importing your API client or server actions    | Controls become untestable and coupled to transport; error mapping duplicates per field                                                          | Feature component owns submit; `form/` only binds fields                 |
| Centered spinner as the fallback for a card grid or detail page  | Container collapses to zero height, then content jumps in — layout shift plus a slower-feeling load                                              | Shape-matched `Skeleton` composition beside the real component           |
| `'use client'` on a skeleton                                     | Cannot render from `loading.tsx`/server `<Suspense>` without shipping JS for a static box                                                        | Keep skeletons hook-free and server-safe                                 |
| Icon-only control with no accessible name                        | axe violation; unusable by screen reader and voice control                                                                                       | `aria-label` on the button, or via `triggerProps`                        |
| Treating the Storybook a11y panel as the gate                    | Nobody opens a panel in CI; violations ship                                                                                                      | `a11y: { test: 'error' }` **and** a jest-axe test per `ds/` control      |
| Building class names at runtime without safelisting              | Tailwind's scanner never sees the composed class; the CSS is missing only in production builds                                                   | Keep literals scannable, or `@source inline(...)` (v4) / `safelist` (v3) |
| Adding a fourth tier (`components/shared`, `components/common2`) | The one-way rule stops being checkable and lint cannot express it                                                                                | Extend `ds/` or `variants/`; promote shared feature code into `common/`  |
