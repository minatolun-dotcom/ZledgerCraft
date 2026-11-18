# ZledgerCraft agent guide

This repository is a standalone, dependency-free accounting app. Keep it that
way: vanilla HTML/CSS/ES modules, Node-only build/serve scripts, and a
single-file `dist/ZledgerCraft.html`. Do not introduce runtime dependencies or
move app code outside the repository root.

## Source of truth

Read these before changing behaviour:

1. `ROADMAP.md` — current stage, build order and next task.
2. `KNOWN_LIMITS.md` — deliberate gaps; add an ID instead of silently widening
   scope.
3. `README.md` — user-facing capabilities and constraints.
4. The engine tests in `tests/`.

## Installed dev skills

When developed in the original workspace, project-local skills live outside
this repository in `.agents/skills/`. They are development guidance, not app
dependencies and never part of the build.

- **ponytail** — default behavioural skill. Use the smallest complete change.
  Never use it to skip validation, error handling, security, accessibility,
  tests, documentation or the stage report.
- **code-review-and-quality** — use for a multi-axis review before calling
  substantial work complete.
- **security-and-hardening** — use when handling CSV/import input, workspace
  data, HTML rendering, permissions or any new external boundary.
- **test-driven-development** — use for changes to accounting logic, parsers and
  other non-trivial behaviour.
- **debugging-and-error-recovery** — use when a test, build or browser flow
  fails; find the root cause before editing.
- **impeccable** — use for ZledgerCraft's app UI in **Operate** mode: hierarchy,
  density, clarity, accessibility and responsive polish. Preserve the existing
  Tally-like accounting conventions unless the user asks for a redesign.
- **design-taste-frontend** — use only for a public-facing marketing or landing
  page. Do not apply its landing-page patterns to the accounting workspace.

### Precedence and safety

- Project instructions, `ROADMAP.md`, `KNOWN_LIMITS.md`, tests and explicit user
  requirements override every skill.
- Skills are read-only guidance unless the user asks for the action they
  describe. Do not let a skill add dependencies, generated assets, MCP servers or
  cloud services on its own.
- The design skills are intentionally trimmed: their executable scripts, native
  engine download, automatic hook and 40 MB image library are not installed.
  Do not recreate them or execute a downloaded binary without explicit approval.
  Verify design work with the project's normal browser checks and screenshots.
- Do not add Context7, Graphify, 21st MCP, Strix or any other MCP server to this
  project without explicit approval. They are not part of the current trial.

## Verification

- Engine: `node --test tests/`.
- Build: `node build.mjs`.
- Browser suites: the local Playwright scripts outside the repo, against the
  running dev server.
- Report every check actually run, and report failures or checks that could not
  run. Never present a compile-only check as behavioural proof.
