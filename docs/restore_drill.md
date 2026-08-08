# Restore Drill

Use this drill to prove a database backup can be restored before relying on it
for a live update or risky admin work. Run it against a test database, not the
live database.

## What This Checks

- The backup file is readable.
- Users, subjects, year groups, prompts, subject contexts, categories, and
  comments restore into a separate database.
- A staff login can still load settings and generate a report after restore.
- The restore process is understood before an emergency.

## Before You Start

Record:

- Backup file path:
- Source server:
- Git commit currently deployed:
- Date/time of drill:
- Person running drill:

Do not overwrite the live database during a drill. Use a separate database name,
for example `comment_bank_restore_test`.

## 1. Create A Test Database

```bash
mysql -u root -p
CREATE DATABASE comment_bank_restore_test;
CREATE USER IF NOT EXISTS 'reportgen_restore'@'localhost' IDENTIFIED BY 'choose_a_test_password';
GRANT ALL PRIVILEGES ON comment_bank_restore_test.* TO 'reportgen_restore'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 2. Restore The Backup Into The Test Database

> **Check the file is a real backup before you restore it.** A `mysqldump` that
> fails still writes its header first, so a failed backup leaves a well-formed
> ~870-byte file with a correct `-- MariaDB dump` banner and no data
> (`docs/PROJECT_STATE.md` §6.10). One command tells them apart:
>
> ```bash
> ls -l /path/to/comment_bank_backup.sql
> grep -c 'CREATE TABLE' /path/to/comment_bank_backup.sql   # expect 11, not 0
> ```
>
> If that count is 0, stop — the file is a failed dump, not a backup, and
> restoring it will give you an empty database with no error at all.

For a plain SQL dump:

```bash
mysql -u reportgen_restore -p comment_bank_restore_test < /path/to/comment_bank_backup.sql
```

If the backup is compressed:

```bash
gunzip -c /path/to/comment_bank_backup.sql.gz | mysql -u reportgen_restore -p comment_bank_restore_test
```

## 3. Point A Test App At The Restored Database

Copy the existing `.env` to a temporary test version and change only the values
needed for the restore test.

> **Stop and read this first.** `.env.restore-test` is a **full copy of your
> production secrets** — database password, `SESSION_SECRET`, and your
> `OPENAI_API_KEY`. As of 2026-08-06 `.gitignore` covers `.env` but **not**
> `.env.*`, so this file shows up as untracked in `git status` and a
> `git add -A` on the live server would commit your API key. Exclude it locally
> **before** you create it:
>
> ```bash
> cd /path/to/report-gen
> printf 'comment-bank-api/.env.restore-test\n' >> .git/info/exclude
> ```
>
> `.git/info/exclude` is local to that checkout and is not itself a repo change.
> Delete the file at the end of the drill (§7) rather than leaving it on the
> server.

```bash
cd /path/to/report-gen/comment-bank-api
cp .env .env.restore-test
```

Set these values in `.env.restore-test`:

```text
PORT=44345
DB_NAME=comment_bank_restore_test
DB_USER=reportgen_restore
DB_PASSWORD=choose_a_test_password
SESSION_NAME=reportgen.restore.sid
```

Start the app with the test environment:

```bash
cd /path/to/report-gen/comment-bank-api
set -a
. ./.env.restore-test
set +a
npm start
```

Keep this terminal open while you test. The app should be available at:

```text
http://localhost:44345
```

## 4. Run Migrations Against The Restored Database

If the backup is from an older deployed commit, run migrations against the test
database after loading `.env.restore-test`:

```bash
cd /path/to/report-gen/comment-bank-api
set -a
. ./.env.restore-test
set +a
node -e "import('./src/db/migrate.js').then(m=>m.runMigrations()).catch(console.error)"
```

## 5. Verify Restored Data

In MySQL, check key tables have rows:

```sql
USE comment_bank_restore_test;
SELECT COUNT(*) FROM Users;
SELECT COUNT(*) FROM Subjects;
SELECT COUNT(*) FROM YearGroups;
SELECT COUNT(*) FROM Categories;
SELECT COUNT(*) FROM Comments;
SELECT COUNT(*) FROM Prompts;
SELECT COUNT(*) FROM SubjectContexts;
SELECT COUNT(*) FROM UserSubjects;
SELECT COUNT(*) FROM UserYearGroups;
```

`UserSubjects` and `UserYearGroups` were added to this list on 2026-08-06; the
drill had been checking the seven content tables and not these two. They are the
join tables recording **which subjects and year groups each staff member has
selected**, and they fail quietly: restore them empty and every teacher logs in
to a Settings page with nothing chosen and a Generate Report page that lists no
subjects. Nothing errors, and the seven counts above all look healthy. §6's
"Settings shows the expected subjects and year groups" would catch it, but only
if the drill is run by hand and only for the one account tested — which is
exactly the step people skip when the counts already look right.

Record the counts here:

- Users:
- Subjects:
- YearGroups:
- Categories:
- Comments:
- Prompts:
- SubjectContexts:
- UserSubjects:
- UserYearGroups:

## 6. Browser Smoke Test

Open `http://localhost:44345` and check:

- A known staff user can log in.
- Settings shows the expected subjects and year groups.
- Manage Comments shows a known comment bank.
- Generate Report loads a known subject/year group.
- A small test report can be generated.
- Admin login works for a known admin account.
- Admin Staff Comment Banks shows the expected staff users.

## 7. Finish And Clean Up

Stop the test app with `Ctrl+C`.

Delete the secrets copy — it is a live `OPENAI_API_KEY` and `SESSION_SECRET`
sitting on disk:

```bash
rm -f /path/to/report-gen/comment-bank-api/.env.restore-test
```

If the drill is complete and the test database is no longer needed:

```bash
mysql -u root -p
DROP DATABASE comment_bank_restore_test;
DROP USER 'reportgen_restore'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Keep a short record of the drill result:

- Drill passed:
- Issues found:
- Fixes needed:
- Backup file tested:
- Restore completed at:
