# Future Improvements Backlog

This document is a living backlog for useful improvements that are outside the
current task. When a future review uncovers something worth improving but not
needed for the immediate feature, add a dated note here.

For the prioritised roadmap, see `docs/future_improvements_plan.md`.

## How To Use This Document

- Add concise notes under the relevant section.
- Include file paths or endpoint names where possible.
- Keep the current feature scope separate from this backlog.
- Promote an item into a feature plan only when it becomes part of an approved
  piece of work.

## Security and Authorization

- `2026-04-17`: Consider consolidating duplicate admin routes under one
  namespace. The code currently has both `/api/admin/*` and non-admin-looking
  admin-protected routes such as `/api/users`, `/api/subjects`, and
  `/api/year-groups`.

## Reliability and Data Safety

- `2026-04-17`: Extend the shared request timeout helper across the remaining
  lower-risk browser fetches when page scripts are moved into dedicated modules.
- `2026-04-17`: Consider adding an optional `ImportJobs` table later for import
  metadata only: actor, owner, subject, year group, mode, status, counts, and
  error message. Do not store raw report text unless there is a separate policy
  decision.
- `2026-04-17`: Review delete behavior for subjects/year groups. Deleting global
  subjects or year groups may cascade or fail depending on database constraints;
  the admin UI should show a clear warning about affected comment banks.
- `2026-04-17`: Review manual category deletion behavior. The import replacement
  paths now delete comments before categories, but the single-category delete
  route still relies on database/ORM behavior when comments exist.

## UX and Admin Workflows

- `2026-04-17`: Split large inline scripts out of HTML pages into dedicated JS
  modules. `adminpage.html`, `index.html`, and management pages would be easier
  to test and maintain.
- `2026-04-17`: Consider replacing browser `confirm()` prompts with an in-page
  confirmation component for destructive actions. Current delete/import prompts
  are clearer, but native dialogs cannot show richer context or styling.
- `2026-04-17`: Consider making the Generate Report ready checklist reusable
  once page scripts are moved into dedicated modules.

## Testing

- `2026-04-17`: Add a small integration-style test around staff settings:
  selecting subjects/year groups, then confirming dropdown options use those
  settings.
- `2026-04-17`: Expand Playwright coverage later to include login, settings
  persistence, successful report imports against a test backend, and admin user
  management. The first browser smoke tests now cover the recent UI regressions.

## Code Organization

- `2026-04-17`: `src/routes/index.js` is large. Extracting services for report
  import, report generation prompt assembly, category/comment persistence, and
  admin user management would reduce route-handler complexity.
- `2026-04-17`: Move shared limits and text-cleaning helpers out of
  `src/routes/index.js` once multiple services need them.
- `2026-04-17`: Route-local errors now use a shared JSON helper. Consider
  moving this into formal Express error middleware when route handlers are split
  into smaller modules.

## OpenAI and Prompting

- `2026-04-17`: Keep OpenAI model configuration documented and review model
  defaults before major deployments.
- `2026-04-17`: Consider storing prompt/template versions for generated comment
  banks if staff need to know which prompt produced a set of comments.
- `2026-04-17`: Add admin preview/edit for extracted comments before saving, but
  leave it out of the first safe admin-upload implementation.

## Deployment and Operations

- `2026-04-17`: Run the restore drill in `docs/restore_drill.md` against a
  recent backup and record any live-server-specific adjustments.
