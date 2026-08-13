# Future Improvements Backlog

This document is a living backlog for useful improvements that are outside the
current task. When a future review uncovers something worth improving but not
needed for the immediate feature, add a dated note here.

For the prioritised roadmap, see `docs/future_improvements_plan.md`.

## How To Use This Document

- Add concise notes under the relevant section.
- Include file paths or endpoint names where possible.
- Keep the current feature scope separate from this backlog.
- Promote an item into a feature plan only when it becomes part of an approved
  piece of work.

## Security and Authorization

- `2026-08-06`: **Four `/api/categories` routes have no auth guard** —
  `POST /api/categories` and `GET`/`PUT`/`DELETE /api/categories/:id`. The
  `app.use(prefix, isAuthenticated)` block in `src/routes/index.js` (~line 465)
  covers `/api/comments` and `/api/categories-comments` but not
  `/api/categories`. Logged-out requests get 500, not 401. Not a breach today
  (the handlers throw on `req.session.user.id` before any query) but one
  careless edit from being a silent unauthenticated write. One-line fix and a
  gate test are described in `docs/PROJECT_STATE.md` §6.9 and
  `docs/NEXT-MILESTONE.md` step 0.
- `2026-08-06`: ~~Pupil names can survive redaction on the import path.~~
  **Resolved — the mechanism was removed rather than the regex improved.** The
  owner overruled all the match-improvement options: teachers should not be
  entering names at all, and no pupil-name list should be held server-side. The
  `pupilNames` field is gone from both import pages, the payloads, the routes and
  `reportImport.js`, replaced by on-page guidance. **Extended 2026-08-07** with a
  warn-only suspect-name highlighter and a confirm-before-send preview on both
  import pages, plus fail-closed behaviour if the helper does not load. Residual
  risk recorded honestly in `docs/PROJECT_STATE.md` §6.3.2 — the highlighter is a
  heuristic, so **no dialog appearing does not mean no name is present**.
- `2026-08-12`: ~~Three database dumps are tracked in git and pushed, including
  the `Users` table.~~ **Closed by owner decision — leave them as they are**, on
  the stated basis that the repository is private and those are test accounts.
  Not removed. The premise is recorded beside the decision in
  `docs/PROJECT_STATE.md` §6.16: if the repo is ever made public, or a real staff
  account turns out to be in one of the files, it needs retaking. The
  `repo-hygiene` gate now labels the three as an accepted exception rather than
  outstanding bugs, and stays exact so a *fourth* dump still fails.
- `2026-08-06`: **`.gitignore` covers `.env` but not `.env.*`**, while
  `docs/restore_drill.md` §3 instructs the operator to create
  `.env.restore-test` as a full copy of production secrets. On the live server
  that file is untracked-but-visible, so a `git add -A` commits the
  `OPENAI_API_KEY`. The drill now warns and cleans up; the `.gitignore` fix is
  in the working tree, uncommitted (it was found in a docs-only session).
- `2026-08-06`: **40+ Dependabot advisories** on the default branch. **Triaged
  2026-08-13 — `docs/dependency-triage-2026-08-13.md`.** Headline: only **one** is
  reachable from a live request path (`multer`, DoS via deeply nested field names,
  on the two authenticated CSV-import routes; fix is in-range at `>=2.2.0`). The
  *critical* is `vitest` — a devDependency whose vulnerability needs the UI server,
  which no script starts. Two caveats recorded there rather than buried: GitHub's
  count (41) and `npm audit`'s (16) could not be reconciled without the `gh` CLI,
  so the triage is complete only for what the lockfile shows; and npm's proposed
  "fix" for `sequelize` is a **major downgrade to 3.30.0** that would break the
  data layer — which is precisely why a broad `npm audit fix` must never be run
  on the live branch.
- `2026-08-09`: ~~Nothing enforces `store: false` on OpenAI calls.~~ **Gated.**
  All five `openai.responses.parse` call sites spread `buildOpenAIParams`, so
  `store: false` and the hashed `safety_identifier` are sent — but nothing made
  that stay true, and a sixth call site without the spread would have silently
  retained the payload at OpenAI with no test going red.
  `tests/openai-privacy-params.test.js` now drives every OpenAI-calling path with
  a recording stub and asserts what was actually sent, plus a census so a new
  call site cannot slip past unexercised. Four planted faults verified red; the
  table is in `docs/PROJECT_STATE.md` §6.14. Gate is in the working tree,
  uncommitted.
- `2026-04-17`: Consider consolidating duplicate admin routes under one
  namespace. The code currently has both `/api/admin/*` and non-admin-looking
  admin-protected routes such as `/api/users`, `/api/subjects`, and
  `/api/year-groups`.
- `2026-04-17`: Enable a strict Content Security Policy after large inline page
  scripts have been moved into dedicated JS files. Helmet is in place, but CSP
  is intentionally disabled until that refactor is complete.
- `2026-04-17`: Consider regenerating sessions after successful normal/admin
  login and adding minimum password length checks for newly created or changed
  passwords.
- `2026-04-17`: Add an automated production security config check for unsafe
  `.env` values such as placeholder session secrets, missing CORS origins, or
  insecure cookie settings.
- `2026-04-17`: Review the moderate `npm audit` advisory through `umzug` /
  `@rushstack` / `ajv` when there is a clean targeted dependency update. Avoid
  broad `npm audit fix` changes on the live branch without a separate test pass.

## Reliability and Data Safety

- `2026-08-06`: ~~An empty import silently wipes a teacher's comment bank.~~
  **Fixed** — the owner chose abort-before-deleting. An empty final category map
  now throws `ReportImportEmptyResultError`, the route returns 502 saying the
  comment bank is unchanged, and the existing bank is left untouched. See
  `docs/PROJECT_STATE.md` §6.3.3.
- `2026-08-13`: **`settings.html` swallows failed saves.** `toggleSubject` and
  `toggleYearGroup` throw on a non-ok response inside a `try` whose `catch` only
  calls `console.error`. The teacher sees the box stay ticked and is told nothing;
  the next page load quietly shows it unticked. Same shape as the non-atomic save
  in §6.20, and it decides which subjects and year groups a teacher can see at
  all. Found while closing the e2e coverage gaps (§6.22) and deliberately left —
  that item was coverage, not repair. Cheap to test now: `mockApis` accepts
  `writeOk: false`, so the journey is a few lines once the fix is scheduled.
- `2026-08-06`: ~~Saving on `manage_subjects_years.html` is two independent
  writes with no atomicity, and one all-or-nothing error message.** The handler
  POSTs/PUTs `/api/prompts` and then POSTs `/api/subject-context`, and reports
  success only if `responseSave.ok && contextSave.ok`. If the first succeeds and
  the second fails, the teacher is told *"Error saving prompt"* — while the
  prompt has in fact already changed. They then either retry (harmless) or give
  up believing nothing was saved (not harmless: the prompt driving their report
  generation is now different from what they think it is, and nothing on the page
  says so). Options: report per-field outcomes, make it one endpoint with a
  transaction, or re-read and re-render after any partial failure.
  **This is currently untestable**, which is the point worth noting: the handler
  is an inline `<script>` in the HTML, so it cannot be imported by a test. That
  is a concrete, named cost of the inline-script debt in §6.4 — the CSP unlock
  and the testability unlock are the same piece of work.~~
  **Fixed 2026-08-13.** Extracted to `public/subject-config.js` and the outcomes
  are now reported per field; the tests were seen to fail against the old logic
  first. `docs/PROJECT_STATE.md` §6.20.
- `2026-08-08`: ~~A failed backup overwrites a good one, and the backup service
  has no tests.~~ **Fixed 2026-08-12** (owner approved) — the service dumps to a
  temporary file beside its target, verifies the artefact ends with
  `-- Dump completed`, and only then renames it into place, unlinking the partial
  on any failure; both entry points are now timestamped. The tests were written
  against the old behaviour, watched to go red when the fix landed, then rewritten
  as positive assertions. Note the fix does **not** go back in time: a stub
  already sitting in a backup directory is still there, so the
  `grep -c 'CREATE TABLE'` check in the drill and the release checklist is still
  worth running. Detail in `docs/PROJECT_STATE.md` §6.10. Original report: Measured: `mysqldump` writes its header to `--result-file`
  before it hits an error, so a failed dump leaves a well-formed 871-byte stub;
  nothing unlinks it; and `exportDatabase` names files by date only, so a failed
  afternoon export replaced a good 11,386-byte morning backup with the stub. The
  stub carries a correct MariaDB banner and looks fine until you restore it. Fix
  and the four steps it needs are in `docs/PROJECT_STATE.md` §6.10. This is the
  first thing to fix in that file, and it is what `docs/restore_drill.md` relies
  on. **Updated 2026-08-12:** it is no longer untested —
  `tests/db-backup.test.js` characterises both halves of the defect and is
  meta-tested so that *applying the fix turns it red*, which is the intended
  tripwire. It also pins a previously unchecked security invariant: the password
  reaches `mysqldump` through `MYSQL_PWD`, never argv, where every user on this
  shared box could read it from `ps`.
- `2026-08-09`: **A migration that swallows its own error is then recorded as
  done.** `migrations/20250106-002-add-session-timestamps.mjs` wraps
  `describeTable('Sessions')` in `try { … } catch { return; }`. The intent is
  "skip if the table does not exist yet", but it catches every reason — and umzug
  writes the migration into `SequelizeMeta` on return, so it never runs again. A
  transient failure at that moment leaves `Sessions` permanently without its
  `createdAt`/`updatedAt` columns, with nothing logged. Narrow the catch to the
  table-missing case, or check `showAllTables()` rather than catching. See
  `docs/PROJECT_STATE.md` §6.13.
- `2026-08-06`: The restore drill was verifying seven content tables but **not**
  `UserSubjects` / `UserYearGroups`. Those hold each staff member's selected
  subjects and year groups, and they fail quietly — restore them empty and every
  teacher sees a blank Settings page while all seven counts look healthy. Added
  to `docs/restore_drill.md` §5. Worth a general look for other
  restore-them-empty-and-nothing-errors tables as the schema grows.

- `2026-04-17`: Extend the shared request timeout helper across the remaining
  lower-risk browser fetches when page scripts are moved into dedicated modules.
- `2026-04-17`: Consider adding an optional `ImportJobs` table later for import
  metadata only: actor, owner, subject, year group, mode, status, counts, and
  error message. Do not store raw report text unless there is a separate policy
  decision.
- `2026-04-17`: Review delete behavior for subjects/year groups. Deleting global
  subjects or year groups may cascade or fail depending on database constraints;
  the admin UI should show a clear warning about affected comment banks.
- `2026-04-17`: Review manual category deletion behavior. The import replacement
  paths now delete comments before categories, but the single-category delete
  route still relies on database/ORM behavior when comments exist.

## UX and Admin Workflows

- `2026-08-09`: **The user-feedback layer fails silently.** 138 `ReportGenUI?.`
  call sites across six pages, no page verifies the module loaded, and every
  call discards the `false` the helpers return when they cannot find their
  target. **Updated 2026-08-12:** the renamed-id half is now gated by
  `tests/feedback-target-ids.test.js`, which compares the selectors each page
  passes against the ids it contains — 106 literal call sites, all currently
  resolving, and the 32 that cannot be checked statically are counted so the
  blind spot cannot grow unnoticed. The design is unchanged though: the helpers
  still return `false` into a void. The two small fixes — assert
  `window.ReportGenUI` at page load, and `console.warn` on an unresolved target —
  are still described in `docs/PROJECT_STATE.md` §6.11.

- `2026-04-17`: Split large inline scripts out of HTML pages into dedicated JS
  modules. `adminpage.html`, `index.html`, and management pages would be easier
  to test and maintain.
- `2026-04-17`: Consider replacing browser `confirm()` prompts with an in-page
  confirmation component for destructive actions. Current delete/import prompts
  are clearer, but native dialogs cannot show richer context or styling.
- `2026-04-17`: Consider making the Generate Report ready checklist reusable
  once page scripts are moved into dedicated modules.

## Testing

- `2026-08-06`: **`check:inline-scripts` passed vacuously.** With nothing to
  check it printed `Checked 0 inline scripts` and exited **0**, so
  `npm run check:deploy` — the documented pre-deploy gate — went green whether or
  not the check had run. Verified by pointing it at a directory containing HTML
  but no inline scripts. Now fails on zero HTML files and on zero inline scripts,
  with a floor of "more than zero" rather than an exact count, because the count
  is *meant* to fall as scripts move out of the pages (§6.4). Fix is in the
  working tree, uncommitted; the general rule is written up in `docs/TESTING.md`.
- `2026-08-09`: **The migration runner had nothing checking it ran anything.**
  Measured: umzug's `up()` resolves with `pending: 0, ran: 0` and no error when
  its glob matches nothing, and `server.mjs` awaits it at the top level — so a
  renamed migration file starts the app against a stale schema without a word.
  Nothing compared the models against the migrations either. Both are now gated
  by `tests/migration-coverage.test.js` (no database needed — it runs the real
  migrations against a recording stub), along with the `CREATE TABLE` count that
  `docs/restore_drill.md` §2 tells the operator to expect. Gate is in the working
  tree, uncommitted. Detail and the four verified mutations: `PROJECT_STATE.md`
  §6.13.
- `2026-08-06`: Playwright now runs here and covers nine journeys (ready-check
  through to a generated report, form retention on an incomplete report, both
  free-text preview paths, the off-origin asset guard, the empty-state, Manage
  Comments, import validation, admin staff workflow). The 2026-04-17 note below
  is therefore partly done: **login, settings persistence and admin user
  management are still the gaps.** Settings persistence is the one worth doing
  first — see the untested-behaviour note in `docs/LESSONS-LEARNT.md` §3 about
  guards and lists drifting apart.
- `2026-08-06`: The e2e login-page navigation race produces *two different*
  Playwright error strings depending on timing (`net::ERR_ABORTED` and
  `interrupted by another navigation`). Any new test that navigates to
  `login.html` or `admin-login.html` under `mockApis` needs to tolerate both, or
  it will pass locally and fail on a loaded machine.
- `2026-04-17`: Add a small integration-style test around staff settings:
  selecting subjects/year groups, then confirming dropdown options use those
  settings.
- `2026-04-17`: Expand Playwright coverage later to include login, settings
  persistence, successful report imports against a test backend, and admin user
  management. The first browser smoke tests now cover the recent UI regressions.

## Code Organization

- `2026-08-06`: ~~`axios` is a declared dependency and is imported nowhere.~~
  **Removed 2026-08-13.** Evidence beyond the grep, because a dynamic require
  would not show up in one: `npm ci` from the regenerated lockfile succeeded with
  `node_modules/axios` absent, the whole app module graph (`app.js`, routes,
  `reportImport`, `dbBackup`, `openai`) loaded without it, and
  `npm run check:deploy` passed — exit 0 confirmed unpiped. Separately, there are
  no non-literal `require(`/`import(` calls anywhere in `src/`, `public/`,
  `scripts/` or `server.mjs`, so there is no branch a dynamic import could hide
  in. **`mariadb` and `mysql2` fail the same "unused" test and must stay** —
  Sequelize resolves the dialect driver by name from `DB_DIALECT`, so neither
  ever appears in an import. That is why a grep-only argument is unsafe in both
  directions: it would have condemned two dependencies the app cannot start
  without.
- `2026-08-06`: A stale-code sweep found **nothing else**: no `TODO`/`FIXME`/
  `HACK`/`XXX`/`@deprecated` markers anywhere in the source, no orphaned modules
  under `src/`, and every file in `public/*.js` referenced by at least one page.
  Recorded because "swept and found nothing" is a useful result that saves the
  next person repeating it.

- `2026-04-17`: `src/routes/index.js` is large. Extracting services for report
  import, report generation prompt assembly, category/comment persistence, and
  admin user management would reduce route-handler complexity.
- `2026-04-17`: Move shared limits and text-cleaning helpers out of
  `src/routes/index.js` once multiple services need them.
- `2026-04-17`: Route-local errors now use a shared JSON helper. Consider
  moving this into formal Express error middleware when route handlers are split
  into smaller modules.

## OpenAI and Prompting

- `2026-04-17`: Keep OpenAI model configuration documented and review model
  defaults before major deployments.
- `2026-04-17`: Consider storing prompt/template versions for generated comment
  banks if staff need to know which prompt produced a set of comments.
- `2026-04-17`: Add admin preview/edit for extracted comments before saving, but
  leave it out of the first safe admin-upload implementation.

## Deployment and Operations

- `2026-04-17`: Run the restore drill in `docs/restore_drill.md` against a
  recent backup and record any live-server-specific adjustments.
