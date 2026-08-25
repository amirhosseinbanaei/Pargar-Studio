// src/modules/dashboard/schemas/login.ts
/**
 * The two schemas behind the login form, and the reason there are two.
 *
 * `loginFormSchema` types what the browser is holding; `loginSubmissionSchema` is what the
 * ACTION re-validates. They are separate for the reason
 * `references/05-contracts-and-schemas.md` gives: a form schema carries user-facing copy
 * and a wire schema must not, because the wire schema's messages travel over the RPC
 * boundary and land in a log or a test rather than in front of a person.
 *
 * They are also, here, the same bounds — and that is the trap prompt 5 already fell into
 * once (`modules/contact/schemas`: `min(10)` in the form, `min(1)` in the action, and a
 * nine-character body the server accepted after the form had refused it). The bounds
 * therefore live in ONE constant that both read, so they cannot drift.
 */
import { z } from 'zod';

/**
 * The minimum this form will attempt at all. It is NOT a password policy — the password is
 * `ADMIN_PASSWORD`, set by whoever deploys, and this schema has no business judging it.
 * What the bound buys is that an empty submit and a stray keystroke are refused in the
 * browser without spending a rate-limit attempt on the server.
 */
export const PASSWORD_MIN_LENGTH = 1;

export const loginFormSchema = z.object({
  password: z.string().min(PASSWORD_MIN_LENGTH, 'Enter the administrator password.'),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;

/** Every field this form renders — the allow-list `applyFieldErrors` binds against. */
export const LOGIN_FORM_FIELDS = ['password'] as const satisfies ReadonlyArray<
  keyof LoginFormValues
>;

export const EMPTY_LOGIN_FORM: LoginFormValues = { password: '' };

/**
 * What `loginAction` parses. `strictObject`, so a crafted POST cannot smuggle an extra key
 * past it, and no copy: a message chosen here would be shown to nobody.
 */
export const loginSubmissionSchema = z.strictObject({
  password: z.string().min(PASSWORD_MIN_LENGTH),
  /**
   * Where to go after signing in. Optional because the login page is also reachable
   * directly, and re-validated by `safeReturnPath` before anything navigates to it — a
   * string that merely PARSES here is still attacker-supplied.
   */
  next: z.string().optional(),
});

export type LoginSubmission = z.infer<typeof loginSubmissionSchema>;
