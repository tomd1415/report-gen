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
  tests/                  # 24 Vitest files + Playwright e2e (tests/e2e/)
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
24 Vitest files (152 tests) + 13 Playwright browser journeys, as of 2026-08-12.
Nine of those files are *gates* rather than ordinary tests — see `docs/TESTING.md`
for what each guards and the rules they follow. Coverage is genuinely broad for a
project this size: prompt assembly, placeholder replacement, relevance filtering,
incomplete-output rejection, import caps, ownership checks, rate limiting,
security headers, password-change consistency, browser-side redaction helpers,
and UI helpers.

> **Verified 2026-07-21, re-checked 2026-07-27, 2026-07-31, 2026-08-06 and
> 2026-08-12:** `npm install` + `npm test` run green here — **24 files, 152 tests
> passing** at the latest check (18 files / 111 tests on 2026-08-06; the growth is
> the gates added since) — plus `npm run check:inline-scripts` (10 scripts) and
> `git diff --check` clean.
> The Vitest suite mocks the models and OpenAI client (injected into
> `registerRoutes`), so it needs **no database**. A live MariaDB 10.11 was also
> installed, migrated, and the server booted: `/api/health`, `/api/version`,
> register/login, and admin subject/year-group creation all work end-to-end
> against the real DB.
>
> **The Playwright e2e now runs here too — 13/13 green** (first run 2026-07-30,
> 9 journeys then).
> Chromium was already present in this sandbox; the earlier note that the
> browser-binary CDN was firewalled was about `npx playwright install`, not about
> running the tests. What had actually been blocking every e2e test was the
> footer's off-origin Creative Commons icons stalling `page.goto`'s `load` event
> — see §6.8. That is fixed, so this slice is no longer untested.
>
> **Timing caveat for this box:** load average reaching ~20–30 on 4 cores pushes
> tests past Vitest's 5000 ms default and produces 2–3 *different* failures per
> run. When it happens use `./node_modules/.bin/vitest run --testTimeout=30000`
> and `./node_modules/.bin/playwright test --workers=1`; do **not** raise the
> committed defaults to paper over it.
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

### 6.3.3 An empty import silently wiped the comment bank — fixed (found and fixed 2026-08-06)
*(Heading corrected 2026-08-12. It read as a present-tense defect, with the fix
eight paragraphs below — the §6.18 pattern, in this document. Headings are what
get skimmed, grepped and quoted, so they have to carry the status.)*

`persistCategoryMap` in `src/services/reportImport.js` **always** deleted the
target user's existing categories and comments for that subject + year group,
then wrote the new `categoryMap`. Nothing checked that the new map was non-empty.

An import whose model call returned nothing usable therefore **succeeded**,
having destroyed the comment bank and replaced it with nothing, and responded 200
with *"Reports imported successfully and categories/comments generated."*

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

### 6.10 A failed backup overwrote a good one — fixed (found 2026-08-08, fixed 2026-08-12)
**Fixed 2026-08-12 with the owner's approval, code and tests in one commit.** The
account below is what was wrong and how it was measured; what the code does now is
at the foot of this section.

`src/services/dbBackup.js` had **no test coverage at all** — nothing in `tests/`
referenced it — and it is what `docs/restore_drill.md` depends on.

**Measured against the live MariaDB here, not reasoned about:**

| Case | mysqldump exit | file written |
|---|---|---|
| Normal dump of `comment_bank` | 0 | 11,386 bytes, 11 `CREATE TABLE` |
| Dump of a database the user cannot reach | **2** | **871 bytes, 0 tables** |

The failure is handled correctly *as a request*: `execFileAsync` rejects on the
non-zero exit, so the admin gets a 500. The problem is what it leaves behind.

**mysqldump writes its header to `--result-file` before it discovers the error**,
so a failed dump leaves a well-formed, plausible-looking `.sql` file. Nothing
removes it — `runDump` has no `try`/`finally`. And `exportDatabase` names its
output by **date only** (`database-backup-YYYY-MM-DD.sql`), so a second export on
the same day writes to the same path.

Put together and reproduced end to end: a good 11,386-byte backup taken in the
morning was **replaced by the 871-byte stub** by a failed export that afternoon.
The stub opens with a correct `-- MariaDB dump 10.19` banner, so nothing about it
looks wrong until you restore it and get an empty database. The restore drill's
row counts (§5 of that document) would catch it — but only if the drill is run,
and the whole point of a backup is the day nobody rehearsed.

`backupDatabase` is not exposed to this: it uses a full timestamp, so each run
gets its own filename. Only the download path collides.

**What the code does now.** `dumpToVerifiedFile` dumps to `<target>.partial`,
proves the artefact, and only then renames it into place; on any failure it
unlinks the partial and rethrows. Both entry points name files with a full
timestamp, so no two runs target one path.

The verification is the part worth arguing about, and it changed during the work.
It checks that the file **ends with `-- Dump completed`** — measured against the
three real dumps in `dbbackup_web/`, all of which do. The original plan here was
non-zero size and at least one `CREATE TABLE`; the devil's advocate pointed out
that both would pass a dump that died *between the schema and the data*, which is
a perfectly ordinary way for one to fail. Only the trailer says the process
reached the end.

Two properties that look incidental and are not:

- the temporary file is in the **same directory** as its target, because `rename`
  is atomic only within one filesystem — and only an atomic rename guarantees a
  concurrent reader sees the old backup or the new one, never a half-written file;
- on a full disk the dump now fails at the *temporary* path and the existing
  backup survives, which is the exact inverse of the old behaviour.

**How it was tested, in the order it happened.** `tests/db-backup.test.js` was
written first against the *old* behaviour, characterising both halves of the
defect and labelled as defects rather than intent. Applying the fix turned those
tests red — the tripwire firing as designed — and only then were they rewritten as
the positive assertions that stand there now. That order is the difference between
a test that describes the fix and one that was seen to distinguish it from the bug.

Each part of the fix is independently pinned; verified 2026-08-12 by reverting one
at a time. Removing the trailer check reddens the two verification tests; removing
the unlink reddens both failure-path tests; renaming before verifying reddens
broadly; a date-only export name reddens the timestamp test; dumping straight to
the final path reddens the temporary-file test. There is a positive control — *a
complete dump is moved into place* — without which every one of those would still
pass if the service simply refused everything.

It also pins a security invariant nothing was checking: the password reaches
`mysqldump` through `MYSQL_PWD`, never through argv, where every user on this
shared box could read it from `ps`.

**Still true, and still worth the operator's time:** the `grep -c 'CREATE TABLE'`
check in `docs/restore_drill.md` and the release checklist. New stubs can no
longer be created, but **any stub already sitting in a backup directory is still
there**, and this fix does not go back in time. Check the file you are about to
rely on.

**Fix (not applied — this needs its own test, and both belong together):**
1. Write to a temporary path and rename onto the final name only after a
   successful dump, so a failure cannot replace a good file.
2. On failure, unlink the partial file in a `finally`.
3. Assert the artefact before reporting success — rather than trusting the exit
   code. LESSONS §4: check for the artefact, not the exit code. Check the
   **trailer**, not just the header: a completed `mysqldump` ends with
   `-- Dump completed`, and the stub by definition does not, because it died
   partway. Non-zero size and a `CREATE TABLE` count are weaker versions of the
   same idea — a dump that failed after the schema but before the data would pass
   both. (Trailer check suggested by the devil's advocate, 2026-08-12; it is a
   strictly better test than the one originally written here.)
4. Give `exportDatabase` a full timestamp like `backupDatabase`, or write it
   somewhere transient, since it is a download rather than an archive.

Two cautions on step 1, from sketching it: `rename` is atomic only *within* one
filesystem, so the temporary file must live in the backup directory rather than
`/tmp`; and the rename must not happen until step 3 has passed, or it just moves
the stub into place more tidily. The rename is not the fix on its own — the
content check is.

**Separate, smaller note:** the dump runs without `--single-transaction`, so it
takes mysqldump's default table locks. That gives a consistent dump but blocks
writes for its duration — sub-second at this data size, but worth knowing before
the comment banks grow.

### 6.11 The user-feedback layer fails silently (found 2026-08-09)
Every status message, loading state and field-validation highlight in the app
goes through `window.ReportGenUI` from `public/app-ui.js`. Measured: **143
call sites across six pages, every one written as `window.ReportGenUI?.…`, and
no page checks the module loaded.** The helpers return `false` when they cannot
find their target element, and **every call site discards that return value**.

So there are two ways for user-facing feedback to disappear with no trace:

1. **The module does not load.** All 143 calls become no-ops. Fetches still
   fire, so a teacher clicking Generate Report sees literally nothing happen —
   no error, no spinner, no success. **This case is caught**, though not where
   you would expect: `check:inline-scripts` passes (it only reads inline
   `<script>` blocks — verified by planting a syntax error in `app-ui.js`, which
   it did not notice), but the unit and e2e suites both fail. See §6.12.
2. **An element id is renamed or mistyped.** `showStatus('#typo', …)` returns
   `false`, the caller ignores it, and that one message silently never appears
   while everything around it keeps working. It is the more likely of the two in
   ordinary maintenance. **Gated 2026-08-12** —
   `tests/feedback-target-ids.test.js` compares the selectors the pages pass
   against the ids the pages contain, per page. Static by necessity: the failure
   is a *missing* element, so there is no runtime signal to observe.

   Two results from building it, both worth having. **106 of the 138 call sites
   pass a literal `'#id'`, and every one of them currently resolves** — so
   nothing is broken today; the gate is holding a clean state rather than
   reporting a mess. And the other **32 cannot be checked statically**: 26
   `setButtonLoading` (handed an element reference, so a rename breaks the lookup
   loudly rather than silently — the safe kind), 5 `setFieldInvalid` and 1
   `getSelectedOptionText` built as `` `#${id}` `` from a loop variable. That
   count is asserted exactly, so the unverifiable surface cannot grow unnoticed;
   the `` `#${id}` `` six are the residue worth removing if this is revisited.

   Meta-tested: renaming an element while leaving its call turns it red naming
   the page and the selector; adding a dynamic call site turns it red on the
   count.

**Still not fixed in the code** — the gate above catches the renamed-id case at
test time, which is where it belongs, but the underlying design is unchanged: the
helpers still return `false` into a void. The honest options are a one-line
assertion at page load that `window.ReportGenUI` exists, and/or making the helpers
`console.warn` when they cannot resolve a target so a missing element leaves a
trace. Both are small; both
are behaviour changes across six pages, so they want to be one deliberate change
rather than a drive-by.

### 6.12 `check:inline-scripts` does not cover `public/*.js` (found 2026-08-09)
The gate parses inline `<script>` blocks in the HTML only. A syntax error in any
of the five browser modules passes it cleanly — measured, exit 0, "Checked 10
inline scripts".

That turned out to matter less than it first appeared, and the reason is worth
writing down because it is load-bearing and undocumented: **every `public/*.js`
file happens to be imported by some test**, so a syntax error fails the unit
suite. Nothing enforced that. Add a sixth helper with no test and it would stop
being checked, silently — and the stated direction (§6.4) is to move *more* code
out of the inline scripts into exactly these files, so the unchecked fraction
would grow as the CSP work proceeds.

`tests/public-module-coverage.test.js` now pins it by **importing every
`public/*.js` itself**, one test per file, so a parse error fails naming the
file. Mutation-tested 2026-08-09: a syntax error in a module turns it red, and a
brand-new module is picked up automatically with no list to update — added
`orphan-probe.js`, watched the run go from 6 tests to 7, broke it, watched it go
red.

Its first version was weaker and is worth recording as a lesson, because it had
the very flaw this file keeps warning about. It scanned the *test sources* for
the string `public/<name>` and passed if it appeared anywhere — so a **comment**
mentioning a filename would have satisfied it while nothing actually imported
the module. A false pass, in a gate whose entire job is to stop false passes.
Found on a fresh-eyes re-read of my own work (`SELF-DIRECTED-WORK.md` item 4),
not by anything going red. Importing the modules directly removes the hole
outright: there is nothing left to fool.

Note the check cannot simply move into `check-inline-scripts.mjs`. That script
parses with `new Function`, and these files carry real `export` statements
alongside their `window.X = {…}` block, which `new Function` rejects.

Scope, stated plainly: this proves each module parses and that its top level
runs. It is not behaviour coverage — `app-ui.js` still has the 143 unverified
call sites in §6.11. It is the floor beneath coverage, not coverage.

### 6.13 The migration runner succeeds while running nothing (found 2026-08-09)
`runMigrations()` (`src/db/migrate.js:9`) finds migrations with the glob
`migrations/*.mjs`. **Measured 2026-08-09: umzug's `up()` resolves cleanly when
that glob matches nothing** — `pending: 0, ran: 0`, no error, no warning. Probed
directly by pointing a throwaway Umzug at `migrations/*.js`.

`server.mjs` awaits that call at the top level, so the failure mode is not a
crash. A migration renamed, or a deploy that does not copy `migrations/`, and the
app boots against whatever schema is already in the database. On an empty
database the first query fails loudly and you find out at once. The bad case is
the *partial* one: an existing database missing only the newest migration's
table. Everything works except the one feature, and nothing in the logs connects
the two.

Two more gaps sat next to it, both the same shape:

- **Nothing compared the models against the migrations.** Add a
  `sequelize.define` and forget the migration and the whole suite still passes:
  the models are never synced (nor is the session store — `sessionStore.sync()`
  is not called), so a missing table only shows up in production.
- **The restore drill's table count was an unguarded constant.** §2 of
  `docs/restore_drill.md` tells an operator to run `grep -c 'CREATE TABLE'` and
  expect 11, which is how they tell a real backup from the 871-byte stub in
  §6.10. The next migration that adds a table makes that number wrong, and a
  wrong expected count on that page is worse than none — it is the only thing
  standing between an operator and restoring an empty database.

`tests/migration-coverage.test.js` now covers all three. It does not need a
database: it runs the real migration files through umzug's real resolver against
a recording stub, so the table list is what the code *does*, not what a regex
found in the source. Four mutations, each verified red and naming the right
thing: rename a migration to `.js`; add a model with no migration
(`expected [ 'Orphans' ] to deeply equal []`); stop creating `Sessions`; change
the number in the drill (`expected 12 to be 11`).

**Not fixed, and worth a decision:** `migrations/20250106-002` wraps
`describeTable('Sessions')` in `try { … } catch { return; }`. The intent is "skip
if the table is not there yet", but it swallows *every* reason — and umzug then
records the migration as executed, so it never runs again. A transient failure at
that moment leaves `Sessions` permanently without its `createdAt`/`updatedAt`
columns and the migration marked done. Narrow the catch to the table-missing
case, or re-check `showAllTables()` instead of catching at all.

### 6.14 A stale architecture doc claimed a privacy safeguard that is gone (found 2026-08-09)
`docs/server_mjs.txt` is not a copy of `server.mjs` — it is an architecture
overview in Markdown with a `.txt` extension, and **nothing in the repo links to
it**. That is how it came to list, under "Privacy safeguards currently in code",
a single bullet asserting that pupil names were substituted server-side on
**both** the import and the generation path. (Paraphrased rather than quoted, on
the same principle as `docs/TESTING.md` rule 5: reproducing a retracted sentence
verbatim leaves it matchable by the next person's search.)

Both halves were false, and false in the direction that matters — it claimed a
server-side protection the code does not provide. Generation moved to
browser-side redaction on 2026-07-30 (the server has no `redactPupilName` and
rejects a request carrying a name), and the import path's `pupilNames` mechanism
was removed on 2026-08-06 by owner decision. Corrected, with the CLAUDE.md
framing quoted beside it so the next reader cannot take the summary without the
caveat.

Two further measurements from the same pass:

- **The route list is an index, not an inventory.** Enumerated `app.router.stack`
  at runtime: **68 routes registered, 44 documented.** Nothing documented is
  phantom, which is the better failure of the two — but the whole admin
  target-staff group and eight other endpoints are missing. Marked as an index
  and pointed at `tests/route-auth-matrix.test.js` as the authoritative list,
  rather than hand-maintaining 68 entries that will drift again.
- **`.env.example` and `src/config/env.js` agree** — 26 variables each, the only
  difference being `SECRET_KEY`, the deliberate legacy alias for `SESSION_SECRET`
  (§6.5). Recorded because "swept and found nothing" saves the next person the
  sweep.

**The `store: false` claim was true but unenforced — now gated.** Verified
2026-08-09 that all five `openai.responses.parse` call sites (two in
`src/routes/index.js`, three in `src/services/reportImport.js`) spread
`buildOpenAIParams`. Nothing made that stay true: a sixth call site written
without the spread would default `store` to **true** — the pasted report text
then retained by OpenAI — and send no `safety_identifier`, with no test going
red. Same two-lists shape as §6.9 and §6.13, guarding the most load-bearing
privacy claim in the project.

`tests/openai-privacy-params.test.js` closes it, and deliberately works in two
directions because neither alone is sufficient:

- **Runtime.** Drives `/generate-report` and `/api/import-reports` with a
  recording stub and asserts what was *actually handed to the client* — four
  captured calls covering all five sites (`comment_relevance`,
  `report_paragraphs`, `category_bank`, `comment_relevance_import`,
  `category_bank_merge`). `store` is asserted with `toBe(false)`, not a falsy
  check: an omitted `store` is `undefined`, which is falsy but means *retain*.
  The identifier must match `/^[0-9a-f]{64}$/` and must not be the bare user id.
  Not a source scan — a grep for `store: false` is satisfied by a comment saying
  `store: false`, which is the LESSONS §3 trap exactly.
- **Census.** Counts `.responses.parse(` across `src/` and asserts the set is
  exactly `{routes/index.js: 2, reportImport.js: 3}`, because the runtime half
  cannot see a path it does not drive.

The two-direction meta-test, run 2026-08-09, shows they are genuinely
complementary rather than redundant:

| Planted fault | Runtime | Census |
|---|---|---|
| `buildOpenAIParams` stops sending `store: false` | **red** | green |
| `safety_identifier` sends the raw user id | **red** | green |
| a sixth call site appears | green | **red** |
| an existing call site drops the spread | **red** | green |

Rows 3 and 4 are the point: each half catches something the other cannot.

### 6.15 Applying rule 6 to the older gates (2026-08-12)
`docs/TESTING.md` rule 6 came out of finding a false pass in a gate I had written
(§6.12). The obvious next move was to point the same question — *what would
satisfy this check without satisfying the thing it stands for?* — at the gates
that were already here. Both of the two big ones had an answer.

**`route-auth-matrix`: the skip list was unguarded.** The gate carries two lists.
`KNOWN_UNGUARDED` is asserted **exact** and checked for staleness.
`INTENTIONALLY_PUBLIC` had neither check — and the main test `continue`s past
those routes *before it sends anything*, so an entry there is not a documented
exception, it is a route that is never tested at all. Adding `GET /api/users` to
that set would have turned a real hole green; removing a route from the app would
have left a stale entry covering for whatever later took its name.

Two checks added. Staleness mirrors the `KNOWN_UNGUARDED` one. The second proves
each listed route is *genuinely* unguarded rather than merely skipped, by
sending the request and rejecting any response that came from a guard — matched
on the guards' exact bodies (`{message:'Unauthorized'}` / `{message:'Forbidden'}`
in `src/middleware/auth.js`) rather than on status, because
`GET /api/authenticated` legitimately answers **401** with `{authenticated:false}`
when there is no session. A status check would have had to carve it out by name;
matching the guard's own reply distinguishes "blocked before the handler ran"
from "the handler ran and chose this status", which is the real question.

Meta-tested 2026-08-12: hiding `GET /api/user-info` in the skip list goes red
(`GET /api/user-info -> 401 Unauthorized`); a stale entry goes red. **In both
cases the pre-existing test stayed green**, which is the evidence the hole was
real rather than theoretical.

**The off-origin guard visited a hand-written list of pages.** `public/` holds
**12** HTML files; the list named **11**. The missing one was `header.html`.

Measured before changing anything, because the interesting question was whether
this was a live hole: planting an off-origin `<img>` in `header.html` **did**
turn the old test red, because `page-layout.js` injects that fragment into every
page, so its assets are requested during the visits that *were* listed. So it was
a latent gap, not a live one — recorded that way rather than dressed up as a
catch. What it would genuinely have missed is a **new standalone page**, which is
the ordinary way pages get added.

The list is now derived from the directory with a floor of 12, which is what the
explicit list was really providing (rule 4). Meta-tested: a new page carrying an
off-origin asset turns it red; the hand-written version would not have seen it.

Both changes are test-only and sit uncommitted with the others.

### 6.16 Three database dumps are committed to the repository (found 2026-08-12)
`dbbackup_web/database-backup-2024-06-{09,29,30}.sql` are **tracked in git** and
pushed to the GitHub remote, added in commit `a381b78` ("Database backup"). They
are full `mysqldump` output including `INSERT INTO Users` — usernames and bcrypt
password hashes — alongside the comment banks, prompts and subject lists.

`.gitignore` lists `dbbackup_web/`, which is why this is easy to miss: the rule
is correct and has been there for ages, but **`.gitignore` does not untrack files
that were already committed.** New dumps are ignored; these three are not.

**Decided 2026-08-12 — leave them as they are.** Raised on the outbox with three
options (delete from the working tree, history rewrite and force-push, or leave
them); the owner chose to leave them, **on the stated basis that the repository is
private and the accounts in those dumps are test accounts**. Nothing was removed,
and my recommendation of the delete-from-tree option was not taken — recorded that
way rather than quietly rewritten, because the reasoning matters if this is
revisited.

**The premise is the part to keep hold of.** That decision is only as good as the
two facts it rests on. If the repository is ever made public, or if a real staff
account turns out to be in one of those files, it was taken on facts that no
longer hold and needs retaking — bcrypt hashes in a public repo are disclosed the
moment anyone clones it, and no later deletion undoes that. This is §6.18's lesson
applied forward instead of in hindsight: the premise is written next to the
decision so a change in it is visible, rather than left to be rediscovered when
someone wonders why the files are still there.

`tests/repo-hygiene.test.js` reflects the decision rather than contradicting it:
the three files are now labelled an **accepted exception with its basis and date**,
not outstanding bugs. The list stays **exact**, which is the whole reason for
keeping it — a *fourth* dump is not covered by this decision and will fail, and
that is the case the check is really for: the next one committed by someone who
does not know.

**The one-line check that would have caught this in 2024**, and which had never
been run:

```bash
git ls-files -i -c --exclude-standard    # tracked files that .gitignore ignores
```

Swept the rest of the repository the same way and **found nothing else**: those
three files are the only tracked-but-ignored ones, no `.env`/`.pem`/`.key`/
`id_rsa` is tracked anywhere, and the only other tracked `.sql` —
`comment-bank-api/insert_years_subjects.sql` — inserts Subjects and YearGroups
only. `.env.example` is tracked deliberately; its `OPENAI_API_KEY` value is an
eleven-character `sk-` placeholder, far too short to be a real key.

`tests/repo-hygiene.test.js` (test-only, uncommitted) now runs all of that on
every test run, with the three dumps as an **exact** known-bugs list, so removing
them without emptying the list fails too. It also checks the content rather than
only the name: a tracked `.sql` containing `INSERT INTO Users` fails, which is
what catches a dump that lands somewhere `.gitignore` never mentioned. Blocking
`.sql` outright would have been a false alarm on the legitimate seed script, and
a gate that cries wolf gets silenced.

Meta-tested in both of rule 3's directions: committing a new dump into the
ignored directory goes red, tracking a `.pem` goes red, and `git rm --cached`-ing
one of the three known files *also* goes red because the list still names it.

**Found while checking a claim, not while looking for it**, which is worth
recording: a devil's-advocate reply pointed out that "backups are also taken
elsewhere" was an assumption I had never measured. Checking it meant looking in
`dbbackup_web/`, and the answer to the original question was also worth having —
**there is no scheduled backup on this box at all**: no crontab entry, no timer,
and the newest file there is from June 2024. If nothing else takes backups, then
the §6.10 defect is not one safety net among several, it is the safety net.

### 6.17 The app is served out of the working tree
Measured 2026-08-12: PID 61, `node server.mjs`, cwd `/workspace/comment-bank-api`,
listening on 44344, started 2026-08-09.

This changes what "leave it staged rather than done" means for anything under
`src/`. Node does not reload, so an uncommitted source edit is inert while that
process lives — and then becomes live the moment anyone restarts it, for any
unrelated reason, without review and without appearing in any commit. A staged
*test* file is genuinely neutral; a staged source file on this tree is a delayed
deployment.

Worth knowing before the next person leaves something "half done and described".

**And the two halves are not symmetrical**, measured 2026-08-12 against the
running instance rather than reasoned about: a brand-new file dropped into
`public/` was served **immediately with no restart** (200), reflected an edit on
the next request, and 404'd once deleted. `express.static` reads from disk per
request. `src/` does not — Node caches the modules at start.

So a pull without a restart leaves the browser on the new contract and the server
on the old one. On this app that window includes the free-text privacy controls,
where the page-side confirm and the server-side handling have to agree. Recorded
in `docs/release_checklist.md` next to the restart step, which is where somebody
will actually be standing when it matters.

**Checked and clean:** no commit touching `src/` or `server.mjs` has landed since
the process started, and there are no uncommitted changes there, so the running
service *is* the committed server code. Verified rather than assumed — the last
`src/` commit is `9b08c67` (2026-08-06) and the process started 2026-08-09.

**`/api/version` cannot answer "what is deployed".** It returns `"commit": null`
here, because it reads `GIT_COMMIT` / `SOURCE_VERSION` / `RENDER_GIT_COMMIT` /
`COMMIT_SHA` and this deployment sets none of them. `README.md` describes that
correctly; `docs/release_checklist.md` listed the call as a verification step
without saying what it verifies, which is now fixed. Starting the service with
`GIT_COMMIT=$(git rev-parse --short HEAD)` would make the endpoint useful and
costs nothing.

### 6.18 Fixing one instance of a false claim is not fixing the claim (2026-08-12)
On 2026-08-09 I found `docs/server_mjs.txt` asserting a pupil-name safeguard that
had been removed, corrected it, and wrote it up as §6.14. I did not sweep for the
same claim elsewhere. Sweeping today found **four more instances across four
files**, one of them in `README.md`, the front door:

- `docs/admin_staff_report_upload_plan.md` — twice: requirement 9, and a "Current
  Baseline" bullet. The file already carried a 2026-08-06 status banner saying the
  mechanism was gone, and both sentences sat below it stating it as fact.
  `/claude-guidance/LESSONS.md` §3 predicts exactly this: the reader matches the
  sentence and misses the correction, and a banner at the top of a 400-line
  document is a long way from "beside it".
- `docs/phase1_audit.md` — a document titled "(Current State)" asserting both
  server-side substitution *and* server-side restoration.
- `README.md` — **the one that mattered most**, and the one a keyword sweep
  missed, because it was phrased differently: *comments imported into the bank are
  redacted against the pupil names supplied at import time, so bank comments are
  already placeholder-only*. Not a restatement of the mechanism — a **downstream
  inference from it**, asserting a property of the data.

**That is the transferable part.** Searching for the *wording* of a retracted
claim finds its copies; it does not find the conclusions other documents drew
from it. Those are the dangerous ones, because they read as independent facts.
The second sweep — for `already redacted|placeholder-only|redacted at import` —
is what turned up the inference, and it found two more places relying on it,
including a second `README.md` line under "Notes on Privacy".

**And one of them is not a documentation problem.** `docs/REDACTION-DECISIONS.md`
decision 1(A) — show the confirm-before-send preview only when there is free text
— was chosen on the stated basis that *"the only other content is the bank
comments, which are already redacted at import"*. That premise was true on
2026-07-29 and was invalidated by the 2026-08-06 removal. So a report with no
free text is still sent with no confirm step, and the reason given for that being
safe no longer holds.

Recorded, annotated in place, and **not changed unilaterally** — 1(A) was an owner
decision and whether the changed premise should change it is theirs. Worth being
precise about the size of it: the teacher curates their own bank, comments
imported before 2026-08-06 went through the old substitution, and nothing here
says a name *is* present. What is gone is the argument that one cannot be.

Two of my own write-ups also quoted the retracted sentence verbatim (§6.14 above
and the note in `server_mjs.txt`). Both now paraphrase, for the reason
`docs/TESTING.md` rule 5 gives: a verbatim quotation stays matchable by the next
person's search and gets read as current.

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
