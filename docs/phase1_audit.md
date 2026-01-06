# Phase 1 Audit (Update1)

## Inventory
- Entrypoint: `comment-bank-api/server.mjs` (Express, ESM).
- Static UI: `comment-bank-api/public/` (inline JS in HTML).
  - Pages: `index.html`, `login.html`, `register.html`, `admin-login.html`, `adminpage.html`,
    `manage_categories_comments.html`, `manage_subjects_years.html`, `manage_years_subjects.html`,
    `manage_export_import.html`, `import_reports.html`, `settings.html`, `header.html`, `footer.html`.
- DB: Sequelize models defined inline in `comment-bank-api/server.mjs`; uses `sequelize.sync` (no migrations).
- OpenAI: `openai.chat.completions` with `gpt-4` and `gpt-4o`.
- Sessions: `express-session` default memory store, cookie `secure: false`.
- Uploads: `multer` temp files to `uploads/`.
- Backup/Export: `exec` with `mysqldump` plus hardcoded path `/home/duguid/apps/report-gen/dbbackup_web`.

## API Surface (Grouped)
- Auth/session: `/api/register`, `/api/login`, `/api/logout`, `/api/authenticated`, `/api/user-info`,
  `/api/admin/login`, `/api/change-password`.
- Admin/user management: `/api/users`, `/api/users/:username`, `/api/admin/user`,
  `/api/admin/user/:username`, `/api/admin/user/:username/password`.
- Subjects/year groups: `/api/subjects`, `/api/subjects/:id`, `/api/year-groups`, `/api/year-groups/:id`,
  plus admin-only `/api/admin/subject`, `/api/admin/subject/:name`, `/api/admin/year-group`,
  `/api/admin/year-group/:name`.
- Categories/comments: `/api/categories`, `/api/categories/:id`, `/api/comments`, `/api/comments/:id`,
  `/api/move-comment`, `/api/categories-comments`.
- Prompts: `/api/prompts`, `/api/prompts/:subjectId/:yearGroupId`, `/api/prompts/:id`.
- Reports: `/generate-report`, `/api/import-reports`.
- Import/export: `/api/export-categories-comments`, `/api/import-categories-comments`,
  `/api/export-database`, `/api/backup-database`, `/api/admin/export`, `/api/admin/backup`.
- User settings: `/api/user-subjects`, `/api/user-year-groups`, `/api/user-settings`,
  `/api/user-selected-settings`.

## Frontend to API Usage (Observed)
- `index.html`: `/api/authenticated`, `/api/user-info`, `/api/user-selected-settings`,
  `/api/subjects`, `/api/year-groups`, `/api/categories-comments`, `/api/prompts` (query params),
  `/api/comments`, `/generate-report`, `/api/logout`.
- `import_reports.html`: `/api/authenticated`, `/api/user-selected-settings`, `/api/subjects`,
  `/api/year-groups`, `/api/import-reports`.
- `manage_categories_comments.html`: `/api/authenticated`, `/api/user-selected-settings`,
  `/api/subjects`, `/api/year-groups`, `/api/categories-comments`, `/api/categories`, `/api/comments`,
  `/api/move-comment`.
- `manage_subjects_years.html`: `/api/authenticated`, `/api/user-selected-settings`,
  `/api/subjects`, `/api/year-groups`, `/api/prompts/:subjectId/:yearGroupId`.
- `manage_years_subjects.html`: `/api/authenticated`, `/api/subjects`, `/api/year-groups`.
- `manage_export_import.html`: `/api/authenticated`, `/api/user-selected-settings`,
  `/api/subjects`, `/api/year-groups`, `/api/export-categories-comments`,
  `/api/import-categories-comments`.
- `settings.html`: `/api/user-info`, `/api/user-settings`, `/api/subjects`, `/api/year-groups`,
  `/api/user-year-groups`, `/api/user-subjects`, `/api/change-password`.
- `adminpage.html`: `/api/authenticated`, `/api/user-info`, `/api/subjects`, `/api/year-groups`,
  `/api/users`, `/api/admin/user/:username/password`, `/api/export-database`, `/api/backup-database`.
- `login.html`, `register.html`, `admin-login.html`: `/api/login`, `/api/register`, `/api/admin/login`.

## Notable Mismatches or Issues
- Duplicate admin endpoints exist (`/api/admin/*`) but the UI uses the non-admin versions.
- Absolute path for backup/export is tied to a different filesystem location than this repo.

## Cleanup Candidates (Confirmed Deleted)
- Legacy server copies: `comment-bank-api/server.mjs2`, `comment-bank-api/server.mjs4`,
  `comment-bank-api/server.mjs.bak`, `comment-bank-api/server.mjs.bak2`,
  `comment-bank-api/server.mjs.bak5`.
- Unused route/model artifacts: `comment-bank-api/routes/comments.js`,
  `comment-bank-api/models/index.js.bak`.
- Orphan/unused static: `comment-bank-api/public/settings.js`.
- Misc: `comment-bank-api/cookies.txt`.
## Dependency Consolidation
- Root `package.json` and `package-lock.json` removed.
- `express-session` moved into `comment-bank-api/package.json`.
- Root `node_modules` is now orphaned; safe to delete after reinstalling in `comment-bank-api`.

## Baseline Manual Test Checklist (Current Behavior)
- Auth: register, login, logout; admin login; password change.
- Settings: select subjects/year groups per user and see them reflected in dropdowns.
- Comment bank: load categories/comments, add comment, move comment, delete category/comment.
- Prompt management: save prompt part per subject/year group; reload prompt.
- Report generation: generate report with placeholders; verify pupil name substitution.
- Imports: import raw reports to generate categories/comments; import/export CSV.
- Admin: add/delete subjects/year groups/users; backup/export database.
## Sample Data Notes
- Sample seed function exists in `comment-bank-api/server.mjs` as `addSampleData()` (currently commented out).
  It can be used to populate a baseline subject/year group and sample categories/comments.

## Target Stack Decision (Chosen)
- Chosen: Option A (Express + Sequelize).
  - Reason: lowest risk and fastest path to modernize while preserving current workflows; easier Debian/Gentoo compatibility.
  - Revisit later if a UI rewrite becomes a priority.

## Phase 1 Actions Completed
- Added admin-only guards to subject/year group/user/backup endpoints.
- Fixed `/api/prompts` query compatibility and restored the missing `PUT /api/prompts/:id`.
- Added `GET /api/users` for admin UI.
