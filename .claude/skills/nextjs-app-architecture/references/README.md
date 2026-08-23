# Reference guides — index

Twelve guides, numbered 01–12. Each opens with a **Read this when** stanza and an **Invariants**
box, and closes with an anti-patterns table. Open the one row you need; the set is not meant to be
read front to back.

`../SKILL.md` carries the task → guide routing table and the invariants that hold across all
twelve. `12-adoption-playbook.md` is the action document — if you are bootstrapping, migrating or
auditing, start there and let it tell you which of the others to open at each step.

| Guide                                                          | Read this when…                                                                                                                        |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| [01 · Layering and boundaries](01-layering-and-boundaries.md)   | you are deciding where a new file goes, an import was rejected by lint, two features want the same helper, or you are creating or deleting a module. |
| [02 · Design system](02-design-system.md)                       | you are adding or restyling a component, deciding which tier it belongs to, a class override is not winning, a skeleton causes layout shift, or an axe test fails. |
| [03 · Server data layer](03-server-data-layer.md)               | you are adding a call to a backend, wiring env configuration, debugging a 401 that only happens sometimes, or building anything that touches session cookies. |
| [04 · Actions and mutations](04-actions-and-mutations.md)       | you are adding a write of any kind, wiring a mutation hook, deciding what a route should invalidate after a write, or choosing between a Server Action and a Route Handler. |
| [05 · Contracts and schemas](05-contracts-and-schemas.md)       | you are modelling a backend response or an action input, a `ZodError` blanked a route, a field arrived `null` unexpectedly, or you need a form schema next to a wire schema. |
| [06 · Error system](06-error-system.md)                         | an error renders wrong, blank, or as raw JSON; you are placing an error boundary or wondering why one is not firing; a retry button does nothing; or you need to branch the UI on a failure. |
| [07 · Forms](07-forms.md)                                       | you are building any form, a submit button never enables, backend validation errors are not landing on the right inputs, or you are building a wizard or an upload field. |
| [08 · State and data flow](08-state-and-data-flow.md)           | you are deciding where a piece of state lives (start at the §1 table), a page flashes a spinner over data the server already had, a store and the cache disagree, or you are wiring SSR prefetch and hydration. |
| [09 · Mocking and testing](09-mocking-and-testing.md)           | the app must run with no backend, you are writing any test, a test cannot see its `vi.mock`, or a request escaped to the real network. |
| [10 · Routing and app shell](10-routing-and-app-shell.md)       | you are adding a route, page, layout or loading/error file; deciding where a Suspense boundary goes; writing metadata, a sitemap or robots; or changing what the request-interception layer decides. |
| [11 · Tooling and gates](11-tooling-and-gates.md)               | the gate fails, you are wiring or repairing CI, hooks, Docker or env files, or you need to know whether a rule may be suppressed (it may not). |
| [12 · Adoption playbook](12-adoption-playbook.md)               | you are starting a project (Part A), bringing an existing one into this architecture (Part B), or scoring a repo against it (Part C). |

## Reading order for a full adoption

The playbook drives; the others are opened at the step that needs them.

1. **12 · Adoption playbook** — Part A (or Part C → Part B for an existing app). Read its
   anti-patterns table before step A1.
2. **11 · Tooling and gates** — the scripts, the four-command gate, TypeScript and ESLint composition
   (playbook A1–A4).
3. **01 · Layering and boundaries** — the three layers and the machine-enforced zones, declared with
   an empty `MODULES` array before the first module exists (A3, A5).
4. **06 · Error system** — the normalized error every later layer converges on (A6).
5. **03 · Server data layer** and **05 · Contracts and schemas** — env, the four transport rings,
   session, and the schemas the client parses with (A7–A10).
6. **04 · Actions and mutations** — the `ActionResult` contract and the query-key factory (A11, A13).
7. **02 · Design system** and **07 · Forms** — the `ui / ds / form` tiers, then the two form shapes
   built on them (A12, A12b).
8. **08 · State and data flow** — the query client, providers, SSR hydration and the store lane (A13).
9. **09 · Mocking and testing** — the front-db and the test harness (A14, A15).
10. **10 · Routing and app shell** — route groups, boundaries, the proxy and metadata (A16–A17).
11. Back to **12** for A18–A20: CI, the container, the project agent file, and the first vertical
    feature module — which is the acceptance test for everything above it.

Templates referenced throughout live in `../templates/`; see `../templates/src/README.md` and
`../templates/config/README.md` for target paths and copy order. Where a guide's inline code
disagrees with a template, the template wins.
