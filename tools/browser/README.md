# Browser tests

This is development tooling only. The accounting app itself remains dependency-free;
nothing under `tools/browser` is loaded by the app or included in
`dist/ZledgerCraft.html`.

## Setup

```bash
cd tools/browser
npm ci
npx playwright install chromium firefox webkit
```

## Run

```bash
npm test
BROWSER=firefox npm test
BROWSER=webkit npm test
npm run bench
```

`npm test` starts the real `serve.mjs` on an ephemeral port and a temporary
SQLite data directory, then runs:

1. `ca-core.cjs` — 117-check chartered-accounting workflow.
2. `ca-advanced.cjs` — 105-check advanced workflow, including real file inputs.
3. `render.cjs` — Day Book paging and full-period export regression.
4. `login-reset.cjs` — login forgot-password and reset-token UI using mocked auth endpoints.
5. `axe.cjs` — WCAG 2 A/AA serious and critical checks on six screens.
6. `workspace-conflict.cjs` — two-context SQLite workspace merge and conflict.

Artifacts are written to `.artifacts/<browser>/` and ignored by Git.

`npm run bench` runs a 10,000-voucher synthetic render benchmark. The Day Book
median has a 900 ms budget by default; override it with `BENCH_MAX_MS`.
