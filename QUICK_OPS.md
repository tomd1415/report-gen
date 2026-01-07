# Quick Ops Runbook (Report Generator)

Short, practical commands and checks for day-to-day operation.

---

## Start / Stop (systemd)

```
sudo systemctl start reportgen
sudo systemctl stop reportgen
sudo systemctl restart reportgen
sudo systemctl status reportgen -l
```

## Logs (systemd)

```
sudo journalctl -u reportgen -f
sudo journalctl -u reportgen --since "1 hour ago"
```

## Start / Stop (manual)

```
cd /path/to/report-gen/comment-bank-api
npm start
```

## Health Check

- Visit `http://localhost:44344`
- Log in and generate a test report for a known subject/year group.

---

## Database

### Backup (admin API, if enabled)

Set `ENABLE_DB_BACKUP=true` in `.env`, then:
```
curl -X POST http://localhost:44344/api/backup-database
curl -O http://localhost:44344/api/export-database
```

### Manual backup (MariaDB)

```
mysqldump -u reportgen -p comment_bank > comment_bank_backup.sql
```

### Restore (MariaDB)

```
mysql -u reportgen -p comment_bank < comment_bank_backup.sql
```

---

## Migrations

Run all migrations:
```
cd /path/to/report-gen/comment-bank-api
node -e "import('./src/db/migrate.js').then(m=>m.runMigrations()).catch(console.error)"
```

---

## OpenAI Config Changes

Edit `comment-bank-api/.env`:
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_REASONING_EFFORT`

Then restart:
```
sudo systemctl restart reportgen
```

---

## Admin Tasks

### Promote user to admin

```
mysql -u root -p
USE comment_bank;
UPDATE Users SET isAdmin = 1 WHERE username = 'yourname';
```

### Reset user password (admin API)

```
curl -X PUT http://localhost:44344/api/admin/user/USERNAME/password \
  -H "Content-Type: application/json" \
  -d '{"newPassword":"NEW_PASSWORD"}'
```

---

## Common Fixes

### MariaDB not starting

- Ensure data directory exists and is owned by mysql:
```
sudo mkdir -p /var/lib/mysql
sudo chown -R mysql:mysql /var/lib/mysql
sudo systemctl restart mariadb
```

### Sessions error (missing timestamps)

Run migrations:
```
cd /path/to/report-gen/comment-bank-api
node -e "import('./src/db/migrate.js').then(m=>m.runMigrations()).catch(console.error)"
```

### Out-of-scope comments in bank

- Re-import reports for that subject/year.
- Or delete the comment manually in the Manage Categories page.

---

## Quick Smoke Test Checklist

- Login works.
- Subject/year group lists load.
- Generate report creates 4 paragraphs.
- Paragraph 3 includes a subject-specific strength.
- Placeholder names replaced correctly.
- Relevance warning appears only for out-of-scope comments.

