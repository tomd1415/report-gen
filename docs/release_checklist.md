# Release Checklist

Use this checklist before pulling or deploying changes on the live server.

## Before Pulling

- Confirm a recent database backup exists.
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
- Run migrations if new migration files were added:
  `node -e "import('./src/db/migrate.js').then(m=>m.runMigrations()).catch(console.error)"`
- Check that `.env` still has all variables listed in
  `comment-bank-api/.env.example`.

## Verify Before Restart

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
