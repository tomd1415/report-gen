# Future Improvements Plan

## Purpose

This plan turns the rolling notes in `docs/future_improvements.md` into a
prioritised roadmap. The backlog remains the place for quick observations; this
document is the place to decide which improvements should be grouped together
and what order they should be tackled in.

The main goal is to improve the site without putting existing live data at
risk.

## Safety Rules

Use these rules for every future improvement:

1. Back up the live database before deploying behaviour that writes, deletes, or
   migrates data.
2. Prefer additive migrations. Do not delete, rewrite, or backfill live data
   without a separate migration and rollback plan.
3. Keep default behaviour conservative. If a feature can merge or replace data,
   merge should be the default and replace should require explicit confirmation.
4. Add tests before or alongside changes to admin, import, authentication,
   permissions, and report generation workflows.
5. Run the release checklist in `docs/release_checklist.md` before live pulls.
6. Do not store raw pasted reports unless there is a clear policy decision.

## Recently Completed UX Improvements

Completed on `2026-04-17`:

- Shared menu now includes Settings and Logout on every page, with Admin shown
  only to admin users.
- Generate Report now has page-level status messages, context chips, active
  paragraph tabs, selection summaries, loading states, a ready checklist, and a
  clear empty state when no comment bank exists for the selected subject/year.
- Import pages and CSV import/export now use visible status messages, button
  loading states, and field-specific validation/focus for missing required
  inputs.
- Manage Comments now has search, category/comment counts, expand/collapse all
  controls, empty-state messaging, and more specific delete confirmations.
- Admin Staff Comment Banks now presents the staff import workflow as three
  visual steps.
- Shared frontend UI helpers now include status, context, loading, filtering,
  and invalid-field helpers with jsdom coverage.
- Playwright smoke tests now cover the main UI regressions from this batch.

## Priority 1: Data Safety And Operations

These should come before larger feature work because they reduce deployment and
recovery risk.

### Restore Drill Documentation

Create a documented restore drill, not just backup commands.

Tasks:

- Add step-by-step restore instructions for a test database.
- Record how to verify that restored users, subjects, year groups, prompts, and
  comments are usable.
- Add a small checklist for confirming a backup is valid before risky changes.

Acceptance criteria:

- A backup can be restored into a non-production database using documented
  commands.
- A staff login and a report generation smoke test work against the restored
  data.

### Safer Delete Behaviour

Review destructive admin actions and make their impact clear before they run.

Tasks:

- Review subject and year-group deletion paths.
- Review category deletion when comments exist.
- Add warnings showing what may be affected.
- Where practical, block destructive deletes if dependent records exist, unless
  the admin confirms the exact scope.

Acceptance criteria:

- Admins cannot accidentally delete broad shared records without a clear warning.
- Tests cover at least one protected or confirmed destructive path.

### Import History Metadata

Add optional import metadata so admin imports are auditable without storing raw
reports.

Tasks:

- Design an `ImportJobs` or equivalent table containing actor, target owner,
  subject, year group, mode, status, counts, and error message.
- Keep raw report text out of the table.
- Show recent import history in the admin panel.

Acceptance criteria:

- Admin can see who ran an import, for whom, and what count changed.
- Failed imports are visible with a useful error summary.

## Priority 2: Admin Workflow Improvements

These improve the new admin-on-behalf-of-staff workflow after the core path has
had time on live data.

### Import Preview And Edit

Let admins review generated comments before saving them.

Tasks:

- Add a preview step after OpenAI extraction and relevance filtering.
- Let admins edit, remove, or rename generated categories/comments before
  committing.
- Keep the current direct import path available until the preview workflow is
  stable.

Acceptance criteria:

- Admin can reject poor comments before they reach a staff comment bank.
- Replace mode still requires explicit confirmation before saving.

### Continue Workflow Feedback Polish

The main browser workflows now use page-level status messages and field-specific
validation. Continue this work where the page logic is still inline or where
errors can be made more actionable.

Tasks:

- Replace any remaining browser alerts with page-level status or a deliberate
  confirmation component.
- Keep button disabled/loading states consistent as page scripts are moved into
  modules.
- Add focused tests for reusable UI logic as it is extracted from inline page
  scripts.

Acceptance criteria:

- Users can recover from common mistakes without losing form context.
- Validation and loading behaviour stays covered by tests where practical.

### Staff Settings Integration Test

Add coverage for the staff-visible effect of admin changes.

Tasks:

- Test that admin imports create missing user subject and year-group visibility
  rows.
- Test that staff dropdown options include newly visible settings.
- Test that imported comments are available to the target staff user, not the
  admin.

Acceptance criteria:

- A regression in target-user ownership or visibility fails tests.

## Priority 3: Security And Authorization Cleanup

These reduce route confusion and make future changes easier to reason about.

### Consolidate Admin Routes

Move admin-only routes under a clearer namespace.

Current issue:

- The app has both `/api/admin/*` routes and admin-protected routes with
  non-admin-looking names such as `/api/users`, `/api/subjects`, and
  `/api/year-groups`.

Tasks:

- Pick one preferred namespace for admin-only endpoints.
- Keep backwards-compatible aliases during a transition period if needed.
- Update frontend calls and docs.
- Add tests proving non-admin users are blocked.

Acceptance criteria:

- Route naming makes admin-only behaviour obvious.
- Existing live workflows continue to work during the transition.

### Central Error Responses

Make API errors easier for frontend code to parse.

Tasks:

- Add a small helper for JSON error responses.
- Replace plain text error responses on routes used by the browser.
- Keep status codes consistent.

Acceptance criteria:

- Frontend code can reliably read `message` from failed API responses.

## Priority 4: Code Organisation

These make the codebase easier to maintain after the feature work settles.

### Split Large Route File

`comment-bank-api/src/routes/index.js` is large and handles many concerns.

Tasks:

- Extract route modules by workflow:
  - auth and users
  - subjects and year groups
  - categories and comments
  - report generation
  - imports and exports
  - admin staff comment banks
- Move shared validation helpers into a small utility module.

Acceptance criteria:

- Route modules are smaller and easier to test.
- Existing tests pass without changing public behaviour.

### Move Inline Frontend Scripts

Several HTML pages contain large inline scripts.

Tasks:

- Move page scripts into dedicated JS modules.
- Keep shared helpers in reusable files.
- Add focused jsdom tests where helpers contain business logic.

Acceptance criteria:

- HTML files mostly define markup.
- Page logic can be tested without a browser.

## Priority 5: Prompting And Report Quality

These should be tackled after data-safety and admin workflow improvements.

### Prompt Version Tracking

Track which prompt or template produced generated comment banks.

Tasks:

- Decide whether prompt versions should be stored per import, per subject/year
  group, or both.
- Store enough metadata to explain why a comment bank looks the way it does.
- Surface the version in admin import history.

Acceptance criteria:

- Admin can tell which prompt settings were used for a generated bank.

### Model And Prompt Review

Make model changes deliberate.

Tasks:

- Document the current model, reasoning setting, and structured-output
  expectations.
- Add a review step before changing model defaults.
- Keep a small set of representative reports for manual quality checks.

Acceptance criteria:

- Model upgrades are tested against known examples before live deployment.

## Suggested Sequence

1. Restore drill documentation.
2. Safer delete behaviour.
3. Staff settings integration tests.
4. Continue workflow feedback polish.
5. Import history metadata.
6. Import preview and edit.
7. Admin route consolidation.
8. Route-file split.
9. Inline frontend script extraction.
10. Prompt version tracking and model review.

This order keeps operational safety first, then improves admin confidence, then
reduces technical debt.
