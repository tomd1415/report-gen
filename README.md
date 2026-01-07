# Report Generator (Update1)

This project generates school reports from a curated comment bank. Pupil names are never sent to OpenAI: they are replaced with a placeholder before any OpenAI call and swapped back after the report is generated.

The workflow is:
1) Import old reports to build a comment bank.
2) Select comments per paragraph and generate a new report.
3) Produce a 4-paragraph report aligned to current school guidance.

The system also supports a per-subject/year-group subject description (shown to staff and used as AI context, but never repeated in the report).

---

## Key Features

- 4-paragraph reports with strict structure:
  1) Topics/areas studied so far; key knowledge/skills acquired.
  2) Effort/motivation/attendance to lesson.
  3) Strengths and particular achievements (must include a subject-specific strength).
  4) Areas for development to bolster progress and achieve end-of-year Teacher Target.
- Comment bank aligned to those paragraph groups (plus General/Other).
- Per subject/year-group subject description and optional word limit.
- Strength focus for paragraph 3 (topic + level) to guarantee subject-specific detail.
- Relevance check: warns if selected comments are out of scope for the subject description (with an override option).
- Import pipeline uses structured outputs (JSON schema) and can add a few extra helpful comments per category, grounded in the subject description.
- Privacy controls: `store: false` and hashed `safety_identifier` per user.
- Admin tools for managing users, subjects, year groups, prompts, and import/export.
- Rate limiting on OpenAI-backed endpoints.

---

## Architecture Overview

- **Backend:** Node.js + Express
- **Database:** MariaDB/MySQL via Sequelize
- **OpenAI:** Responses API with JSON schema structured outputs
- **Frontend:** Static HTML/CSS/JS in `comment-bank-api/public`

---

## Directory Layout

```
comment-bank-api/
  public/                # Static frontend pages
  src/
    routes/              # Express routes
    db/                  # Sequelize setup + migrations runner
    models/              # Sequelize models
    middleware/          # Auth and security middleware
    services/            # Backup and helpers
  migrations/            # Database migrations (Umzug)
  tests/                 # Vitest/Supertest tests
  server.mjs             # App entrypoint
```

---

## Requirements

- Node.js 20+ (LTS recommended)
- MariaDB 10.6+ or MySQL 8+
- A valid OpenAI API key with access to the Responses API

---

## Quick Start

1) Install dependencies:
```
cd comment-bank-api
npm install
```

2) Configure environment:
- Copy `comment-bank-api/.env.example` to `comment-bank-api/.env` and fill in values.

3) Database setup (MariaDB/MySQL):
```
mysql -u root -p
CREATE DATABASE comment_bank;
CREATE USER 'reportgen'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON comment_bank.* TO 'reportgen'@'localhost';
FLUSH PRIVILEGES;
```

4) Run migrations (automatically run on server start):
```
cd comment-bank-api
node -e "import('./src/db/migrate.js').then(m=>m.runMigrations()).then(()=>console.log('migrated')).catch(console.error)"
```

5) Start the server:
```
cd comment-bank-api
npm start
```

6) Open the app:
- `http://localhost:44344`

---

## Usage Guide

### 1) Admin setup (first run)
- Register a user on the login page.
- Promote the user to admin:
```
mysql -u root -p
USE comment_bank;
UPDATE Users SET isAdmin = 1 WHERE username = 'yourname';
```
- Log out and back in to refresh session state.

### 2) Configure subjects and year groups
Use the admin pages to create subjects and year groups. Then use settings to select the subjects/year groups for your account.

### 3) Add subject descriptions and optional word limits
- A subject description is **displayed before the report** when printed, but must **not be repeated** in the report text.
- It is used for comment relevance checks and to guide comment generation.
- Word limit is optional per subject/year group (users can override per report).

### 4) Build a comment bank
You have three options:

**Option A: Import reports (recommended)**
- Go to "Create Comments".
- Provide a comma-separated list of pupil names (to be replaced with `PUPIL_NAME`).
- Paste reports.
- The system extracts structured categories + comments and adds a few extra helpful comments per category (when justified by the subject description).

**Option B: CSV import**
- Upload a CSV with columns `categoryName` and `commentText`.

**Option C: Manual entry**
- Use the Manage Categories/Comments page.

### 5) Generate a report
- Select subject + year group.
- Enter pupil name and pronouns (required).
- Pick at least one comment in each of the 4 main paragraph groups.
- Optionally add:
  - Strength focus (topic + level) for paragraph 3.
  - Additional comments to weave across the report.
  - A word limit (overrides subject default).
- Click Generate.

If any comments are out of scope for the subject description, you will see a warning and can either revise or override.

---

## Prompt Rules and Output Format

### Report structure
- Exactly 4 paragraphs.
- No headings, no bullet points.
- Paragraph order is fixed (see above).
- Paragraph 3 must include at least one subject-specific strength.
- Additional comments should be woven throughout the report, not clustered.

### Placeholders
- Pupil names are replaced with `PUPIL_NAME` before any OpenAI call.
- The placeholder is swapped back at the end.

### Target placeholder comment
The comment:
```
***Generate a target for this pupil and add to the report***
```
- Is always allowed in paragraph 4.
- Is excluded from relevance checks.

---

## OpenAI Integration Details

- Uses Responses API with JSON schema structured outputs.
- `store: false` is enforced.
- `safety_identifier` is a hashed user ID.
- The system logs OpenAI request IDs to stdout for troubleshooting.

---

## Environment Variables (Complete Reference)

All variables live in `comment-bank-api/.env`.

### Core
- `NODE_ENV`: `development`, `test`, `production`
- `PORT`: numeric port for Express (default `44344`)

### OpenAI
- `OPENAI_API_KEY`: your API key
- `OPENAI_MODEL`: Responses API model (default `gpt-5.2`)
- `OPENAI_REASONING_EFFORT`: `none`, `minimal`, `low`, `medium`, `high`, `xhigh`

### Database
- `DB_HOST`: database host (example `127.0.0.1`)
- `DB_PORT`: database port (default `3306`)
- `DB_NAME`: database name (example `comment_bank`)
- `DB_USER`: database user
- `DB_PASSWORD`: database password
- `DB_DIALECT`: `mariadb` or `mysql`
- `DB_LOGGING`: `true` or `false`

### Sessions
- `SESSION_SECRET`: secret used to sign cookies
- `SESSION_SECURE`: `true` if HTTPS, otherwise `false`
- `SESSION_SAMESITE`: `lax`, `strict`, `none`
- `SESSION_NAME`: cookie name (default `reportgen.sid`)
- `SESSION_MAX_AGE_MS`: session lifetime in ms (default `1209600000` = 14 days)
- `SESSION_TRUST_PROXY`: `true` if behind reverse proxy

### Rate Limiting (OpenAI endpoints)
- `RATE_LIMIT_WINDOW_MS`: time window in ms (default `60000`)
- `RATE_LIMIT_MAX`: max requests per window per user/IP (default `30`)

### Database Backups (Admin only)
- `ENABLE_DB_BACKUP`: `true` or `false`
- `DB_BACKUP_DIR`: backup directory (default `./dbbackup_web`)

---

## Admin Workflows

### Manage users
- Promote user to admin using SQL (see Admin setup above).
- Reset a user password (admin only API):
  - `PUT /api/admin/user/:username/password`

### Manage subjects, year groups, prompts
- Use the admin pages to create/edit subjects and year groups.
- Prompts are per user + subject + year group.

### Export/backup database (admin only)
- `GET /api/export-database`
- `POST /api/backup-database`
- Requires `ENABLE_DB_BACKUP=true`

---

## Deployment (Debian-oriented)

### Recommended steps
1) Install Node.js and MariaDB:
```
sudo apt-get update
sudo apt-get install -y mariadb-server
# Install Node.js via NodeSource or distribution packages
```

2) Configure DB user + database (see Quick Start).

3) Set environment variables in a `.env` file.

4) Run migrations:
```
cd /path/to/report-gen/comment-bank-api
node -e "import('./src/db/migrate.js').then(m=>m.runMigrations()).catch(console.error)"
```

5) Start the app with systemd (example):
```
# /etc/systemd/system/reportgen.service
[Unit]
Description=Report Generator
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/report-gen/comment-bank-api
EnvironmentFile=/path/to/report-gen/comment-bank-api/.env
ExecStart=/usr/bin/node server.mjs
Restart=on-failure
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```
```
sudo systemctl daemon-reload
sudo systemctl enable reportgen
sudo systemctl start reportgen
```

### Reverse proxy (optional but recommended)
Use Nginx or Apache and set:
- `SESSION_TRUST_PROXY=true`
- `SESSION_SECURE=true`
- `SESSION_SAMESITE=none` if cross-site

Example Nginx block:
```
server {
    listen 80;
    server_name reportgen.example.com;

    location / {
        proxy_pass http://127.0.0.1:44344;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Testing

Run all tests:
```
cd comment-bank-api
npm test
```

Watch mode:
```
cd comment-bank-api
npm run test:watch
```

---

## Migration Checklist (Phase 9)

Use this when upgrading from the old project:

1) Backup the existing database.
2) Update dependencies (`npm install`).
3) Configure `.env` with the new variables (see `.env.example`).
4) Run migrations (Umzug) to create new tables (e.g., `SubjectContexts`).
5) Confirm `Sessions` table has `createdAt` and `updatedAt` columns.
6) Set `OPENAI_MODEL=gpt-5.2` and `OPENAI_REASONING_EFFORT` as desired.
7) Verify `store: false` and `safety_identifier` are configured (already in code).
8) Import reports again to generate a refreshed comment bank aligned to the new 4-paragraph rules.
9) Test report generation with sample pupils and confirm 4-paragraph output.

---

## Troubleshooting

- **MariaDB won't start**: ensure `/var/lib/mysql` exists and is owned by `mysql:mysql`.
- **Session errors**: run migrations to add timestamps to `Sessions`.
- **OpenAI errors**: verify `OPENAI_API_KEY` and model name.
- **Reports not 4 paragraphs**: confirm JSON schema responses from OpenAI and retry.
- **Out-of-scope comments**: review subject description or re-import to regenerate the comment bank.

---

## Notes on Privacy

- Pupil names are never sent to OpenAI.
- The only context sent is comments and the subject description.
- `store: false` is enforced for Responses API calls.
- A hashed `safety_identifier` is used per user.

---

## License

See footer text in the UI and `reportgen.org.uk` for licensing details.
