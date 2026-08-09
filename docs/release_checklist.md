# Release Checklist

Use this checklist before pulling or deploying changes on the live server.

## Before Pulling

- Confirm a recent database backup exists **and contains tables**. Its existence
  is not enough: a failed `mysqldump` writes its header before it errors, so it
  leaves a well-formed ~871-byte file with a correct `-- MariaDB dump` banner and
  no data, and `exportDatabase` names files by date, so that stub overwrites a
  good backup taken earlier the same day (`docs/PROJECT_STATE.md` §6.10). One
  command tells them apart:

  ```bash
  ls -l <latest backup>.sql
  grep -c 'CREATE TABLE' <latest backup>.sql   # expect 11, not 0
  ```

  If that count is 0, the backup does not exist in any useful sense — stop, and
  take a fresh one before pulling. (The 11 is checked against the migrations by
  `tests/migration-coverage.test.js`, so it stays right as the schema grows.)
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
- Check service status:
  `sudo systemctl status reportgen -l`
- Check the health endpoint:
  `curl http://localhost:44344/api/health`
- Check the deployed version:
  `curl http://localhost:44344/api/version`
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
