# Report Generator (Update1)

This project generates school reports from a comment bank, with pupil names replaced by a placeholder before any OpenAI calls. It includes a small admin interface for managing subjects/year groups/users and tools to import/export comment banks.

## Quick Start

1) Install dependencies
```
cd comment-bank-api
npm install
```

2) Configure environment
- Copy `comment-bank-api/.env.example` to `comment-bank-api/.env` and fill in values.

3) Start the server
```
cd comment-bank-api
npm start
```

4) Open the app
- `http://localhost:44344`

## Database Setup (MariaDB/MySQL)

Create a database and user (example):
```
mysql -u root -p
CREATE DATABASE comment_bank;
CREATE USER 'reportgen'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON comment_bank.* TO 'reportgen'@'localhost';
FLUSH PRIVILEGES;
```

## Migrations

Migrations run automatically on server start. You can also run them manually:
```
cd comment-bank-api
node -e "import('./src/db/migrate.js').then(m=>m.runMigrations()).then(()=>console.log('migrated')).catch(console.error)"
```

## Admin User

Register a normal user, then promote to admin in the DB:
```
mysql -u root -p
USE comment_bank;
UPDATE Users SET isAdmin = 1 WHERE username = 'yourname';
```
Log out and back in so the session picks up the admin flag.

## Environment Variables

The app uses `comment-bank-api/.env` (see `comment-bank-api/.env.example`).

### Core
- `NODE_ENV`
  - Values: `development`, `test`, `production`
- `PORT`
  - Numeric port for the Express server (default: `44344`)

### OpenAI
- `OPENAI_API_KEY`
  - Your OpenAI API key (server-side only)
- `OPENAI_MODEL`
  - Model name for Responses API (default: `gpt-5.2`)
  - Use a model that supports Responses API + JSON schema output
- `OPENAI_REASONING_EFFORT`
  - Values: `none`, `minimal`, `low`, `medium`, `high`, `xhigh`

### Database
- `DB_HOST`
  - Hostname or IP (example: `127.0.0.1`)
- `DB_PORT`
  - Port number (default: `3306`)
- `DB_NAME`
  - Database name (example: `comment_bank`)
- `DB_USER`
  - Database user
- `DB_PASSWORD`
  - Database password
- `DB_DIALECT`
  - Values: `mariadb` or `mysql`
- `DB_LOGGING`
  - Values: `true` or `false` (SQL logging)

### Sessions
- `SESSION_SECRET`
  - Secret used to sign session cookies
- `SESSION_SECURE`
  - Values: `true` or `false` (set `true` when using HTTPS)
- `SESSION_SAMESITE`
  - Values: `lax`, `strict`, or `none`
- `SESSION_NAME`
  - Cookie name (default: `reportgen.sid`)
- `SESSION_MAX_AGE_MS`
  - Session lifetime in milliseconds (default: `1209600000` = 14 days)
- `SESSION_TRUST_PROXY`
  - Values: `true` or `false` (set `true` when behind a reverse proxy)

### Database Backups (Admin Only)
- `ENABLE_DB_BACKUP`
  - Values: `true` or `false` (default: `false`)
- `DB_BACKUP_DIR`
  - Directory for dumps (default: `./dbbackup_web`)

## Notes
- Pupil names are replaced with a placeholder before OpenAI calls; the placeholder is swapped back after generation.
- The import/merge pipeline uses JSON schema Structured Outputs to avoid brittle parsing.
- The server logs OpenAI request IDs for debugging.

## Troubleshooting
- If MariaDB fails to start, ensure the data directory exists and is owned by `mysql:mysql`.
- If you see session errors, confirm the `Sessions` table includes `createdAt` and `updatedAt` columns and that migrations ran.
