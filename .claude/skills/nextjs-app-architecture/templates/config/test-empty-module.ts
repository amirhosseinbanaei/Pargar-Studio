// Target path in a real project: <repo-root>/src/test/empty-module.ts
//
// Alias target for `server-only` (wired in vitest.config.ts).
//
// In the app, importing `server-only` is what makes a server module fail the BUILD if a
// Client Component ever pulls it in — that guard is load-bearing and must stay. Under
// test there is no server/client bundle split, so the same import would throw on load and
// make every server service, session helper, and Server Action untestable. Here it
// becomes a harmless no-op.
//
// `export {}` makes this a module rather than a script; without it the file is treated as
// global-scope and `isolatedModules` complains.
export {};
