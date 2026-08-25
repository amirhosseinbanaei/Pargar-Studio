// The jest-axe matcher ships Jest types only, so it has to be declared for this runner —
// otherwise `expect(...).toHaveNoViolations()` is a type error in every a11y test while
// working perfectly at runtime, which is exactly the kind of mismatch that gets "fixed"
// by deleting the assertion.
import 'vitest';

declare module 'vitest' {
  interface Assertion {
    toHaveNoViolations(): void;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void;
  }
}
