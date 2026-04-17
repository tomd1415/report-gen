# Admin Staff Report Upload Feature Plan

## Purpose

Allow an admin user to upload or paste previous reports for a selected staff
member, subject, and year group so the app can generate or update that staff
member's comment bank. The staff member should then log in normally and use
those generated comments in the existing report-generation workflow.

This feature must be deployment-safe: pulling the repo and restarting the live
server must not delete or rewrite existing live data.

## Data-Safety Contract

These rules are mandatory for this feature.

1. Pulling code and restarting the server must not change existing report
   comments, users, subjects, year groups, prompts, or subject contexts.
2. Any migration must be additive only unless a separate, explicit migration plan
   is documented and approved.
3. No migration may truncate, delete, rewrite, or backfill live data without a
   separate backup-and-restore procedure.
4. Admin imports must run only after an admin submits an import form.
5. Merge mode must be the default import mode.
6. Replace mode must require explicit confirmation in the UI and must only delete
   categories/comments for:
   - the selected target staff user
   - the selected subject
   - the selected year group
7. Import writes must run inside a database transaction. If the import fails, the
   database should roll back to the previous state for that operation.
8. The app must not store raw pasted reports unless a separate audit/archive
   requirement is added later.
9. Pupil names must continue to be replaced with `PUPIL_NAME` before OpenAI
   receives any report text.

## Current Baseline

The schema already supports separate staff comment banks:

- `Categories.userId` owns categories for one staff user.
- `Comments` belong to categories, so they inherit ownership through the
  category.
- `Prompts.userId` stores staff-specific prompt text per subject/year group.
- `SubjectContexts.userId` stores staff-specific subject description and default
  word limit per subject/year group.
- `UserSubjects` and `UserYearGroups` control which subject/year options a user
  sees in the UI.

The current limitation is route and UI ownership. These workflows use
`req.session.user.id`, so they operate only on the logged-in user's own data:

- `/api/import-reports`
- `/api/import-categories-comments`
- `/api/export-categories-comments`
- `/api/categories-comments`
- `/api/subject-context`
- `/api/prompts`
- `/generate-report`

Admins can manage users, subjects, and year groups. The current implementation
adds a target-staff import workflow so admin report imports can write to the
selected staff user's bank.

## Implementation Status

Implemented in the first pass:

- Admin "Staff Comment Banks" section in `adminpage.html`.
- Staff Comment Banks UI is presented as a three-step workflow: choose staff
  and class, set staff context, import previous reports.
- Target staff report imports via `POST /api/admin/staff/:userId/import-reports`.
- Target staff context and prompt management.
- Target staff CSV import/export endpoints.
- Merge-by-default report import behavior.
- Explicit confirmation for replace mode.
- Target user visibility updates through `UserSubject` and `UserYearGroup`.
- Transaction-based category/comment replacement for report and CSV imports.
- Ownership hardening for category/comment/prompt ID-based routes.
- Tests for admin target-user imports, replace confirmation, non-admin blocking,
  ownership checks, password-change field consistency, and existing import
  behavior.

No database migration was required for this implementation.

## Desired Admin Workflow

1. Admin opens a new "Staff Comment Banks" section in `adminpage.html`.
2. Admin selects the staff member who should own the imported comment bank.
3. Admin selects the subject and year group.
4. Admin optionally edits that staff member's subject description, default word
   limit, and prompt for the selected subject/year group.
5. Admin provides pupil names to redact.
6. Admin pastes previous reports or uploads a plain text file.
7. Admin chooses an import mode:
   - `merge`: default, combines generated comments with existing comments.
   - `replace`: requires confirmation and replaces only the selected staff
     member's selected subject/year group comment bank.
8. The app extracts categories/comments using the existing OpenAI structured
   output flow.
9. The app writes the result to the selected staff member's `userId`.
10. The app ensures that selected subject/year group is visible to the staff
    member by creating missing `UserSubject` and `UserYearGroup` rows.
11. Admin sees a summary of what changed.

## Implementation Phases

### Phase 0: Pre-Work and Baseline Checks

Goal: make sure there is a clean baseline before feature changes.

Tasks:

- Confirm current live backup procedure works.
- Run the current test suite locally.
- Review any uncommitted live changes before deployment.
- Record the current migration list:
  - `20250106-001-init-schema.mjs`
  - `20250106-002-add-session-timestamps.mjs`
  - `20250107-001-add-subject-context.mjs`

Expected code changes:

- None, unless a test fixture or documentation needs updating.

Data impact:

- None.

### Phase 1: Small Maintenance Fixes

Goal: fix known low-risk bugs before adding admin-on-behalf-of-staff behavior.

Tasks:

- Fix the password-change mismatch:
  - Backend currently expects `oldPassword`.
  - `settings.html` currently sends `currentPassword`.
  - Choose one name and make frontend/backend/tests agree.
- Add or update a test for password change.

Expected code changes:

- `comment-bank-api/public/settings.html`
- `comment-bank-api/src/routes/index.js` only if the backend field name is
  changed or backward compatibility is added.
- A route test if needed.

Data impact:

- None.

### Phase 2: Ownership Hardening

Goal: prevent accidental or malicious cross-user edits before adding admin
target-user routes.

Tasks:

- Add helper functions for ownership checks, for example:
  - load category by id and current `userId`
  - load comment by id through its category and current `userId`
  - load prompt by id and current `userId`
- Apply ownership checks to:
  - `GET /api/categories/:id`
  - `PUT /api/categories/:id`
  - `DELETE /api/categories/:id`
  - `GET /api/comments`
  - `GET /api/comments/:id`
  - `POST /api/comments`
  - `PUT /api/comments/:id`
  - `DELETE /api/comments/:id`
  - `POST /api/move-comment`
  - `PUT /api/prompts/:id`
  - `DELETE /api/prompts/:id`
- Keep admin-only global subject/year/user routes unchanged.

Expected code changes:

- `comment-bank-api/src/routes/index.js`
- Route tests covering cross-user rejection.

Data impact:

- None. This only changes which requests are accepted.

### Phase 3: Extract Import Service

Goal: reuse the current report-import behavior for both normal staff imports and
admin target-user imports without duplicating logic.

Tasks:

- Create `comment-bank-api/src/services/reportImport.js`.
- Move report import helper logic into the service:
  - text cleaning and length validation where practical
  - pupil-name replacement
  - extraction prompt building
  - relevance prompt call
  - merge prompt call
  - category/comment replacement or merge persistence
- Keep route-specific request/response handling in `src/routes/index.js`.
- Service should accept a single options object:
  - `models`
  - `openai`
  - `sequelize`
  - `ownerUserId`
  - `actorUserId`
  - `subjectId`
  - `yearGroupId`
  - `pupilNames`
  - `reports`
  - `mode`
  - `subjectDescription`
  - `buildOpenAIParams` or equivalent OpenAI metadata callback
- Existing `/api/import-reports` should call this service with:
  - `ownerUserId = req.session.user.id`
  - `actorUserId = req.session.user.id`
  - `mode = merge`
- Return summary data from the service:
  - `mode`
  - `totalCategories`
  - `totalComments`
  - `filteredCount`
  - `replacedExisting`
  - `ownerUserId`
  - `subjectId`
  - `yearGroupId`

Expected code changes:

- New `comment-bank-api/src/services/reportImport.js`
- `comment-bank-api/src/routes/index.js`
- Existing import tests updated to validate equivalent behavior.

Data impact:

- No deployment-time data impact.
- Runtime behavior should match the existing user import flow.

### Phase 4: Admin Target-User APIs

Goal: add explicit admin-only routes that write to a selected staff member's
comment bank.

Tasks:

- Add helper to validate target staff user:
  - parse `:userId`
  - confirm `User.findByPk(userId)` exists
  - reject missing user with `404`
- Add admin-only routes:
  - `GET /api/admin/staff/:userId/comment-bank?subjectId=&yearGroupId=`
  - `POST /api/admin/staff/:userId/import-reports`
  - `GET /api/admin/staff/:userId/export-categories-comments?subjectId=&yearGroupId=`
  - `POST /api/admin/staff/:userId/import-categories-comments`
  - `GET /api/admin/staff/:userId/subject-context?subjectId=&yearGroupId=`
  - `POST /api/admin/staff/:userId/subject-context`
  - optionally `GET /api/admin/staff/:userId/prompts/:subjectId/:yearGroupId`
  - optionally `POST /api/admin/staff/:userId/prompts`
- Use the target staff `userId` for `Category`, `Prompt`, `SubjectContext`,
  `UserSubject`, and `UserYearGroup` writes.
- Ensure target staff visibility by calling `UserSubject.findOrCreate` and
  `UserYearGroup.findOrCreate` after successful import/context save.
- Make `mode = merge` the default for admin report imports.
- Require `confirmReplace: true` for replace mode.

Expected code changes:

- `comment-bank-api/src/routes/index.js`
- Possibly `comment-bank-api/src/services/reportImport.js`
- Tests for admin target-user behavior.

Data impact:

- No deployment-time data impact.
- Runtime data changes happen only when admin endpoints are called.

### Phase 5: Admin UI

Goal: expose the target-staff import workflow in the admin panel.

Tasks:

- Add a "Staff Comment Banks" section to `comment-bank-api/public/adminpage.html`.
- UI controls:
  - staff selector populated by `GET /api/users`
  - subject selector populated by `GET /api/subjects`
  - year-group selector populated by `GET /api/year-groups`
  - subject description textarea
  - default word limit input
  - prompt textarea
  - pupil names input
  - reports textarea
  - optional plain text file upload
  - import mode selector with `merge` selected by default
  - replace confirmation checkbox shown only for replace mode
  - import button with disabled/loading state
  - result summary area
- Load target staff context/prompt when staff, subject, and year group are all
  selected.
- On success, show:
  - target staff username
  - subject/year group
  - mode
  - category/comment counts
  - whether visibility settings were created

Expected code changes:

- `comment-bank-api/public/adminpage.html`
- Possibly shared frontend helpers if the admin page becomes too large.

Data impact:

- None until an admin submits the form.

### Phase 6: Optional Import Audit Metadata

Goal: decide whether to store import metadata. This is optional for the first
version.

Default recommendation:

- Do not add an `ImportJobs` table for the first implementation unless the school
  needs persistent audit history.
- Return import summary to the admin UI and rely on normal database backups.

If audit history is required later, add an additive migration for an
`ImportJobs` table:

- `id`
- `actorUserId`
- `ownerUserId`
- `subjectId`
- `yearGroupId`
- `mode`
- `status`
- `totalCategories`
- `totalComments`
- `filteredCount`
- `errorMessage`
- `createdAt`
- `updatedAt`

Do not store raw report text in this table.

## Transaction Policy

All import persistence must run in `sequelize.transaction`.

For merge mode:

- Read existing categories/comments.
- Generate merged category map.
- Replace only the selected owner/subject/year categories inside the
  transaction after the OpenAI merge result is ready.
- Create categories/comments inside the same transaction.

For replace mode:

- Require explicit confirmation before route handler calls the service.
- Destroy only `Category` rows matching `ownerUserId`, `subjectId`, and
  `yearGroupId`.
- Create new categories/comments inside the same transaction.

OpenAI calls should happen before destructive database writes wherever possible.
This avoids deleting existing data and then failing because the model call or
parsing failed.

## Migration Policy

The first implementation should not require a database migration.

If a migration becomes necessary:

- It must be additive.
- It must be idempotent where practical.
- It must be listed in this document before deployment.
- It must be tested against a database copy before running on live.
- It must not delete existing rows.

## Tests Required Before Deployment

Automated tests:

- Existing `/api/import-reports` still writes to the current user.
- Admin import writes categories with `userId = targetUserId`.
- Non-admin users get `403` for admin target-user endpoints.
- Unknown target user gets `404`.
- Merge mode preserves/combines existing comments for the target user.
- Replace mode deletes only target user + selected subject + selected year group.
- Replace mode is rejected unless `confirmReplace: true`.
- Admin import creates missing `UserSubject` and `UserYearGroup` rows.
- CSV admin import/export uses the target user's bank.
- Pupil names are replaced with `PUPIL_NAME` before OpenAI receives prompts.
- Cross-user category/comment/prompt edits are rejected by ownership checks.
- Existing report generation tests still pass.

Manual checks:

- Admin imports reports for a staff member who previously had no comments.
- Admin imports reports for a staff member who already had comments using merge.
- Admin uses replace mode and confirms only the selected subject/year group is
  replaced.
- Target staff user logs in and sees the subject/year group.
- Target staff user generates a four-paragraph report from imported comments.
- Existing unrelated staff comment banks are unchanged.

## Live Deployment Checklist

Before pulling on live:

1. Take a fresh database backup.
2. Confirm the backup file exists and is not empty.
3. Note the current git commit on live.
4. Confirm whether the release includes migrations.
5. If migrations exist, confirm they are additive and listed in this document.

Deployment:

1. Pull the repo.
2. Run `npm install` in `comment-bank-api` if dependencies changed.
3. Restart the service.
4. Watch logs for startup and migration errors.
5. Log in as admin.
6. Confirm existing subjects/year groups/users still load.
7. Confirm one existing staff user can still see their existing comments.
8. Run one small admin import into a test or low-risk staff account.

After deployment:

1. Confirm no unrelated staff comment bank changed.
2. Confirm the target staff user can generate a report.
3. Keep the pre-deployment backup until the feature has been used successfully
   for real data.

## Rollback Plan

If the app fails to start:

1. Revert to the previous git commit.
2. Run `npm install` if dependency versions changed during rollback.
3. Restart the service.

If the app starts but the feature misbehaves before any import is submitted:

1. Revert to the previous git commit.
2. Restart the service.
3. No database restore should be required.

If a bad import is submitted:

1. Identify target staff user, subject, year group, and timestamp.
2. Prefer restoring only affected rows from backup if possible.
3. If targeted restore is not practical, decide whether a full database restore
   is acceptable based on how much new data was added after the backup.

The implementation should make bad imports unlikely by defaulting to merge mode
and requiring explicit confirmation for replace mode.

## Future Enhancements Not In First Scope

These are intentionally not part of the first safe implementation:

- Bulk import for multiple staff from one file.
- Word/PDF report extraction.
- Persistent import history table.
- Per-comment provenance showing which import created it.
- Admin preview and edit of extracted comments before saving.
- Background import jobs for very large uploads.

Future ideas should be added to `docs/future_improvements.md`.
