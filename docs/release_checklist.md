# Release Checklist

Use this checklist before pulling or deploying changes on the live server.

> **Every command on this page was executed on 2026-08-14**, rather than written
> from memory — one of them was wrong (the backup check, corrected below). The two
> exceptions, which cannot be tested from a container: `sudo systemctl restart
> reportgen` and anything that assumes production's own database. Those remain
> written-not-run, and are marked where they appear.

## Before Pulling

- Confirm a recent database backup exists **and contains tables**. Its existence
  is not enough: a failed `mysqldump` writes its header before it errors, so it
  leaves a well-formed ~871-byte file with a correct `-- MariaDB dump` banner and
  no data, and `exportDatabase` names files by date, so that stub overwrites a
  good backup taken earlier the same day (`docs/PROJECT_STATE.md` §6.10). One
  command tells them apart:

  ```bash
  ls -l <latest backup>.sql
  grep -c 'CREATE TABLE' <latest backup>.sql
  ```

  **Zero versus non-zero is the test.** 0 means a failed dump — stop, and take a
  fresh one before pulling. 12 is the current schema. Anything else non-zero is a
  genuine older backup from before the schema grew (the 2024 dumps return 6, 6 and
  8), so it is usable but may not be the one you meant. Measured 2026-08-14
  against real files; an earlier version of this line said "expect 12, not 0",
  which wrongly implied 8 was a problem. (The 12 is checked against the migrations
  by `tests/migration-coverage.test.js`, so it stays right as the schema grows.)
- If the update is risky, confirm the backup has recently passed the restore
  drill in `docs/restore_drill.md`.
- Confirm a recent file/server backup exists if uploads, `.env`, or service
  files may have changed.
- Note the currently deployed git commit:
  `git rev-parse --short HEAD`
- Check local server changes:
  `git status --short`
- If the live server has uncommitted local edits, stop and decide whether those
  edits need to be committed, copied elsewhere, or intentionally left alone.

## Pull And Prepare

- Pull the intended branch only after checking the branch name:
  `git branch --show-current`
- Install dependency changes if `package-lock.json` or `package.json` changed:
  `npm install`
- Run migrations if new migration files were added. Run this from
  `comment-bank-api/`, and note the `process.exit(1)` — **without it the command
  prints the error and still exits 0**, so a scripted deploy would carry on past a
  failed migration:

  ```bash
  cd /path/to/report-gen/comment-bank-api
  node -e "import('./src/db/migrate.js').then(m=>m.runMigrations()).catch(e=>{console.error(e);process.exit(1)})"
  ```

  Exit 0 still does not prove a migration *ran*: umzug resolves happily when its
  glob matches nothing (measured — `docs/PROJECT_STATE.md` §6.13). If you expected
  a new table, check for it rather than trusting the exit code.
- Check that `.env` still has all variables listed in
  `comment-bank-api/.env.example`.
- For production, confirm `SESSION_SECRET` is a long random value,
  `ALLOW_REGISTRATION_IN_PROD=false`, `CORS_ORIGINS` is set to the live origin,
  and HTTPS deployments use `SESSION_SECURE=true`.

  > **⚠ Changed 2026-08-13 — read this before your next restart.** Two of those are
  > now **fatal** under `NODE_ENV=production`: the app **refuses to start** if
  > `SESSION_SECRET` is unset or still a published placeholder (`change-me`,
  > `dev-insecure-secret`), or if `CORS_ORIGINS` is empty. It exits non-zero at
  > import, before it can serve a request.
  >
  > **A deployment that is running happily today without them will not come back
  > up.** That is deliberate — a known session secret lets anyone forge a login
  > cookie, and an empty allow-list makes a misconfigured deploy look like a broken
  > frontend rather than a config error — but it means you should check *now*
  > rather than discover it during a restart:
  >
  > ```bash
  > cd /path/to/report-gen/comment-bank-api
  > grep -E '^(SESSION_SECRET|CORS_ORIGINS)=' .env
  > # then confirm the app will actually boot, without restarting the live service:
  > NODE_ENV=production node -e "import('./src/config/env.js')" && echo "config OK"
  > ```
  >
  > That last line is the real check: it loads the same module the server loads and
  > exits non-zero with the reason if anything is wrong. If you need a secret:
  > `openssl rand -base64 32`.
- Confirm auth throttling is present in `.env` or using defaults:
  `AUTH_RATE_LIMIT_WINDOW_MS=900000` and `AUTH_RATE_LIMIT_MAX=20`.

## Verify Before Restart

- Run the combined pre-deploy check when practical:
  `npm run check:deploy`
- Run the automated tests when practical:
  `npm test`
- Run browser smoke tests when UI behaviour changed:
  `npm run test:e2e`
- Start or restart the service:
  `sudo systemctl restart reportgen`

  **A pull is only half a deploy until you do this, and the two halves are not
  symmetrical.** Measured 2026-08-12 against the running instance: files under
  `public/` are served by `express.static` and read from disk **per request**, so
  a pulled page, stylesheet or browser module is live the instant it lands — no
  restart, no commit needed. Everything under `src/` is loaded once into the
  Node module cache at start and does **not** change until the process does.

  So between the pull and the restart the browser is running the new contract
  while the server is still running the old one. On this app that window includes
  the free-text privacy controls, whose page-side confirm and server-side
  handling have to agree. Pull and restart together; do not pull and "restart
  later".
- Check service status:
  `sudo systemctl status reportgen -l`
- Check the health endpoint:
  `curl http://localhost:44344/api/health`
- Check the service answers, and note what this does **not** tell you:
  `curl http://localhost:44344/api/version`

  Measured 2026-08-12 — it returns `"commit": null`. The endpoint reads the first
  of `GIT_COMMIT`, `SOURCE_VERSION`, `RENDER_GIT_COMMIT`, `COMMIT_SHA` that is
  set, and nothing in this deployment sets any of them (`README.md` is accurate
  about that; it is the checklist that implied more). So this step confirms the
  service is up and reports the **package** version. It cannot tell you which
  code is running.

  To make it able to, start the service with the commit in its environment — in
  the systemd unit, or:

  ```bash
  GIT_COMMIT=$(git rev-parse --short HEAD) npm start
  ```

  Until then, the deployed commit is the one you noted before pulling **and only
  after the restart below** — see the next item for why.
- **Confirm the schema actually matches the code** — the check that catches a
  migration which silently did not run:

  ```bash
  cd /path/to/report-gen/comment-bank-api
  node scripts/check-schema.mjs
  ```

  Read-only (`SHOW TABLES` and `DESCRIBE`), exits non-zero naming the model and
  the missing table or column. This exists because umzug's `up()` resolves
  happily when its glob matches nothing — `pending: 0, ran: 0`, no error
  (`PROJECT_STATE.md` §6.13) — and `server.mjs` awaits it at the top level, so a
  migration can fail to run without anything saying so. On an existing database
  the symptom is not a crash; it is one feature breaking later with nothing
  connecting it to the deploy.

  The unit suite cannot do this: it mocks the models and needs no database, which
  is its most valuable property. This is the other half, and it needs a real
  connection.
- Check database connectivity from an authenticated admin browser session:
  `/api/health/db`
- Watch logs while doing the smoke test:
  `sudo journalctl -u reportgen -f`

## Smoke Test

- Log in as a normal staff user.
- Confirm the shared menu shows Settings and Logout.
- Log in as an admin user.
- Confirm the shared menu shows Admin.
- Load subjects and year groups.
- Confirm the Generate Report ready checklist updates as required fields and
  comments are selected.
- Generate a small test report for a known subject/year group.
- Confirm the Generate Report form clears only after a valid 4-paragraph report
  is returned.
- Confirm import pages highlight the first missing required field if submitted
  incomplete.
- If deploying import changes, run one small import into a test or low-risk
  account first.
- Confirm existing saved comments are still visible for a known staff account.

## Rollback Notes

- If the app does not start, return to the previous git commit noted above and
  restart the service.
- If a bad import was submitted, restore the affected data from backup or
  re-import the last known-good comment bank for that subject/year group.
- Do not run destructive database commands unless the backup has been checked
  and the affected account/subject/year group is clear.
