# Zod contracts at the network edge

**Read this when:** you are modelling a backend response or an action input, a `ZodError` blanked a
route, a field arrived `null` that you did not expect, or you need a form schema next to a wire
schema.

Every byte entering your app from somewhere you don't control — an HTTP response, a Server Action
argument, `process.env`, `searchParams`, a webhook — is parsed by a schema at the boundary and
never re-checked afterwards. Types are **derived** from those schemas, so a contract change is a
type error rather than a runtime surprise. See `references/03-server-data-layer.md` for the client
that calls `.parse()` and `references/04-actions-and-mutations.md` for action inputs.

## Invariants

- **Parse at the boundary, exactly once; trust the parsed value everywhere inside.** Components
  receive typed data, never `unknown`. Re-validating downstream hides that the boundary was never
  guarded.
- **Derive every wire type with `z.infer`. Never hand-write an interface mirroring a schema.** Two
  declarations of one shape drift within a sprint and the compiler cannot tell you which one lies.
- **Read schemas are tolerant at the leaves and strict at the shape.** One unanticipated `null` in
  one leaf throws a `ZodError` in the service and blanks the entire route — the failure is total,
  not partial.
- **Write schemas are exact.** Tolerance on a write body silently ships garbage upstream.
- **One schema module per resource, mirroring the services layer**, plus `envelopes.ts`,
  `helpers.ts`, `enums.ts`.
- **A schema module imports only `zod`, other schema modules, and pure validators** — never a
  component, hook, service, or `server-only`. Form schemas are imported by client components; one
  `server-only` in that graph breaks the client build.
- **Enum values live in exactly one `as const` array** feeding the schema, the type, and the option
  list. Labels are localized copy and stay in the UI layer.
- **Wire schemas and form schemas are separate files with separate jobs.** Conflating them applies
  API rules to humans and human rules to the API.
- **When a spec exists, schemas transcribe it exactly, and a spec change lands as its own commit
  before the code change.** The spec diff is the review artifact.
- **Schema tests parse real captured payloads, not payloads you imagined.** The spec says what
  should arrive; the fixture says what does.
- **No `as`, no `any`, no `@ts-expect-error` at a boundary.** A cast is an unverifiable claim;
  `.parse()` is one the runtime enforces.

---

## Version compatibility — read before writing a schema

Every example below is **Next.js 16 + zod 4**. The 15.x / zod 3 equivalent is given inline.

| Concern                | zod 4 (used here)                                 | zod 3                                     |
| ---------------------- | ------------------------------------------------- | ----------------------------------------- |
| Email / URL / UUID     | `z.email()`, `z.url()`, `z.uuid()`                | `z.string().email()`, `.url()`, `.uuid()` |
| Records                | `z.record(keySchema, valueSchema)` — key required | `z.record(valueSchema)` allowed           |
| Strict / loose objects | `z.strictObject()`, `z.looseObject()`             | `.strict()`, `.passthrough()`             |
| Error formatting       | `z.flattenError(err)` / `z.treeifyError(err)` / `z.prettifyError(err)` | `err.flatten()` / `err.format()` |
| Enum message shorthand | `z.enum(values, 'Pick one')`                      | `z.enum(values, { errorMap })`            |
| Form resolver          | `standardSchemaResolver` (library-agnostic) or `zodResolver` | `zodResolver`                  |

**One spelling for field errors across this skill: `z.flattenError(err).fieldErrors`.** It is what
`templates/src/common/config/env.ts` uses and what `zodFieldErrors` in
`references/04-actions-and-mutations.md` §1 wraps. `z.treeifyError` is for nested display,
`z.prettifyError` for a human-readable string in a boot failure — neither is the field-binding form.

`.catch`, `.transform`, `.refine`, `z.infer`, discriminated unions, and generic factories are
identical in both majors. Pin the major in `package.json` (`zod@^4`); the two are not
interchangeable at these call sites.

**Framework:** `params`, `searchParams`, and `cookies()` are Promises on 16 — parse *after*
awaiting. On 15.x and earlier they are synchronous objects; drop the `await`.

```ts
const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  q: z.string().trim().max(100).catch(''),
  sort: z.enum(['newest', 'oldest']).catch('newest'),
});
const query = listQuerySchema.parse(await searchParams); // Next 15: parse(searchParams)
```

`.catch()` is correct for URL input: a hand-edited query string must degrade to defaults, never 500
the route. (`z.coerce` is acceptable *here* because `.catch()` backstops it and the input is always
a string.) Note that `searchParams` values are `string | string[] | undefined` — model repeated keys.

---

## 1. Where validation happens

| Boundary                  | Guard                                            | Failure mode if unguarded                                                                 |
| ------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| HTTP response             | `schema.parse(raw)` in the API client            | Every component downstream is coded against a shape nobody verified                       |
| Server Action argument    | `schema.safeParse(input)` as the first statement | An action is a public endpoint reachable with `curl`; the form is not a security boundary |
| `process.env`             | one `safeParse` at module load, throw on failure | A typo'd env var surfaces as a 500 on the busiest route                                   |
| `searchParams` / `params` | query schema with `.catch()` defaults            | A hand-edited URL 500s the page                                                           |
| Third-party webhook       | strict schema + signature check                  | You process a payload shaped nothing like the docs                                        |
| Form input                | form schema via the resolver                     | UX-level only — the action re-validates                                                   |

The API client is the one place `.parse()` appears for responses. Its signature —
`apiFetch<S extends z.ZodTypeAny>(path, schema, options?): Promise<z.infer<S>>` — is what makes
that enforceable, and `templates/src/common/services/api-client.ts` is the implementation
(`references/03-server-data-layer.md` §3 owns it; do not re-derive it here).

`Promise<z.infer<S>>` is the whole trick: the caller's return type is computed from the schema it
passes, so a service function needs no annotation and can never annotate a lie. Two corollaries for
schema authors: the call is `schema.parse` (throwing), never `safeParse` plus a fallback shape; and
nothing may add `as z.infer<S>` on top of it, because `.transform()`-based schemas have genuinely
different input and output types and an assertion there would absorb the mismatch.

**Client-then-server validation is not "twice."** The form schema and the action's input schema
guard two different trust boundaries. Skipping the server one because "the form already checked" is
the most common way an app ships an unguarded write endpoint.

---

## 2. Layout: schemas mirror services

```
src/common/schemas/
  envelopes.ts   # response wrappers + error shapes (generic factories)
  helpers.ts     # tolerant leaf primitives
  enums.ts       # every wire enum, once
  account.ts     # ← account-service.ts      invoice.ts   # ← invoice-service.ts
  __tests__/fixtures/                        # captured real payloads
src/common/validators/index.ts               # reusable fragments (email, password, phone…)
src/common/utils/to-options.ts
src/modules/billing/schemas/invoice-form.ts  # FORM schema: module-local, UX rules, localized copy
```

Form schemas live with the feature that renders them; promote one to `common/` only when a second
module imports it (see `references/01-layering-and-boundaries.md`). Head every schema module with a
comment naming the spec document it transcribes and any behaviour the spec omits — that comment is
where the next agent learns _why_ a field is optional.

---

## 3. Derive types, never write them

```ts
/** Read model. Tolerant leaves (§5), strict shape. Referenced throughout this file. */
export const invoiceSchema = z.object({
  id: z.number(),
  account_id: z.number(),
  status: invoiceStatusEnum.catch('draft'),
  amount_due: looseDecimal,
  due_date: z.string().nullable(),
  note: looseString,
});
export type Invoice = z.infer<typeof invoiceSchema>;
```

Why: with a hand-written `interface Invoice`, a backend rename (`amount_due` → `amount_total`)
throws at runtime while the interface still compiles — the type system actively reassures you while
the page is broken. With `z.infer` the rename is a compile error at every use site.

The only hand-written types are ones with no wire counterpart: UI prop types and discriminated
result unions (`type ActionResult = { ok: true; … } | { ok: false; … }`).

Type fixtures with `satisfies`, never `as` —
`const fixture = { … } satisfies z.input<typeof invoiceSchema>`. `z.input` is the pre-transform
shape, `z.infer` (= `z.output`) the post-transform one; they diverge the moment you use
`.transform()` or `.default()`. Annotate write payloads with `z.input`, read models with `z.infer`.

---

## 4. Envelopes: generic factories, unwrapped at the service

Model each wrapper **once**, generically, and strip it in the service so no module sees
`.data.results[0]`.

Copy `templates/src/common/schemas/envelopes.ts`. It exports `successEnvelope(data)`,
`errorEnvelopeSchema`, `messageEnvelopeSchema`, `fieldErrorsSchema` / `WireFieldErrors`,
`paginated(item)` and the `Paginated<T>` interface. Three things about it are decisions, not
mechanics:

- **`message` is `.nullable().optional()` everywhere.** Backends emit all three forms — absent,
  `null`, present — across endpoints of the same API, and the copy that forgot one throws on the
  first response that omits it.
- **`WireFieldErrors` is deliberately not called `FieldErrors`.** The wire shape is an array of
  messages per field (`{ email: ['already taken'] }`); the shape the UI binds is one message per
  field, and it is `FieldErrors` in `@/common/errors/types`, produced by `mapError`
  (`references/06-error-system.md` §1). Conflating the two names is exactly how `errors.email?.[0]`
  ends up inside a component.
- **`paginated()` puts `.catch()` on `count` / `next` / `previous` as well as `results`**, which
  looks like a violation of §5's "never `.catch()` an identity-ish field" and is not: these are
  **display metadata, not identity**. A missing `count` costs a pager label; a fabricated `id`
  costs a mutation against the wrong record. Never extend the leniency to an id, an amount, or a
  permission flag. Cursor APIs get their own factory on the same rule
  (`{ items: z.array(item).catch([]), next_cursor, has_more }`).

Instantiate per resource, then infer — this is how you get a named type from a generic factory:

```ts
export const paginatedInvoicesSchema = paginated(invoiceSchema);
export type PaginatedInvoices = z.infer<typeof paginatedInvoicesSchema>;
// { count; next; previous; results: Invoice[] }

export async function getInvoice(id: number): Promise<Invoice> {
  const res = await apiFetch(`/billing/invoices/${id}/`, successEnvelope(invoiceSchema));
  return res.data; // envelope stops at the data layer
}
```

Why unwrap: the envelope is a transport accident. If it leaks, every component knows `.data`, and
the day one endpoint returns the payload bare you rewrite twenty call sites instead of one function.

**Non-uniform APIs are normal** — real backends grow envelopes on some endpoints and not others. Do
not wrap the bare ones in a fake envelope to look tidy; model each endpoint as it actually responds
and note the split in the module header. A schema that lies fails at runtime, where lies cost most.

---

## 5. Defensive parsing: tolerant leaves, strict shape

> **The rule paid for in outages:** a strict schema on a field the backend can return `null` for
> takes down the entire page. Validation failure is not graceful degradation — the `ZodError`
> throws inside the service, propagates past every component, and hits the nearest error boundary.
> So: **strict about the shape (which keys exist), forgiving about the leaves (what a value holds).**

Copy `templates/src/common/schemas/helpers.ts`. It carries the leaf primitives every read schema
composes — `looseString` / `looseBool` / `looseNumber` (accept `null`, normalize it), `looseDecimal`
(money arriving as `"18.50"`, or `null`, or absent), `numberFromString`, `emptyToNull`,
`nullToUndefined`, `isoDate`, and `tolerantEnum(values, fallback)`.

Four rules govern how you extend them:

1. **`.nullable()`, deliberately not `.nullish()`.** `.nullish()` also makes the object key optional,
   rippling a `?` through every consumer and every derived write body.
2. **These are READ-only helpers.** On a write payload, silently turning a `null` into `''` on the
   way out overwrites real data with an empty string.
3. **`isoDate` fails loudly** while its neighbours are tolerant. `new Date('not a date')` yields an
   Invalid Date that poisons every comparison, sort and format downstream and surfaces as `NaN` in
   the UI, far from the cause.
4. **Never use `z.coerce.number()` on wire data:** `""`, `null`, `false` and `[]` all coerce to `0`,
   so a missing value turns into a real-looking zero in a total. `numberFromString`'s explicit regex
   rejects them instead.

### Choosing the modifier

| Modifier      | Accepts                     | Inferred type              | Use when                                          |
| ------------- | --------------------------- | -------------------------- | ------------------------------------------------- |
| `.optional()` | key absent                  | `k?: T`                    | The API genuinely omits the key on some responses |
| `.nullable()` | `null` value                | `T \| null`                | Key always present, value may be null             |
| `.nullish()`  | both                        | optional **and** `\| null` | You truly mean both — it ripples, so justify it   |
| `.default(v)` | `undefined` → `v`           | drops `undefined`          | Write bodies and query params                     |
| `.catch(v)`   | **any** parse failure → `v` | always `T`                 | Non-critical fields, unknown enums, list bodies   |

`.catch()` is the only one that survives a value you did not anticipate — it swallows a type
mismatch, not just an absence. Right for status enums, tag arrays, metadata objects. **Wrong for
identity fields:** `.catch(0)` on an `id` yields a row pointing at nothing and a mutation that
updates the wrong record. Never `.catch()` an id, an amount, or a permission flag.

### Object strictness

| Mode                         | zod 4            | zod 3            | Use for                                                                                 |
| ---------------------------- | ---------------- | ---------------- | --------------------------------------------------------------------------------------- |
| strip unknown keys (default) | `z.object`       | `z.object`       | **All read schemas** — an additive backend release must not break you                   |
| reject unknown keys          | `z.strictObject` | `.strict()`      | Action inputs and internal contracts; an unexpected key is tampering or mass-assignment |
| keep unknown keys            | `z.looseObject`  | `.passthrough()` | Forwarding an opaque blob you did not author                                            |

`.strict()` on a response schema inverts resilience: adding one field upstream takes your app down.

### The optionality bug this prevents

A profile read schema declared `id: z.number()` because the login response contained it. A different
serializer behind the same resource **omitted** the key. Every profile read threw `expected number,
received undefined`; the header rendered empty, the avatar spun forever, and edits silently never
saved — with no error visible in the UI. Fix: `id: z.number().optional()`, documented with _why_.
Model what the endpoint returns, verified against a captured payload — not what you wish it returned.

---

## 6. Enums and unions as single sources of truth

```ts
/* enums.ts — wire values only; labels are copy and live in the UI. */
export const invoiceStatusValues = ['draft', 'sent', 'paid', 'void'] as const;
export const invoiceStatusEnum = z.enum(invoiceStatusValues);
export type InvoiceStatus = z.infer<typeof invoiceStatusEnum>;
```

Export the **array** as well as the schema: it is what form schemas (`z.enum(invoiceStatusValues)`),
option lists, and exhaustive record maps consume, so one edit updates all of them.

Apply nullability at the field, not in `enums.ts` — the same enum is nullable on one resource and
required on another:

```ts
status: invoiceStatusEnum.catch('draft'),        // tolerate an unknown future value
tier: accountTierEnum.nullable().catch(null),    // documented-nullable
```

```ts
/* common/types/input-option.ts + common/utils/to-options.ts */
export interface InputOption<TValue = string> { label: string; value: TValue; meta?: Record<string, unknown> }

export function toOptions<T, V = string>(
  items: readonly T[] | null | undefined,
  getLabel: (item: T) => string,
  getValue: (item: T) => V,
): InputOption<V>[] {
  // Reference lists arrive asynchronously; a select rendering before its data lands would
  // otherwise crash on `undefined.map`.
  if (!items) return [];
  return items.map(item => ({ label: getLabel(item), value: getValue(item) }));
}

/* UI layer. Record<InvoiceStatus, string> is the point: add a wire value and this fails to
   compile until someone writes the copy. */
const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft', sent: 'Sent', paid: 'Paid', void: 'Void',
};
export const invoiceStatusOptions = toOptions(invoiceStatusValues, v => INVOICE_STATUS_LABELS[v], v => v);
const accountOptions = toOptions(accounts, a => a.name, a => String(a.id)); // same helper, fetched data
```

Select controls carry `string` values. Convert to the wire type (`Number(value)`) in the submit
mapper (§7), never by loosening the wire schema.

For polymorphic responses prefer `z.discriminatedUnion('kind', [...])` over `z.union`: parsing is a
single key lookup instead of try-every-branch, and a failure reports the one branch that should have
matched instead of a wall of every branch's errors.

---

## 7. Wire schemas vs form schemas

|                 | Wire schema                             | Form schema                                      |
| --------------- | --------------------------------------- | ------------------------------------------------ |
| Source of truth | the API contract                        | the UX                                           |
| Lives in        | `common/schemas/<resource>.ts`          | `modules/<m>/schemas/<form>.ts`                  |
| Field names     | exactly the API's                       | whatever the inputs bind to                      |
| Value types     | wire types (`number` ids, date strings) | control types (`string` selects, `Date` pickers) |
| Messages        | none — nobody reads them                | user-facing, localized                           |
| Tolerance       | tolerant on read, exact on write        | strict; blocking bad input is the whole job      |
| Consumed by     | services and action inputs              | the form resolver                                |

Taking `invoiceSchema` from §3 as the read model:

```ts
/* WIRE — common/schemas/invoice.ts. Write body: exact, all-optional for PATCH, wire types only. */
export const invoiceWriteSchema = z.object({
  account_id: z.number().optional(),
  status: invoiceStatusEnum.optional(),
  amount_due: z.number().positive().optional(),
  due_date: z.string().nullable().optional(),
  note: z.string().optional(),
});
export type InvoiceWrite = z.infer<typeof invoiceWriteSchema>;

/* FORM — modules/billing/schemas/invoice-form.ts */
export const invoiceFormSchema = z
  .object({
    account_id: z.string().min(1, 'Choose an account'),   // select → string
    status: z.enum(invoiceStatusValues),                  // same wire values, no tolerance
    amount_due: z.string().refine(v => Number(v) > 0, 'Enter an amount greater than zero'),
    due_date: z.union([z.date(), z.string()]).nullable(), // picker → Date; hydrated → string
    note: z.string().max(280, 'Keep the note under 280 characters'),
  })
  .refine(v => !v.due_date || new Date(v.due_date) >= new Date(), {
    path: ['due_date'],
    message: 'The due date cannot be in the past',
  });
export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;
```

### The two mappers

```ts
/** wire → form: nulls and numeric ids become the blank strings the controls expect. */
export function toFormValues(invoice: Invoice): InvoiceFormValues {
  const due = invoice.due_date ? new Date(invoice.due_date) : null;
  return {
    account_id: invoice.account_id ? String(invoice.account_id) : '',
    status: invoice.status,
    amount_due: invoice.amount_due != null ? String(invoice.amount_due) : '',
    due_date: due && !Number.isNaN(due.getTime()) ? due : null,
    note: invoice.note,
  };
}

/**
 * form → wire, DIRTY FIELDS ONLY. Sending the whole form makes every save a full overwrite:
 * it blanks fields another tab or another user changed between load and submit.
 */
export function toWireBody(
  values: InvoiceFormValues,
  dirty: Partial<Record<keyof InvoiceFormValues, boolean>>,
): InvoiceWrite {
  const body: InvoiceWrite = {};
  if (dirty.account_id && values.account_id) body.account_id = Number(values.account_id); // string → id
  if (dirty.status) body.status = values.status;
  if (dirty.amount_due) body.amount_due = Number(values.amount_due);
  if (dirty.note) body.note = values.note;
  if (dirty.due_date) {
    const d = values.due_date;                                                  // Date → wire string
    body.due_date = d instanceof Date ? d.toISOString().slice(0, 10) : (d || null);
  }
  return body;
}
```

Keep both mappers beside the form schema and unit-test them: they are where the two contracts meet,
and a bug there is invisible to both schemas.

### Why conflating them hurts

1. **Registration rules applied to sign-in.** Reusing the strict "new password" validator on the
   login form client-blocks every user whose password predates the rule, with a nonsensical message,
   and the request never reaches the server that would have answered 401. Sign-in validates presence
   only; the server decides.
2. **Coercion leaks into the security boundary.** `z.coerce.number()` in the wire schema so a
   `<select>`'s string fits means the _Server Action_ now accepts strings from any caller.
3. **Localized copy in the wire schema** ships translations into the server bundle and into contract
   tests, which then fail on every wording change.
4. **A tolerant read schema reused as a form schema** accepts `null` and `""` by design, so
   required-field validation silently stops working.

---

## 8. Shared validators: pure predicate + schema fragment

Split the _algorithm_ (a pure function, no zod) from the _fragment_ (zod wrapping it). The predicate
gets reused by server re-validation, import pipelines, and tests, none of which want a schema.

```ts
/* common/utils/ — pure functions, no zod. */

/** LOCALE-SENSITIVE: some locales write digits in a non-ASCII numeral system, and users
    paste them as-is. Normalize before you regex, or perfectly valid input is rejected.
    Fill DIGIT_MAPS with the numeral systems your app accepts — one string per system,
    digits 0-9 in order. Leave it empty for an ASCII-only app. */
const DIGIT_MAPS: readonly string[] = [];
export function normalizeDigits(value: unknown): string {
  if (typeof value !== 'string') return '';
  let out = value.trim();
  for (const m of DIGIT_MAPS) out = out.replace(new RegExp(`[${m}]`, 'g'), d => String(m.indexOf(d)));
  return out.replace(/\D/g, '');
}

/** Checksum-validated government/tax identifier. The digit count AND the checksum are
    always jurisdiction-specific — substitute your own. Keeping it a pure function is the
    point: bulk imports, server re-validation, and tests reuse it without pulling in zod. */
export function isValidTaxId(id: string): boolean {
  // TODO(project): replace with your jurisdiction's format and checksum algorithm.
  return /^\d{9,12}$/.test(id);
}

/* common/validators/index.ts — fragments both wire and form schemas compose. */
const PHONE_RE = /^\d{10,14}$/; // LOCALE-SPECIFIC — document yours here

export const sharedValidators = {
  email: (message = 'Enter a valid email address') => z.email(message),

  password: (opts?: { required?: boolean }) => {
    const base = z.string().min(8, 'Use at least 8 characters').regex(/\d/, 'Include a number');
    return opts?.required === false
      ? z.string().optional().refine(v => !v || base.safeParse(v).success, 'Password is invalid')
      : base.nonempty('Password is required');
  },

  phone: (message = 'Enter a valid phone number') =>
    z.string().transform(normalizeDigits).refine(v => PHONE_RE.test(v), message),

  taxId: (message = 'Enter a valid tax ID') =>
    z.string().transform(normalizeDigits).refine(isValidTaxId, message),
};
```

A validator is a **function** returning a fragment (so call sites pass a message or a required
flag), it normalizes inside `.transform()` before refining (so the refine sees clean input), and it
never imports from a module or component. Mark locale-specific fragments in a comment — phone,
postal code, and tax IDs always are — so an agent porting this to another market knows what to swap.

---

## 9. Contract-first workflow

1. **The spec lives in the repo** (`docs/api/<area>/openapi.yaml`) as a pinned copy, never a live
   URL — a backend deploy must not be able to change your build.
2. **One schema module per spec document or tag**, matching the services layer (§2).
3. **Transcribe, don't invent.** Keep the spec's schema names in doc comments so a reader can grep
   spec → code and back. Copy `nullable: true` as `.nullable()`, `required` as required, enum
   members verbatim.
4. **A spec change lands as its own commit, before the code change.** Reviewers then see exactly
   what the API promised differently; in one combined commit nobody can tell whether a field was
   added because the API added it or because someone guessed.
5. **When spec and live API disagree, the live API wins.** Encode reality, record the discrepancy in
   the module comment, and report it. Specs are updated late; production is never late.
6. **Verify against captured payloads** before calling a resource done (§10).

| Generate types from the spec when          | Hand-write zod when                                 |
| ------------------------------------------ | --------------------------------------------------- |
| The spec is accurate and regenerated in CI | The spec drifts from the live API (the common case) |
| You need types only, no runtime checking   | You need runtime tolerance (`.catch`, loose leaves) |
| The surface is very large                  | You need transforms, defaults, or form schemas      |

Generated types are a **cross-check, not a substitute**: a generated `interface` gives zero runtime
protection against the `null` that actually arrives. If you generate, keep the output out of your
components' import graph and diff it in CI to detect drift.

---

## 10. Testing schemas

Schema tests are the only place a breaking backend change fails in CI instead of in production, so
they get their own section in the testing guide: **`references/09-mocking-and-testing.md` §9.2**.
The three kinds (live-shape, tolerance, rejection) and the fixture-capture discipline live there.

---

## Anti-patterns

| Never                                                         | Because                                                                                                            | Do this instead                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `const user = res as User` on a fetch result                  | An unverifiable claim; the first `null` crashes a component far from the fetch, with a stack naming the wrong file | `schema.parse(res)` at the API client                           |
| `interface Invoice { … }` beside `invoiceSchema`              | Two sources of truth drift within a sprint; the compiler validates the stale one                                   | `type Invoice = z.infer<typeof invoiceSchema>`                  |
| `.strict()` on a response schema                              | An additive backend release — one new field — takes the page down                                                  | Default strip; keep `strictObject` for action inputs            |
| `name: z.string()` on a field the API can null                | One null throws a `ZodError` that blanks the whole route, not one field                                            | `looseString`, or `.nullable()` if null is meaningful           |
| `.catch(0)` on an id / amount / permission flag               | Fabricates a valid-looking value; mutations target the wrong record or grant the wrong access                      | Let it fail — an untrustworthy id is a bug, not a degraded read |
| `z.coerce.number()` on wire data                              | `""`, `null`, `false`, `[]` all coerce to `0`; a missing total becomes a real-looking zero                         | `numberFromString` with an explicit regex                       |
| `.nullish()` reached for reflexively                          | It also makes the key optional, rippling `?` through every consumer and write body                                 | `.nullable()` unless the key can truly be absent                |
| Validating inside a component                                 | Proves the boundary was never guarded, and moves the throw into render where nothing handles it                    | Parse at the API client; components take typed data             |
| A schema module importing a component, hook, or `server-only` | Client components import form schemas; one `server-only` in that graph breaks the client build                     | Schemas import only zod, schemas, and pure validators           |
| One schema doing wire + form duty                             | Applies API rules to humans and human rules to the API — locked-out users and coercion in the security boundary    | Two schemas plus `toFormValues` / `toWireBody`                  |
| Localized messages in a wire schema                           | Ships copy into the server bundle and into contract tests that fail on rewording                                   | Messages in form schemas only                                   |
| Enum values inlined at each use site                          | UI, schema, and write body drift; a new value is a blank chip in one place and a throw in another                  | One `as const` array in `enums.ts`                              |
| Labels (`'Paid'`) inside the schema module                    | Locks copy and translation into the contract layer                                                                 | `Record<Status, string>` in the UI, keyed by the inferred type  |
| Hand-written fixtures for schema tests                        | You test the shape you already believed in — the one that never breaks                                             | Capture real payloads; scrub and date-stamp them                |
| `toMatchSnapshot()` on a parsed object                        | Breaks on every additive change, training the team to run `-u` unread                                              | Assert the specific normalizations                              |
| Spec and code changed in one commit                           | Reviewers cannot tell whether a field was required by the API or invented                                          | Spec commit first, code commit second                           |
| Fetching the spec from a live URL at build time               | A backend deploy silently changes your build output                                                                | Pin a copy in the repo, update deliberately                     |
| Sending the whole form on every save                          | Full overwrite — blanks fields another session changed between load and submit                                     | PATCH only dirty fields via `toWireBody`                        |
