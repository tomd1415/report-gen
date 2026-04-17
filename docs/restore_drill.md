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
needed for the restore test:

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
```

Record the counts here:

- Users:
- Subjects:
- YearGroups:
- Categories:
- Comments:
- Prompts:
- SubjectContexts:

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
