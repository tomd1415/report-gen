# Project State & Observations — Report Generator

_Prepared: 2026-07-21. A snapshot of the current state of the codebase to orient
future development. For the forward-looking backlog see
`docs/future_improvements.md` and `docs/future_improvements_plan.md`; this
document describes **where things stand today** and flags observations worth
acting on._

---

## 1. What this project is

A **school report generator** for staff. Teachers build a *comment bank* (grouped
into categories), select comments, and the system uses the OpenAI Responses API
to weave them into a fixed **4-paragraph** pupil report. A key design constraint
is privacy: **the current pupil's name is replaced with a `PUPIL_NAME`
placeholder in the browser and never transmitted**, and the browser swaps it back
when the report returns. Free text typed into the additional-comments and
strength-focus boxes is a weaker, separate case — see §6.3.1 for the agreed
framing, which this sentence must not be allowed to drift back away from.

Deployed context: Debian server, MariaDB, run under systemd behind an optional
Nginx reverse proxy. Live at `reportgen.org.uk` (per README footer).

The four report paragraphs are fixed:
1. Topics/areas studied; knowledge & skills acquired.
2. Effort / motivation / attendance.
3. Strengths & achievements (must include a subject-specific strength).
4. Areas for development toward the end-of-year Teacher Target.

---

## 2. Stack & layout

| Layer | Choice |
|---|---|
| Runtime | Node.js (`.nvmrc` pins **22**; README says 20+) |
| Web framework | Express **5** |
| ORM / DB | Sequelize 6 → MariaDB/MySQL |
| Migrations | Umzug (run automatically on server start) |
| Sessions | `express-session` + `connect-session-sequelize` (persisted in `Sessions`) |
| AI | `openai` 6.x, Responses API (`responses.parse`), JSON-schema structured outputs |
| Frontend | Static HTML/CSS/JS in `public/` (no build step, no framework) |
| Tests | Vitest + Supertest (unit/integration), Playwright (browser smoke) |
| Security headers | Helmet (CSP intentionally disabled — see §6) |

```
comment-bank-api/
  server.mjs              # entrypoint: run migrations → create app → listen
  src/
    app.js               # app factory: middleware, session, static, routes
    config/env.js         # dotenv-backed config
    db/
      sequelize.js        # Sequelize connection (MariaDB/MySQL)
      migrate.js          # Umzug migration runner (called by server.mjs)
    routes/index.js       # ALL routes — 2069 lines, 68 endpoints (see §6)
    services/
      openai.js           # thin OpenAI client wrapper (6 lines)
      reportImport.js      # import → comment-bank extraction (478 lines)
      dbBackup.js          # mysqldump-based backup
    models/index.js        # Sequelize models + associations
    middleware/auth.js     # isAuthenticated / isAdmin
  migrations/             # 3 Umzug migrations
  public/                 # static frontend: 10 pages + header.html/footer.html
                          #   partials, 5 shared JS helpers, no build step
  tests/                  # 18 Vitest files + Playwright e2e (tests/e2e/)
```

---

## 3. Current status — what works

The project is **mature and functional**, not a prototype. Recent commit history
(`improved security`, `improved robustness`, `more UI updates`, `added playwright
tests`) shows steady hardening rather than feature churn.

Implemented and covered by tests / docs:

- **Comment bank**: manual CRUD, CSV import/export, and AI-assisted import from
  pasted old reports (structured-output extraction into paragraph-aligned
  categories).
- **Report generation**: 4-paragraph enforcement via strict JSON schema, optional
  per-subject word limit, strength-focus for paragraph 3, and a relevance check
  that warns on out-of-scope comments (with override).
- **Privacy**: `PUPIL_NAME` redaction in the browser on the generation path (the
  name is never transmitted); on the **import** path the app no longer collects a
  pupil-name list at all and relies on on-page guidance instead — see §6.3.2.
  `store: false`, hashed `safety_identifier` per user, OpenAI request-ID logging.
- **Multi-user**: all comment-bank data is scoped by `userId` + `subjectId` +
  `yearGroupId`; ownership is enforced via `findOwned*` helpers.
- **Admin**: manage users/subjects/year-groups/prompts; reset passwords;
  **import comment banks on behalf of a staff member** (merge default, replace
  requires confirmation); DB export/backup (off by default).
- **Ops**: rate limiting (separate limits for auth vs OpenAI endpoints), Helmet
  headers, `/api/health`, `/api/version`, admin-only `/api/health/db`,
  `npm run check:deploy` combined gate, and documented release/restore drills.
- **UX**: paragraph tabs, ready-checklist, selection summary, page-level status
  messages, loading states, field-level validation, form-retention on failed
  generation.

### Test surface
18 Vitest files + Playwright smoke tests. Coverage is genuinely broad for a
project this size: prompt assembly, placeholder replacement, relevance filtering,
incomplete-output rejection, import caps, ownership checks, rate limiting,
security headers, password-change consistency, browser-side redaction helpers,
and UI helpers.

> **Verified 2026-07-21, re-checked 2026-07-27, 2026-07-31 and 2026-08-06:**
> `npm install` + `npm test` run green here — **18 files, 111 tests passing** —
> plus `npm run check:inline-scripts` (10 scripts) and `git diff --check` clean.
> The Vitest suite mocks the models and OpenAI client (injected into
> `registerRoutes`), so it needs **no database**. A live MariaDB 10.11 was also
> installed, migrated, and the server booted: `/api/health`, `/api/version`,
> register/login, and admin subject/year-group creation all work end-to-end
> against the real DB.
>
> **The Playwright e2e now runs here too — 9/9 green** (first run 2026-07-30).
> Chromium was already present in this sandbox; the earlier note that the
> browser-binary CDN was firewalled was about `npx playwright install`, not about
> running the tests. What had actually been blocking every e2e test was the
> footer's off-origin Creative Commons icons stalling `page.goto`'s `load` event
> — see §6.8. That is fixed, so this slice is no longer untested.
>
> **Timing caveat for this box:** load average reaching ~20–30 on 4 cores pushes
> tests past Vitest's 5000 ms default and produces 2–3 *different* failures per
> run. When it happens use `npx vitest run --testTimeout=30000` and
> `npx playwright test --workers=1`; do **not** raise the committed defaults to
> paper over it.
>
> **Corrected 2026-08-08.** This paragraph used to assert the high load was
> "environmental, not a repo defect". A measured `npm run check:deploy` on an
> otherwise quiet box (load 2.7 before starting) took **90 s and drove the 1-minute
> load average to 22.6 by itself** — and it was still climbing when the run ended,
> so peak demand was higher than that. So **this project's own gate accounts for
> the whole of that range**, and "load is 20–30, therefore something outside the
> container is to blame" is not a safe inference. It may have been true on the
> occasion it was written — the observation then was one node process in the
> container — but it was stated with more confidence than the evidence carried,
> which is exactly the failure `docs/LESSONS-LEARNT.md` §4 is about. Check what
> *you* are running before blaming the box.

---

## 4. Data model (quick reference)

- `Users` — staff accounts (`isAdmin` flag; no role hierarchy beyond admin/not).
- `Subjects`, `YearGroups` — **global**, admin-managed; joined to users via
  `UserSubject` / `UserYearGroup` (visibility/selection).
- `Categories` — scoped by `userId + subjectId + yearGroupId`; `HasMany Comments`.
- `Comments` — belong to a category (inherit ownership).
- `Prompts`, `SubjectContexts` — per `userId + subjectId + yearGroupId` (unique).
- `Sessions` — session store.

Implication: the schema cleanly supports **separate comment banks per staff
member**, which the admin staff-import workflow relies on.

---

## 5. OpenAI integration (how it actually works)

- Client is a 6-line wrapper (`services/openai.js`); shared params are assembled
  per-request (`buildOpenAIParams`) including `model`, `store: false`, and hashed
  `safety_identifier`.
- Three structured-output call sites, all `strict: true` JSON schema:
  1. **Report generation** — `reportSchema`, exactly 4 paragraphs, `max_output_tokens` ~700.
  2. **Relevance check** — flags out-of-scope selected comments (~800 tokens).
  3. **Import extraction** — `categorySchema`, category+comments (~2000 tokens).
- Default model is **`gpt-5.2`** with `reasoning.effort` default `none`
  (both env-overridable). Confirm the deployment key has access to this model
  before a release — a wrong/unavailable model id fails at call time, not startup.
- Fallback parsing: if `output_parsed` is absent, generation splits `output_text`
  on blank lines. This is a soft fallback and can misfire if the model ever
  returns non-conforming text — an incomplete report yields a 502 and the form
  retains the user's input for retry.

---

## 6. Observations for future development

Ordered roughly by leverage. None are blocking; the app is in production. These
are the things most likely to bite or to slow future work.

### 6.1 The 2060-line route file is the central piece of tech debt
`src/routes/index.js` holds **all ~68 endpoints** plus schemas, limits, and helper
functions. It's the single biggest drag on testability and the reason CSP is
still off (see below). It's already the top item in the internal backlog. When
touching this file, prefer extracting a cohesive slice (e.g. report generation,
or admin-staff) into `src/routes/<domain>.js` + a `src/services/` module rather
than adding to the monolith. Shared helpers are **duplicated** between
`routes/index.js` and `reportImport.js` — extracting a `src/lib/text.js` would be
a low-risk first step that de-duplicates and creates the pattern.

Re-checked 2026-08-06, the duplicated set is now exactly three:
`cleanText`, `isTargetPlaceholderComment`, `TARGET_PLACEHOLDER_COMMENT`.
`escapeRegex` is **no longer** duplicated — it was deleted from
`routes/index.js` with the server-side redaction helper in the 2026-07-30
cut-over (§6.3.1) and now lives only in `reportImport.js`. See
`docs/NEXT-MILESTONE.md` for this broken into verifiable steps.

### 6.2 Duplicate / overlapping route surface
There are two parallel families of admin endpoints:
- `/api/admin/subject`, `/api/admin/year-group`, `/api/admin/user`,
  `/api/admin/export`, `/api/admin/backup` (name-keyed), **and**
- `/api/subjects`, `/api/year-groups`, `/api/users`, `/api/export-database`,
  `/api/backup-database` (id-keyed).

Both work and both are admin-protected, but it's confusing and doubles the
maintenance/test cost. The prompts routes similarly expose both `/:id` and
`/:subjectId/:yearGroupId` forms. Pick a canonical set, keep the others as thin
aliases during a transition, and delete once the frontend is migrated. (Already
noted in the backlog.)

### 6.3 Privacy: free-text fields in generation — now redacted (fixed 2026-07-28)
> **Superseded by §6.3.1 — read that first.** This section describes the
> *server-side* redaction that was retired on 2026-07-30. It is kept because it
> records why the change was made, but the mechanism it describes no longer
> exists: `routes/index.js` has no `redactPupilName` and does no post-call
> swap-back. Do not cite this section for current behaviour.

The core promise holds — in `/generate-report` the prompt uses `PUPIL_NAME` and
the real name is only substituted back **after** the OpenAI call
(`routes/index.js` → post-call), and selected comments come from the
already-redacted comment bank. Previously two free-text fields (**additional
comments** and **strength focus** topic/level) were inserted into the prompt
verbatim, so a pupil's name typed into those boxes reached OpenAI.

This is now closed: a `redactPupilName` helper routes both fields through the
same placeholder pass used by report import — it replaces the current pupil's
full name and each of its parts (case-insensitively, word-bounded) with
`PUPIL_NAME` before the field is added to **either** the generation prompt or the
relevance-check prompt. Two tests in `tests/report-generation.test.js` fail if
either field reaches a prompt verbatim.

**Residual limitation (inherent, matches the import path):** redaction can only
remove names the app *knows about* — here, the current pupil's `name`. If a
teacher types a **different** pupil's name into a free-text box, the generation
form has no list of other names to match against, so it cannot be auto-redacted.
A shared per-class name list was **rejected on data-protection grounds** (no
pupil-name roster may be held server-side, and an in-browser *persisted* list
falls to the same objection), so the layered mitigation below is what closes this
instead.

#### 6.3.1 Redaction moved client-side + layered free-text mitigation (2026-07-29)
The three decisions parked in `docs/REDACTION-DECISIONS.md` were settled (1(A),
2(A), 3(A)) and implemented; see that document's *Outcome* section for the full
detail. In summary:

- **The name is no longer transmitted at all.** `public/report-selection.js` now
  exports `redactPupilName` / `restorePupilName` (mirroring the server helper),
  and the browser redacts before sending and restores after receiving. 21 unit
  tests in `tests/ui-redaction.test.js`.
- **`POST /generate-report` no longer accepts a pupil name at all.** Decision
  3(A) landed this in two stages: both paths supported (2026-07-29), then the
  legacy name-present branch retired (2026-07-30) once the name-free client was
  verified end to end in a real browser. The route now returns 400
  ("reload the page") if a request carries a name, rather than ignoring it, so a
  stale client fails loudly instead of silently transmitting one. The
  server-side `redactPupilName` helper has been removed — with no name to match
  against it could do nothing.
- **Free-text mitigation is three layers:** on-screen guidance, a **warn-only**
  suspect-name highlighter (`findSuspectNames` — never auto-redacts, because
  *Newton* and a pupil named *Newton* are indistinguishable), and a
  confirm-before-send preview of the exact payload, shown only when free text is
  present (decision 1(A)).
- **The accountability trail is the confirmation interaction only** — decision
  2(A). Nothing is stored; a stored metadata row remains a separate decision to
  take alongside the ImportJobs audit-table question.

**How this must be described (agreed framing, do not soften):** this is *"a
mitigation with an accountability trail"*, **not** *"names never reach the
model"*. The explicit basis for accepting the residual risk is the assumption
that **teachers are expected not to enter another pupil's name**. If that
assumption stops holding, the mitigation is no longer sufficient.

**Consequence to keep in mind:** because the server deliberately never sees the
name on the new path, it can no longer independently verify that the current
pupil's name is absent from free text. Correctness now rests entirely on the
browser helpers — which is why their unit tests are load-bearing.

#### 6.3.2 Two redaction defects found 2026-08-06
Reviewing `redactPupilName` with fresh eyes — precisely because §6.3.1 makes it
load-bearing — turned up two ways a name survives redaction. Both were measured,
not inferred.

**(a) Adjacent repeats — affects both paths. Fixed in the working tree.**
The regex captured its trailing word boundary as a group, and `/g` *consumes*
what it captures. So the delimiter that should have opened the following match
had already been eaten, and a name repeated with exactly one character between
occurrences was only redacted the first time:

    redactPupilName('Alex Alex worked hard.', 'Alex')
      -> 'PUPIL_NAME Alex worked hard.'      // before
      -> 'PUPIL_NAME PUPIL_NAME worked hard.' // after

The fix is to make the trailing boundary a lookahead so it is not consumed. It
was one token, applied in `public/report-selection.js` and — at the time — in
`replacePupilNames`, with six regression tests in `tests/ui-redaction.test.js`.
Only the browser copy survives: `replacePupilNames` was deleted hours later when
the name list was removed (b, below), so `public/report-selection.js` is the sole
place this logic now lives. Meta-tested: with the old regex exactly those six
fail and all 22 pre-existing assertions still pass, so the fix changes no
previously-specified behaviour.

**(b) The import path was case-SENSITIVE. Resolved 2026-08-06 by removing the
mechanism, not by fixing the regex.**
`replacePupilNames` builds its regex with `/g` but **no `/i`**, so a name
supplied as `Alex` does not match `ALEX` or `alex` in the pasted reports. MIS
exports routinely carry an all-caps header line:

    input : "REPORT FOR ALEX\nAlex has done well."
    output: "REPORT FOR ALEX\nPUPIL_NAME has done well."

The unredacted name goes to OpenAI **and** into the stored comment bank, where it
is re-sent on every future generation. The browser helper *does* use `/i`, so the
two paths disagree about what redaction means.

The options offered to the owner were all variations on improving the match
(`/i`, a common-word allow-list, case-insensitive-but-not-all-lowercase). **The
owner overruled all of them with something stronger:** teachers should not be
entering pupils' names at all, and the server should not hold a list of pupils'
names even transiently. So the `pupilNames` field was **removed** — from both
import pages, from the request payloads, from the route handlers, and from
`reportImport.js` (`replacePupilNames`, `LIMITS.pupilNames`, and the now-orphaned
`escapeRegex` are all gone). Reports are sent as pasted.

In its place both import pages carry a prominent instruction not to paste names,
with `PUPIL_NAME` offered as the placeholder to type instead, wired to the
textarea via `aria-describedby`.

**Persistence sweep (2026-08-06).** Checked whether a name list was ever stored
anywhere before removal: no request-body logging, no `morgan`/`winston`/`pino`,
no `ImportJobs` or audit table, no model field, and nothing written to disk — the
CSV `uploads/` path is a different endpoint and unlinks after processing. The
list only ever existed in the request body, in memory, for the life of the
request. Nothing needed purging.

**Backed by a warn-only highlighter and a confirm-before-send preview (added
2026-08-07),** so the instruction is no longer the only control. Both import
pages now:

- run `summariseSuspectNames` over the pasted text on every keystroke and show a
  live, non-blocking list of words that might be names, with a count each. It
  **never edits the text**, for the same reason as the generation page: *Newton*
  and a pupil named *Newton* are indistinguishable.
- require an explicit confirmation before sending **when something is flagged**,
  showing each suspect with a snippet of its first occurrence.
- **fail closed.** If `report-selection.js` does not load, the import is refused
  rather than sent unchecked — a check that silently finds nothing is
  indistinguishable from one that never ran.

Note the two pages carry **separate implementations** of the same control, so
they are two things that must agree with nothing making them. Both fail-closed
branches now have an e2e test (the admin one was added 2026-08-08, after a
review noticed only the teacher-facing copy was covered), and each was
mutation-tested: removing a branch turns *its own* test red and leaves the
other green.

**Why snippets rather than the whole payload**, unlike the generation page: the
paste can run to 60,000 characters. Rendering all of it for review would be
unreadable and would train people to click straight through, which is the
failure the generation page's decision 1(A) was avoiding in the first place.

**Why the dialog is suspect-triggered rather than always-on:** this page *always*
has free text — the reports are the point — so a dialog on every import becomes
muscle memory within a week and stops being read.

**RESIDUAL RISK, stated plainly, and it is not eliminated.** This reduces the
surface; it does not guarantee no name reaches the model.

- The highlighter is a **heuristic**. It only flags capitalised, non-sentence-
  initial, non-ALL-CAPS words outside a small stop-word list. A lowercase name, a
  name in an all-caps header, or a name at the start of a sentence is **not**
  flagged — so **no dialog appearing does not mean no name is present.**
- If a teacher confirms past the warning, or the name was never flagged, that
  name goes to OpenAI and can end up stored in the comment bank, where it is
  re-sent on every later generation.
- Nothing about the confirmation is stored; the accountability trail is the
  interaction only, matching decision 2(A) on the generation path.

What the whole change buys is that the app no longer *asks for* a list of pupils'
names, no longer holds one even briefly, no longer implies redaction is being
done for the teacher, and now shows them the specific words worth a second look
at the moment of sending. That "implies redaction" point was arguably the worst
part of the old design: the field was labelled "Pupil names to redact", which
invited teachers to paste names *and* to trust a mechanism that was
case-sensitive and leaky.

**Framing note:** (b) does not change §6.3.1's agreed wording, but it does narrow
what "reliable" means there. The *generation* path's guarantee about the current
pupil's name is unaffected — that name is never transmitted at all. It is the
*import* path, which handles a list of several real pupils' names, where the
guarantee is weaker than the README implied.

### 6.3.3 An empty import silently wipes the comment bank (found 2026-08-06)
`persistCategoryMap` in `src/services/reportImport.js` **always** deletes the
target user's existing categories and comments for that subject + year group,
then writes the new `categoryMap`. Nothing checks that the new map is non-empty.

An import whose model call returns nothing usable therefore **succeeds**, having
destroyed the comment bank and replaced it with nothing, and responds 200 with
*"Reports imported successfully and categories/comments generated."*

Three routes to an empty map, all reproduced in
`tests/import-empty-result.test.js` (with a control test proving the harness
does write when there is something to write):

1. **The merge call returns no categories.** The worst of the three: **merge is
   the default mode**, and merge only runs when an existing bank is present —
   that is its precondition.
2. **The relevance filter flags every comment**, so
   `filterCategoryMapByRelevance` returns `{}`.
3. **Extraction returns no `output_parsed`.** Not hypothetical — the generation
   path carries an explicit `output_text` fallback for exactly this case
   (§5), so the codebase already treats it as something that occurs. The import
   path has no equivalent.

There is no undo. The "replace mode requires confirmation" guard does not help:
the teacher is confirming a *replace*, not a deletion, and routes 1 and 2 occur
in merge mode regardless.

**Fixed 2026-08-06 (owner chose option (a), abort before deleting).**
`importReportsToCommentBank` now checks the final map has at least one comment
before calling `persistCategoryMap`, and throws `ReportImportEmptyResultError`
otherwise. That extends `ReportImportValidationError`, so existing route handlers
map it without change — but with status **502**, because the request was fine and
the model's answer was not. The existing bank is left untouched and the teacher
is told the comment bank is unchanged.

The tests assert the two things together — that the call fails **and** that
nothing was destroyed. Asserting only the failure would still pass if the delete
happened first, which is the whole bug.

### 6.3.4 A browser error-path sweep, and what it found (2026-08-06)
Swept every `fetch` and `catch` in `public/` for the shape where a failure is
swallowed or misreported. **Most of it is in good order** — the pages check
`response.ok`, surface the server's message through `parseResponseMessage`, and
log the error object before showing a friendly one. Recorded because that is a
real result, and it means the next person need not repeat the sweep.

One genuine finding, on `manage_subjects_years.html`: **saving is two independent
writes with no atomicity and a single all-or-nothing message.** `/api/prompts`
is written first, then `/api/subject-context`; success is reported only when both
succeed. When the first succeeds and the second fails, the teacher sees *"Error
saving prompt"* although the prompt did change. The visible state and the stored
state then disagree, silently, on the configuration that drives report generation.

**It cannot be tested as it stands** — the handler is an inline `<script>` in the
HTML, so no test can import it. That is worth stating plainly as a cost of §6.4:
the work that unlocks CSP is the same work that makes this page testable, which
strengthens the case for doing it.

### 6.4 Content Security Policy is deliberately disabled
Helmet is active but CSP is off because the static pages still contain large
inline `<script>` blocks. This is a conscious, documented trade-off. The unlock
sequence is: move inline scripts into `public/*.js` modules (partly done —
`app-ui.js`, `site-menu.js`, etc. already exist), then enable CSP in report-only
mode, then enforce. Until then, treat any HTML that renders report text as a
potential XSS surface (input sanitisation is whitespace-only, no HTML escaping in
`cleanText`).

### 6.5 Session-secret fallback doesn't fail closed
If `SESSION_SECRET` is unset, config falls back to `'dev-insecure-secret'` and
only logs a warning. In production this should **refuse to start** (or the
planned pre-deploy `.env` check should gate it). Same check could cover
placeholder secrets, missing `CORS_ORIGINS`, and `SESSION_SECURE=false` on HTTPS.
Low effort, meaningful safety.

### 6.6 No audit trail on admin/destructive actions
Admin can import/replace comment banks for any staff user and delete global
subjects/year-groups, but there's no record of who did what. The backlog already
proposes an `ImportJobs` metadata table (actor, target, mode, counts, status —
**no raw report text**). Deletion of shared subjects/year-groups also relies on
DB/ORM cascade behaviour without a clear "this affects N comment banks" warning —
review before a non-technical admin can trigger it.

### 6.7 Smaller notes
- **No pagination** on list endpoints (`/api/categories-comments` eager-loads all
  comments). Fine at current scale; revisit if a comment bank grows large.
- **File uploads** (multer, 5 MB cap) have no MIME/content validation beyond size;
  temp files are cleaned up after processing.
- **`gpt-5.2` default** — see §5; verify model access as part of release.
- **Word limit is advisory** — passed to the prompt, not enforced on output.
- **No prompt/category versioning** — edits overwrite; can't see what prompt
  produced a given bank (backlog item).

### 6.8 No external assets — enforced (closed 2026-07-31)
Every asset now loads from the app's own origin. This is a hard rule, not a
preference: the target devices sit on a filtered school network, and an
unreachable asset host does not degrade gracefully — **it blocks the page's
`load` event, so the page appears to stall**. A third-party request from a
school page also leaks referrer and IP to a company with no relationship to the
school.

Two violations existed and both are fixed:
- **Creative Commons licence icons** in `footer.html`, loaded from
  `mirrors.creativecommons.org`. Now served from `public/icons/`. Note those
  SVGs are hand-drawn approximations, not the official artwork — see
  `public/icons/README.md` before assuming otherwise.
- **Google Fonts import** at the top of `styles.css` (Manrope + Space Grotesk).
  Removed 2026-07-31. Typography now falls back to `'Noto Sans', sans-serif`;
  the family names remain in the stacks so a device that has them installed
  locally still uses them. **This was a deliberate, accepted visual change.** To
  restore the original typography, vendor the font files into the repo and add a
  local `@font-face` block — do not re-add a remote import.

Measured effect: with both fixed, `index.html` fires `load` in ~144 ms with zero
off-origin requests. Before the fonts fix it timed out at 25 s on a host that
could not reach `fonts.googleapis.com`.

**Guard:** `tests/e2e/ui-smoke.spec.js` → *"no page loads an asset from another
origin"* visits all eleven pages and fails on any off-origin request. Its
`KNOWN_OFF_ORIGIN_VIOLATIONS` list is currently empty and should stay that way;
it is a list of outstanding bugs, not approved exceptions.

### 6.9 Four `/api/categories` routes have no auth guard (found 2026-08-06)
Authentication is applied by a block of `app.use(...)` prefix guards near the top
of `registerRoutes` (`routes/index.js` ~line 465). That block covers
`/api/comments` and `/api/categories-comments` but **not** `/api/categories`.
So these four routes run with no guard:

| Route | Guard | Logged-out response |
|---|---|---|
| `POST /api/categories` | none | **500** |
| `GET /api/categories/:id` | none | **500** |
| `PUT /api/categories/:id` | none | **500** |
| `DELETE /api/categories/:id` | none | **500** |

Every one of the other 64 endpoints correctly answers `401` or `403` when logged
out — this was measured, not assumed.

**How bad is it, honestly:** not a data breach today. Each handler reads
`req.session.user.id` on its *first* line, before any query, so an
unauthenticated request throws `TypeError` and Express 5 turns it into a 500. No
row is read or written. The problems are that (a) the status is wrong, so a
monitoring rule keyed on 5xx sees a spurious server error and one keyed on 401
never fires, and (b) the code is one careless edit away from being a real
unauthenticated write — anything that makes the `userId` lookup tolerant
(`req.session?.user?.id`, a default, a reorder that moves it below a query)
converts a crash into a silent success. It is exactly the shape that looks fine
in review because the *reason* it is safe is an accident of line ordering.

**Checked, because "safe by accident of line ordering" only covers the
logged-OUT case.** A *logged-in* user has `req.session.user.id`, so the throw
never happens and the ordering argument gives no protection at all. If any of the
four took its scoping id from the request — params, query or body — the missing
guard would be a disclosure between teachers, not a wrong status code. All four
were checked: each reads `req.session.user.id`, and the three `:id` routes go
through `findOwnedCategory`, which filters `where: { id, userId }`. **There is no
IDOR here.** Four tests in `tests/ownership.test.js` now assert this directly,
including that a `userId` supplied in the body or query is ignored. (Prompted by
the devil's advocate review, `.mc-critique.md`, 2026-08-06 — the distinction was
not one this write-up had drawn.)

**Fix (one line, not applied — this was an unattended session):** add
`app.use('/api/categories', isAuthenticated);` alongside the existing guards.
`/api/categories-comments` keeps its own entry; an `app.use('/api/categories')`
prefix does not match it, so both are needed.

**Guard:** `tests/route-auth-matrix.test.js` enumerates the live Express router
and asserts every route answers 401/403 when logged out. The four above are
listed in `KNOWN_UNGUARDED`, which the test asserts is *exact* — fixing a route
without shrinking the list fails, and adding a new unguarded route fails. Like
`KNOWN_OFF_ORIGIN_VIOLATIONS`, it is a bug list, not an exceptions list.

---

## 7. Suggested next steps (if resuming work)

1. `npm install` and run `npm run check:deploy` to establish a green baseline in
   this environment.
2. ~~Redact pupil names from the additional-comments / strength-focus free-text
   before the OpenAI call (§6.3).~~ **Done 2026-07-28** — see §6.3. Extended
   2026-07-29 (§6.3.1): redaction moved client-side so the name is never
   transmitted, plus the layered free-text mitigation. ~~Follow-up: retire the
   legacy name-present branch.~~ **Done 2026-07-30** — browser-verified, then
   cut over; the server now refuses a transmitted name. This thread is closed.
3. **Quick win:** fail-closed on insecure `SESSION_SECRET` in production (§6.5).
4. Begin the route-file de-duplication with a shared `src/lib/text.js` (§6.1),
   then tackle the split following the domains listed in
   `docs/future_improvements_plan.md` Priority 4.
5. Decide the canonical admin route namespace and alias the rest (§6.2).

The internal roadmap in `docs/future_improvements_plan.md` sequences the larger
work sensibly (data-safety → admin confidence → tech-debt); nothing here
contradicts it — this document surfaced the **free-text redaction gap (§6.3, now
fixed)** as a concrete privacy item and adds the **fail-closed secret check
(§6.5)** as an easy safety win. The test suite **has been run here and is green** (see §3); the only
untested slice is the Playwright browser e2e, blocked solely by a firewalled CDN
in this sandbox.
