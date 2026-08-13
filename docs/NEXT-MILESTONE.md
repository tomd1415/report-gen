# Next milestone, broken into individually verifiable steps

_Written 2026-08-06. Covers the next two backlog items from
`docs/PROJECT_STATE.md` §7: the fail-closed session-secret check (§6.5) and the
start of the route-file de-duplication (§6.1). Adds the auth-guard gap found on
2026-08-06 (§6.9) ahead of both, because it is smaller than either and was
measured rather than estimated._

The rule this document exists to enforce: **a step you cannot check is a step
that will be reported done when it is not.** Every step below has a command or an
observation that distinguishes done from not-done, and that check is written
*before* the change so it can be watched to fail first.

Steps are ordered so each one is independently shippable. Nothing here needs a
decision from the owner except where marked **DECISION**.

---

## Step 0 — Guard the four unguarded `/api/categories` routes ✅ DONE 2026-08-13

> **Completed.** The guard is in `src/routes/index.js`, `KNOWN_UNGUARDED` is empty,
> and the failure that proves it landed — `expected [] to deeply equal [ …(4) ]` —
> was seen before the list was emptied, in that order. `PROJECT_STATE.md` §6.9.
> The steps below are kept as the record of how it was done.

**Why first:** one line, already measured, already has a test that goes red.

**Change:** in `src/routes/index.js`, in the `app.use(...)` guard block at
~line 465, add:

```js
app.use('/api/categories', isAuthenticated);
```

immediately above the existing `/api/categories-comments` entry. Keep the
`/api/categories-comments` line — an `app.use('/api/categories')` prefix does
**not** match it.

Then empty `KNOWN_UNGUARDED` in `tests/route-auth-matrix.test.js` and delete
§6.9's "Fix (one line, not applied)" note from `docs/PROJECT_STATE.md`.

**Verify:**
1. `./node_modules/.bin/vitest run tests/route-auth-matrix.test.js` — green **only after** the
   list is emptied. Before emptying it the test fails with
   `expected [] to deeply equal [ …(4) ]`; that failure is the proof the fix
   landed, so watch for it rather than skipping to the end.
2. `./node_modules/.bin/vitest run` — the whole suite still green; no other test
   asserted the old 500. (**24 files / 149 tests as of 2026-08-12**; this number
   moves, so check the run rather than the sentence.)

**Confidence:** high. Both directions of this were exercised on 2026-08-06 —
removing an unrelated guard turned the test red and named the five affected
routes; adding this guard turned the `KNOWN_UNGUARDED` assertion red as designed.

---

## Step 1 — Fail closed on an insecure `SESSION_SECRET` in production

`docs/PROJECT_STATE.md` §6.5. Today `src/config/env.js` falls back to
`'dev-insecure-secret'` and only `console.warn`s, in every environment.

### 1a. Write the failing test first
Add `tests/config-env.test.js`. It cannot simply `import` the config — that
module reads `process.env` once at import time — so each case must reset the
module registry:

```js
const loadConfig = async (env) => {
  vi.resetModules();
  const previous = { ...process.env };
  Object.assign(process.env, env);
  try {
    return await import('../src/config/env.js');
  } finally {
    process.env = previous;
  }
};
```

Cases:
- `NODE_ENV=production` + no `SESSION_SECRET`/`SECRET_KEY` → **throws**.
- `NODE_ENV=production` + `SESSION_SECRET=change-me` (the literal `.env.example`
  placeholder) → **throws**.
- `NODE_ENV=production` + a 64-char random secret → resolves.
- `NODE_ENV=development` + no secret → resolves, and still warns.

**Verify:** run it before writing the implementation and confirm the first three
fail. A test that has never been seen red has not been shown to test anything.

### 1b. Implement
In `src/config/env.js`, after `sessionSecret` is resolved:

```js
const INSECURE_SECRETS = new Set(['dev-insecure-secret', 'change-me']);
if (env === 'production' && INSECURE_SECRETS.has(sessionSecret)) {
  throw new Error(
    'SESSION_SECRET must be set to a long random value in production. ' +
    'Refusing to start: an insecure session secret lets anyone forge a login cookie.'
  );
}
```

**Verify:** `./node_modules/.bin/vitest run tests/config-env.test.js` green; then
the full `./node_modules/.bin/vitest run` green. Checked 2026-08-06: **no existing
test set `NODE_ENV` at all**, so none could trip the new throw — but re-check
rather than trusting this line. Eight test files have been added since it was
written, which is exactly the situation it warned about.

### 1c. Prove it at the process level
The unit test proves the module throws; it does not prove the *server* refuses to
start, because `server.mjs` runs migrations first and an unhandled rejection
there could mask it.

**Verify:**
```
cd comment-bank-api
NODE_ENV=production SESSION_SECRET= node -e "import('./src/config/env.js')" ; echo "exit=$?"
```
Expect a non-zero exit and the message above. This is the check that actually
corresponds to "the service will not come up misconfigured".

### 1d. Document
Update `README.md` (Sessions section — it currently documents the fallback
behaviour as it is today, so that text must change) and `QUICK_OPS.md`
*Production Safety Toggles*. Add a line to `docs/release_checklist.md`.

**DECISION needed — do not guess:** should the same fail-closed rule extend to
`CORS_ORIGINS` being empty under `NODE_ENV=production`? Today that configuration
blocks *all* cross-origin requests (`src/app.js` returns `CORS blocked` when the
allow-list is empty), which is fail-*safe* but silently so — a misconfigured
deployment looks like a broken frontend rather than a config error. Making it
refuse to start is a behaviour change that could take down a working deployment
on next restart. Left as-is pending an answer.

---

## Step 2 — Extract `src/lib/text.js` (first step of the route-file split) ✅ DONE 2026-08-13

> **Completed.** One definition in `src/lib/text.js`; grep for the local
> definitions returns nothing. The two copies had drifted by one `String()` and
> the resolution is recorded, including the way it makes one path worse —
> `PROJECT_STATE.md` §6.23. Note `escapeRegex`, listed below as one to move, had
> already been deleted on 2026-08-06 and no longer exists anywhere.

`docs/PROJECT_STATE.md` §6.1. Scope is deliberately tiny: move shared helpers,
change no behaviour.

**The duplicated set, verified 2026-08-06 (not the set §6.1 originally listed):**

| Helper | `routes/index.js` | `reportImport.js` |
|---|---|---|
| `cleanText` | yes | yes |
| `isTargetPlaceholderComment` | yes | yes |
| `TARGET_PLACEHOLDER_COMMENT` | yes | yes |
| `escapeRegex` | **no longer** | yes |

`escapeRegex` was deleted from `routes/index.js` in the 2026-07-30 cut-over. Move
it to `src/lib/text.js` anyway for cohesion, but it is a move, not a
de-duplication — do not describe it as one.

### 2a. Pin current behaviour before moving anything
Add `tests/lib-text.test.js` against the **existing** `routes/index.js` copies,
including the cases the two implementations could plausibly disagree on:
- `cleanText`: `undefined`, `null`, `''`, `'  a  b  '`, a string with newlines
  and tabs, a non-string (number, object).
- `isTargetPlaceholderComment`: exact match, differing case, surrounding
  whitespace, the string with one asterisk missing.
- `escapeRegex`: every character in ``.*+?^${}()|[]\``.

**Verify:** green *before* the move. **Then diff the two implementations by hand
and record any behavioural difference in the commit message** — if they differ,
picking one silently changes a caller, and that is exactly the kind of change
that passes tests written after the fact.

### 2b. Create `src/lib/text.js` and re-point both callers
Export the four helpers; delete the local copies; import in both files. No other
edit in the same commit.

**Verify:**
1. `./node_modules/.bin/vitest run` — every file green, including the new
   `lib-text` one. (Do not pin the count here; it was 16 when this was written
   and is 24 now.)
2. `grep -n "const cleanText\|const escapeRegex\|const isTargetPlaceholderComment\|TARGET_PLACEHOLDER_COMMENT =" src/routes/index.js src/services/reportImport.js`
   returns **nothing** — the definitions are gone, not merely shadowed.
3. `npm run check:inline-scripts` still reports 10 scripts.
4. `git diff --stat` shows only the three files.

### 2c. Do **not** continue into the route split in the same session
The split proper (`src/routes/report.js`, `src/routes/admin-staff.js`, …) is a
multi-hour change to a 2,073-line file with 68 endpoints and no route-level
integration coverage beyond what `tests/` already mocks. `route-auth-matrix.test.js`
now makes it materially safer — it would catch a guard lost in the move — but the
split still wants a session where it can be finished and verified in one go.

---

## What is deliberately not in this milestone

- **The route split itself** (§6.1) — needs a dedicated session; see 2c.
- **Canonical admin namespace** (§6.2) — needs a **DECISION** on which of the two
  parallel families is canonical, and a frontend migration.
- **`ImportJobs` audit table** (§6.6) — carries a pupil-data question and is
  entangled with the still-open "store confirmation metadata?" question from
  `docs/REDACTION-DECISIONS.md` decision 2. Both should be decided together.
- **Enabling CSP** (§6.4) — blocked behind moving inline scripts out of the HTML,
  which is larger than it looks (`index.html` alone carries most of the app).
- **Vendoring Atkinson Hyperlegible** (§6.8) — blocked on font files that cannot
  be fetched from this container.
