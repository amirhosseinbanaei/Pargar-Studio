/**
 * PLACEHOLDER. Prompt 4 replaces this with the real five-column shell.
 *
 * Its whole job is to prove the token layer is live: the canvas below is `--s-0`
 * (#0c0b0a) and the wordmark is `--a-1` (champagne), both read from `globals.css` as
 * Tailwind utilities generated from the `@theme` block. If this page renders black-on-
 * white, or the letter-spacing is tight, the token layer did not load and nothing built on
 * top of it will be right either.
 *
 * Deliberately throwaway. No shell, no routing, no data — those are prompts 4 and 5.
 */
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-s-0">
      <h1 className="font-sans text-fs-2xl tracking-wide-kavan text-a-1 uppercase">Kavan Studio</h1>
    </main>
  );
}
