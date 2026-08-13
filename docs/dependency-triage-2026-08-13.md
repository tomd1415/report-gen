# Dependency advisory triage — 2026-08-13

Every advisory classified **reachable-in-production / dev-only / unreachable**, with the
import chain traced for anything reachable. Nothing was upgraded: this is read-only, and
the upgrades it implies are a separate, sensitive piece of work.

The rule applied throughout: **a package name is not a reachability argument.** `mariadb`
and `mysql2` appear in no import anywhere and are load-bearing; `multer` looks like an
upload library nobody uses and is on a live request path. Both were only settled by
tracing.

---

## A discrepancy to resolve before trusting any number

GitHub reports **41** open advisories (1 critical, 16 high, 22 moderate, 2 low). Local
`npm audit` against the current lockfile reports **16** (1 critical, 6 high, 8 moderate,
1 low).

**I could not reconcile these, and I am not going to pretend otherwise.** The `gh` CLI is
not installed in this container, so the GitHub list cannot be read directly and I have
only the push banner's counts. The likely causes, in order:

1. GitHub raises **one alert per vulnerable path**, while `npm audit` groups by advisory —
   a package reached through three parents is three alerts and one audit entry.
2. GitHub scanned the lockfile **as committed on the default branch**, which until
   `01838bc` today still contained `axios` and its transitive tree.
3. GitHub alerts persist until dismissed or the fix lands on the default branch.

**What this means for the triage below:** it covers the 16 advisories that exist in the
tree as it stands. If the true figure is 41 alerts over the same 16 advisories, the
classification holds. If GitHub is seeing advisories `npm audit` is not, this triage is
incomplete — and the way to find out is to read the alert list, which needs `gh` or the
web UI. **That is the one open action from this item.**

---

## Critical

### `vitest@4.0.16` — Vitest UI server allows arbitrary file read and execution
**Dev-only, and the vulnerable feature is not used.**

- `vitest` is in `devDependencies`, not `dependencies`. It is not installed by
  `npm ci --omit=dev` and is never imported from `server.mjs`.
- The vulnerability requires the **UI server to be listening**. The scripts are
  `vitest run` and `vitest` (watch); neither passes `--ui`, and no script does.
- Chain from `server.mjs`: **none exists.**

Fix is in-range, so it costs nothing at the next dev-dependency refresh. It should not be
treated as a production-critical finding, and the "1 critical" headline is misleading if
read that way.

---

## High

### `multer@2.1.1` — DoS via deeply nested field names
**Reachable in production. The one finding here that is actually about this app.**

Traced chain:

```
server.mjs:6            createApp()
  src/app.js:73         registerRoutes(app, { models, openai })
    src/routes/index.js:5    import multer from 'multer'
    src/routes/index.js:39   const upload = multer({ dest: 'uploads/', limits: { fileSize: 5MB } })
    src/routes/index.js:1949 app.post('/api/import-categories-comments', upload.single('file'), …)
    src/routes/index.js:1479 app.post('/api/admin/staff/:userId/import-categories-comments', upload.single('file'), …)
```

**Who can reach it.** Both routes sit behind guards registered earlier in the same file —
`app.use('/api/import-categories-comments', isAuthenticated)` (line 474) and
`app.use('/api/admin/staff', isAuthenticated, isAdmin)` (line 472). Verified by sending
logged-out requests: both answer **401** with the guard's own body, so multer's parser is
never reached by an unauthenticated caller. Order matters here and was checked rather than
assumed — the guards are `app.use` on a prefix, which runs before the route's own
middleware.

So the exposure is: **any authenticated staff member, or anyone with a stolen session, can
hang the server with a crafted multipart body.** The `fileSize` limit does not help — the
advisory is about field *names*, not file size.

The second multer advisory (moderate, incomplete cleanup of aborted uploads) is on the same
path and leaves files in `uploads/`.

**Fix is in-range** (`>=2.2.0`), so a patch bump with no API change. This is the one item
worth doing promptly.

### `ws@8.19.0` — uninitialised memory disclosure; memory-exhaustion DoS
**Present in the production tree; the vulnerable code is not loaded.**

Two chains: `jsdom` (devDependency) and — the one that matters —
`openai@6.15.0 → ws`.

Measured rather than inferred: requiring `openai` loads **zero** modules from
`node_modules/ws/`. The SDK declares `ws` for its Realtime/websocket transport, and this
app uses only `openai.responses.parse`, so nothing pulls it in. A future feature using
Realtime would change this answer.

### `form-data@4.0.5` — CRLF injection via unescaped multipart field names
**Dev-only.** Chains: `jsdom` and `supertest → superagent`. Both devDependencies; neither
is reachable from `server.mjs`.

### `postcss@8.5.6`, `nanoid@3.3.11`, `vite@7.3.2`
**Dev-only.** All three sit under `vitest`:
`vitest → vite → postcss → nanoid`. No chain from `server.mjs` exists.

---

## Moderate and low

| Advisory | Classification | Traced basis |
|---|---|---|
| `qs@6.15.1` — `qs.stringify` DoS | **production tree, not attacker-reachable** | `express → qs` calls only `qs.parse` (`express/lib/utils.js:268`). `openai/client.js:156` *does* call `qs.stringify`, but on a query object the SDK builds from our own parameters — `responses.parse` sends a body, not user-controlled query params. |
| `uuid@8.3.2` — bounds check in v3/v5/v6 with `buf` | **unreachable** | Only reached via `sequelize`, whose `utils.js` requires `uuid.v1` and `uuid.v4` exclusively and never passes `buf`. The advisory is specific to v3/v5/v6. |
| `ajv@8.13.0` — ReDoS with the `$data` option | **production, boot-time only** | `umzug → @rushstack/ts-command-line → @rushstack/terminal → @rushstack/node-core-library → ajv`. Runs when `server.mjs:7` awaits `runMigrations()`. No user input reaches it — the schemas are umzug's own. |
| `@rushstack/*` ×3 | **same as `ajv`** | They are flagged solely as parents of it. |
| `sequelize`, `connect-session-sequelize` | **same as `uuid`** | Flagged solely as parents. Note both offer only **major-version** fixes (`sequelize@3.30.0` is a *downgrade* npm proposes — do not take it). |
| `body-parser@2.2.1` — DoS when an invalid `limit` is set | **unreachable** | `express → body-parser`. `src/app.js:56` calls `express.json()` with no `limit` option, so no invalid limit can be configured. |

---

## What to do, in order

1. **Bump `multer` to `>=2.2.0`.** In-range, no API change, and the only advisory traced to
   a live request path.
2. **Read the actual GitHub alert list** (needs `gh` or the web UI) and reconcile 41 against
   16. Until that is done, this triage is complete only for what the lockfile shows.
3. **Refresh the dev dependencies** — `vitest`/`vite`/`postcss`/`nanoid`/`form-data` all
   have in-range fixes and none affects production.
4. **Do nothing about `sequelize`/`connect-session-sequelize`.** npm's proposed "fix" is a
   major downgrade of `sequelize` to 3.30.0, which would break the entire data layer. This
   is exactly the case `docs/future_improvements.md` warns about: never run a broad
   `npm audit fix` on the live branch.

## What this triage does not establish

- That the 16 advisories are all of them — see the discrepancy above.
- That an unreachable dependency is *safe*; only that no current call path reaches the
  vulnerable code. A new feature can change that, and nothing in the repository would
  notice. The `ws` entry is the clearest example: one Realtime call would move it from
  "not loaded" to "in the request path".
