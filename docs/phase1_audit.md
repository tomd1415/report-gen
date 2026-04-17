# Phase 1 Audit (Current State)

This audit reflects the current refactored codebase, not the older monolithic
server implementation.

## Inventory

- Entrypoint: `comment-bank-api/server.mjs`.
- App setup: `comment-bank-api/src/app.js`.
- Routes: `comment-bank-api/src/routes/index.js`.
- Models: `comment-bank-api/src/models/index.js`.
- DB: MariaDB/MySQL through Sequelize.
- Migrations: Umzug migrations in `comment-bank-api/migrations/`.
- OpenAI: Responses API via `openai.responses.parse`.
- Sessions: `express-session` with `connect-session-sequelize` persisted in the
  `Sessions` table.
- Static UI: `comment-bank-api/public/`.

## Static Pages

- `index.html`: generate reports from selected comments, with paragraph tabs,
  a selection summary, a ready checklist, and empty-state handling.
- `import_reports.html`: paste old reports to generate a comment bank, with
  field-specific validation and page-level import status.
- `manage_categories_comments.html`: manually manage categories/comments, with
  search, counts, expand/collapse controls, empty-state handling, and clearer
  delete confirmations.
- `manage_subjects_years.html`: manage per-user prompt text, subject
  description, and default word limit.
- `manage_export_import.html`: export/import CSV comment banks, with
  field-specific validation and page-level import/export status.
- `settings.html`: choose visible subjects/year groups and change password.
- `adminpage.html`: manage global subjects, year groups, users, password resets,
  staff comment-bank imports, and database backup/export.
- `login.html`, `register.html`, `admin-login.html`: auth pages.
- `header.html`, `footer.html`: shared static fragments.

## Data Ownership

- `Category` rows are scoped by `userId`, `subjectId`, and `yearGroupId`.
- `Prompt` rows are scoped by `userId`, `subjectId`, and `yearGroupId`.
- `SubjectContext` rows are scoped by `userId`, `subjectId`, and `yearGroupId`.
- `Comment` rows inherit ownership through their category.
- `Subject` and `YearGroup` rows are global.
- Staff-visible subject/year options are stored in `UserSubject` and
  `UserYearGroup`.

This means the schema supports separate comment banks for different staff. The
admin staff import workflow now writes imports to a selected target staff user
instead of the currently logged-in admin user.

## API Surface

### Auth/session

- `POST /api/register`
- `POST /api/login`
- `POST /api/admin/login`
- `POST /api/logout`
- `GET /api/authenticated`
- `GET /api/user-info`
- `POST /api/change-password`

### Admin/user management

- `GET /api/users`
- `POST /api/users`
- `DELETE /api/users/:username`
- `PUT /api/admin/user/:username/password`
- `GET /api/export-database`
- `POST /api/backup-database`
- Duplicate legacy admin routes also exist under `/api/admin/*`.

### Subjects/year groups

- `GET /api/subjects`
- `POST /api/subjects` (admin only)
- `PUT /api/subjects/:id` (admin only)
- `DELETE /api/subjects/:id` (admin only)
- `GET /api/year-groups`
- `POST /api/year-groups` (admin only)
- `PUT /api/year-groups/:id` (admin only)
- `DELETE /api/year-groups/:id` (admin only)

### Categories/comments

- `GET /api/categories-comments`
- `GET /api/categories/:id`
- `POST /api/categories`
- `PUT /api/categories/:id`
- `DELETE /api/categories/:id`
- `GET /api/comments`
- `GET /api/comments/:id`
- `POST /api/comments`
- `PUT /api/comments/:id`
- `DELETE /api/comments/:id`
- `POST /api/move-comment`

### Prompts and subject context

- `GET /api/prompts`
- `GET /api/prompts/:subjectId/:yearGroupId`
- `POST /api/prompts`
- `PUT /api/prompts/:subjectId/:yearGroupId`
- `PUT /api/prompts/:id`
- `DELETE /api/prompts/:id`
- `DELETE /api/prompts/:subjectId/:yearGroupId`
- `GET /api/subject-context`
- `POST /api/subject-context`

### Report generation and import/export

- `POST /generate-report`
- `POST /api/import-reports`
- `GET /api/export-categories-comments`
- `POST /api/import-categories-comments`

### User settings

- `POST /api/user-subjects`
- `POST /api/user-year-groups`
- `GET /api/user-settings`
- `GET /api/user-selected-settings`

## Feature-Relevant Current Behavior

- `import_reports.html` and `/api/import-reports` import pasted reports for the
  current session user.
- `manage_export_import.html` and `/api/import-categories-comments` replace CSV
  categories/comments for the current session user.
- `index.html` and `/generate-report` generate reports from the current session
  user's comment bank only.
- `adminpage.html` now includes a Staff Comment Banks section that lets admins
  import pasted reports for a selected staff user, subject, and year group.
- The Staff Comment Banks section is shown as a three-step admin workflow:
  choose staff/class, set context, then import previous reports.
- Main browser workflows use shared helpers for page-level status, context
  chips, button loading states, comment-bank filtering, and invalid-field
  styling.
- Admin target-staff endpoints exist under `/api/admin/staff/:userId/*`.
- The existing OpenAI import flow already supports subject/year scoped comments,
  name placeholder replacement, relevance filtering, and merge with existing
  categories.

## Notable Gaps and Risks

- Admin-on-behalf-of-staff report import is implemented. Bulk multi-staff import
  and Word/PDF parsing remain future work.
- Duplicate admin routes increase maintenance cost and should either be kept as
  compatibility aliases or consolidated.
- Manual single-category deletion should be reviewed later for comment cleanup
  behavior.

## Current Test Coverage

- Report generation prompt building, placeholder replacement, relevance warning,
  strength focus, incomplete AI output rejection, and validation limits.
- Report import placeholder replacement, maximum import length, and relevance
  filtering.
- CSV import caps and skipped-row reporting.
- Subject context validation.
- UI selection helper grouping.
- Rate limiting for OpenAI-backed generation.
- Admin target-staff import, non-admin rejection, replace confirmation, and
  target ownership.
- Category/comment/prompt ownership checks.
- Password-change field consistency.
- Shared UI helper coverage for status panels, context chips, button loading,
  invalid-field styling, and comment-bank filtering.
- Playwright browser smoke tests for the Generate Report ready checklist and
  empty state, valid-report form clearing, incomplete-report form retention,
  Manage Comments expand/collapse and delete confirmation, import validation,
  shared menu permissions, and the admin staff-bank step layout.
- Restore drill documentation for testing backups against a separate database.

## Baseline Manual Test Checklist

- Login, logout, and admin login.
- Admin creates/deletes global subjects, year groups, and users.
- User selects visible subjects/year groups in settings.
- Subject description and word limit save and reload for a subject/year group.
- Report import creates paragraph-aligned categories and comments.
- CSV export/import works for one subject/year group.
- Report generation returns exactly four paragraphs.
- Pupil names are replaced with `PUPIL_NAME` before OpenAI calls and restored in
  the final report.
- Relevance warning appears for out-of-scope selected comments.
