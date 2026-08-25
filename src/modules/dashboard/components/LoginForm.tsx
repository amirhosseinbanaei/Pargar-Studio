// src/modules/dashboard/components/LoginForm.tsx
/**
 * The one way into the dashboard.
 *
 * ─── EVERY BRANCH IS ON `status` ──────────────────────────────────────────────────
 * 401, 429 and 422 each get their own sentence and none of them is chosen by matching text.
 * The three say genuinely different things and lead to different next actions, which is the
 * test for whether a branch earns its place: "that password is wrong" means try again,
 * "too many attempts" means waiting is the only option, and a 422 is a payload the form
 * cannot produce and therefore means something is wrong with the page rather than the
 * password.
 *
 * ─── WHAT IT DOES NOT SAY ─────────────────────────────────────────────────────────
 * A 401 is one sentence with no detail, and the action behind it does not distinguish an
 * empty password from a wrong one. There is one credential here; every extra word about why
 * it was refused is a word that helps somebody guessing and helps nobody else.
 *
 * ─── THE NAVIGATION HAPPENS HERE, NOT IN THE ACTION ───────────────────────────────
 * `loginAction` returns where to go; this component performs it with `router.replace`.
 * `replace` rather than `push`, so the browser's back button does not return to a login page
 * the visitor is now redirected away from. Then `router.refresh()`, because the dashboard
 * shell was server-rendered under the OLD cookie: without it the layout that just decided
 * "anonymous" stays on screen behind the navigation.
 */
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormButton, FormInput } from '@/common/components/form';
import { applyFieldErrors } from '@/common/hooks/applyFieldErrors';
import { fieldErrors, mapError, type NormalizedError } from '@/common/errors';
import { BRAND } from '@/common/constants/site';
import { loginAction } from '../actions/session-actions';
import {
  EMPTY_LOGIN_FORM,
  LOGIN_FORM_FIELDS,
  loginFormSchema,
  type LoginFormValues,
} from '../schemas/login';
import { ResultRegion } from './ResultRegion';

export interface LoginFormProps {
  /**
   * The `?next=` the gate appended, passed down from the page. It is re-validated on the
   * SERVER by `safeReturnPath` inside the action — a value that merely arrived here is still
   * attacker-supplied, and validating it only in the browser would be validating it nowhere.
   */
  next?: string;
}

export function LoginForm({ next }: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = useState<NormalizedError | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: EMPTY_LOGIN_FORM,
    // `onChange`, because `FormButton` gates on `isValid`.
    mode: 'onChange',
  });

  const onSubmit = async (values: LoginFormValues) => {
    setError(null);
    setMessage(null);

    const result = await loginAction({ password: values.password, next });

    if (result.ok) {
      /**
       * Clear the field before navigating. The component unmounts a moment later either way,
       * but "either way" is doing a lot of work there — a failed navigation would otherwise
       * leave the password sitting in a live input.
       */
      form.reset(EMPTY_LOGIN_FORM);
      router.replace(result.data.redirectTo);
      // The shell above was rendered under the old cookie. Without this the server tree is
      // not re-run and the visitor lands on chrome that still believes they are anonymous.
      router.refresh();
      return;
    }

    if (result.status === 401) {
      setMessage('That password is not correct.');
      // Focus back into the field, ready for another attempt. `setError` never moves focus.
      form.setFocus('password');
      return;
    }

    if (result.status === 429) {
      setMessage('Too many failed attempts. Wait a few minutes and try again.');
      return;
    }

    if (result.status === 422) {
      const named = fieldErrors({ status: result.status, body: result.body });
      if (Object.keys(named).length > 0) {
        applyFieldErrors(form.setError, named, LOGIN_FORM_FIELDS, setMessage);
        return;
      }
    }

    setError(mapError({ status: result.status, body: result.body }));
  };

  return (
    <main id="main" className="flex min-h-screen items-center justify-center bg-s-0 px-6 py-16">
      <div className="flex w-full max-w-[26rem] flex-col gap-8">
        <header className="flex flex-col gap-2">
          <p className="text-fs-md tracking-wide-kavan text-t-hi uppercase">{BRAND.short}</p>
          <h1 className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">Dashboard</h1>
        </header>

        <Form {...form}>
          <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
            <ResultRegion error={error} message={message} />

            <FormInput<LoginFormValues>
              name="password"
              type="password"
              label="Password"
              /*
                `current-password` so a password manager offers the stored entry. There is one
                account, so there is nothing to disambiguate and no username field to pair it
                with — which is also why the field is `autoFocus`: it is the only control on
                the page.
              */
              autoComplete="current-password"
              autoFocus
              required
            />

            <FormButton className="self-start">Sign in</FormButton>
          </form>
        </Form>

        <p className="text-fs-xs tracking-flat-kavan text-t-xlo">
          There is one administrator account. The password is set by whoever deploys the site, in{' '}
          <code className="text-t-lo">ADMIN_PASSWORD</code>.
        </p>
      </div>
    </main>
  );
}
