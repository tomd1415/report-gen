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
- `2026-08-06`: **Pupil names can survive redaction on the import path.**
  `replacePupilNames` (`src/services/reportImport.js`) is case-sensitive, so
  `ALEX` is not matched by a supplied name of `Alex` — common in MIS exports with
  all-caps headers — and the name then reaches OpenAI *and* the stored comment
  bank. Adding `/i` is not obviously safe (a pupil called Will would corrupt
  every "will" in the bank), so it is **awaiting a decision** — see
  `docs/PROJECT_STATE.md` §6.3.2 and `.mc-outbox.md`. A second defect in the same
  family — adjacent repeats leaving the second occurrence unredacted, in both the
  import and browser paths — is fixed in the working tree with regression tests.
- `2026-08-06`: **`.gitignore` covers `.env` but not `.env.*`**, while
  `docs/restore_drill.md` §3 instructs the operator to create
  `.env.restore-test` as a full copy of production secrets. On the live server
  that file is untracked-but-visible, so a `git add -A` commits the
  `OPENAI_API_KEY`. The drill now warns and cleans up; the `.gitignore` fix is
  in the working tree, uncommitted (it was found in a docs-only session).
- `2026-08-06`: **40 Dependabot advisories** on the default branch (1 critical,
  16 high, 21 moderate, 2 low), reported by GitHub on push. This supersedes the
  2026-04-17 note below about a single moderate `umzug`/`@rushstack`/`ajv`
  advisory. Needs triage of what is actually reachable from this app's code
  paths before any upgrade — the advice below about avoiding broad
  `npm audit fix` on the live branch still stands.
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

- `2026-04-17`: Split large inline scripts out of HTML pages into dedicated JS
  modules. `adminpage.html`, `index.html`, and management pages would be easier
  to test and maintain.
- `2026-04-17`: Consider replacing browser `confirm()` prompts with an in-page
  confirmation component for destructive actions. Current delete/import prompts
  are clearer, but native dialogs cannot show richer context or styling.
- `2026-04-17`: Consider making the Generate Report ready checklist reusable
  once page scripts are moved into dedicated modules.

## Testing

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
