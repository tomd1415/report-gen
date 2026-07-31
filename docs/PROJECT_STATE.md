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
is privacy: **pupil names are never sent to OpenAI** — they are replaced with a
`PUPIL_NAME` placeholder and swapped back after generation.

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
    routes/index.js       # ALL routes — 2060 lines, 68 endpoints (see §6)
    services/
      openai.js           # thin OpenAI client wrapper (6 lines)
      reportImport.js      # import → comment-bank extraction (464 lines)
      dbBackup.js          # mysqldump-based backup
    models/index.js        # Sequelize models + associations
    middleware/auth.js     # isAuthenticated / isAdmin
  migrations/             # 3 Umzug migrations
  public/                 # static frontend (~8 HTML pages + shared JS helpers)
  tests/                  # 15 test files + Playwright e2e
```

---

## 3. Current status — what works

The project is **mature and functional**, not a prototype. Recent commit history
(`improved security`, `improved robustness`, `more UI updates`, `added playwright
tests`) shows steady hardening rather than feature churn. Working tree is clean
apart from two untracked items not yet committed: `.devcontainer/` (new
dev-container config) and this `docs/PROJECT_STATE.md`.

Implemented and covered by tests / docs:

- **Comment bank**: manual CRUD, CSV import/export, and AI-assisted import from
  pasted old reports (structured-output extraction into paragraph-aligned
  categories).
- **Report generation**: 4-paragraph enforcement via strict JSON schema, optional
  per-subject word limit, strength-focus for paragraph 3, and a relevance check
  that warns on out-of-scope comments (with override).
- **Privacy**: `PUPIL_NAME` placeholder redaction in both import and generation,
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
15 Vitest files + Playwright smoke tests. Coverage is genuinely broad for a
project this size: prompt assembly, placeholder replacement, relevance filtering,
incomplete-output rejection, import caps, ownership checks, rate limiting,
security headers, password-change consistency, and UI helpers.

> **Verified 2026-07-21, re-checked 2026-07-27:** `npm install` + `npm test` run
> green here — **15 files, 67 tests passing** — plus `npm run check:inline-scripts` (10 scripts) and
> `git diff --check` clean. The Vitest suite mocks the models and OpenAI client
> (injected into `registerRoutes`), so it needs **no database**. A live MariaDB
> 10.11 was also installed, migrated, and the server booted: `/api/health`,
> `/api/version`, register/login, and admin subject/year-group creation all work
> end-to-end against the real DB. **Still not run here:** the Playwright browser
> e2e — its browser-binary CDN (`playwright.download.prss.microsoft.com`) is
> firewalled in this sandbox, so the 8 UI smoke tests are the one untested slice.

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
than adding to the monolith. Shared helpers (`cleanText`, `escapeRegex`,
`isTargetPlaceholderComment`, `TARGET_PLACEHOLDER_COMMENT`) are **duplicated**
between `routes/index.js` and `reportImport.js` — extracting a `src/lib/text.js`
would be a low-risk first step that de-duplicates and creates the pattern.

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
