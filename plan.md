# Update Plan (Update1)

## Goals
- Modernize the codebase and dependencies while keeping the core workflow (comment bank -> report generation).
- Migrate OpenAI usage to the latest SDK and Responses API using the GPT-5.2 model.
- Update prompts and report structure to enforce the new 4-paragraph rules.
- Improve maintainability, security, and data privacy; tidy up old/unused files.

## New Report Rules (Input)
- Paragraph 1: Topics/areas studied so far; key knowledge/skills acquired (do not repeat subject description).
- Paragraph 2: Effort/motivation/attendance to lesson.
- Paragraph 3: Strengths and particular achievements.
- Paragraph 4: Areas of development to bolster progress and achieve end-of-year Teacher Target.

## Confirmed Decisions and Constraints
- Stack: anything is on the table; pick the best fit after audit while keeping a Debian-compatible deployment and Gentoo-friendly dev setup.
- Report length: 4 paragraphs are mandatory; add a user-configurable word limit.
- Categories: map to 4 paragraph-aligned groups where possible, plus a general/other bucket for comments that do not fit.
- Privacy: use OpenAI `store: false` and a hashed `safety_identifier` per user.
- UI/UX: refresh is a nice-to-have, lower priority than backend/prompt modernization.

## Phase 1: Audit and Cleanup
- Inventory current runtime entrypoint, routes, and static pages; confirm which features are actively used.
- Remove or archive unused files (old `server.mjs*`, unused routes/models) once confirmed.
- Consolidate dependency management (avoid split deps between repo root and `comment-bank-api`).
- Capture baseline behavior with a small manual test checklist and sample data.
- Decide on the target stack after the audit (keep current or migrate) with Debian/Gentoo compatibility in mind.

## Phase 2: Dependency + Tooling Upgrades
- Upgrade Node runtime to the latest LTS supported on Debian (and available on Gentoo for local testing).
- Update NPM packages to current supported versions (Express, Sequelize, OpenAI SDK, multer, csv-parser, etc.).
- Remove deprecated or redundant deps (`body-parser`, `fs`, `https` from package.json) in favor of built-ins.
- Add linting/formatting tooling only if desired (keep minimal otherwise).

## Phase 3: Backend Refactor and Config
- Split monolithic `server.mjs` into modules (routes, services, db, auth, openai) for clarity.
- Introduce migrations instead of `sequelize.sync` (e.g., Sequelize CLI or a migration tool).
- Move config to `process.env` with a documented `.env.example` (port, DB, OpenAI, session).
- Harden session management (persistent store, secure cookie config, sameSite).
- Replace `exec`-based DB backup endpoints or lock them down more tightly.
- Add per-user subject/year-group metadata:
  - `subject_description` stored per user + subject + year group.
  - API endpoints to read/update it alongside existing prompt settings.

## Phase 4: OpenAI Integration Modernization
- Upgrade to `openai@latest` (currently 6.x) and migrate to the Responses API (`client.responses.create`).
- Use `model: "gpt-5.2"` and explicitly set `reasoning.effort` (default `none`) per the GPT-5.2 guide.
- Adopt Structured Outputs (JSON schema) for comment extraction/merge to avoid fragile text parsing.
- Add `safety_identifier` (hashed user id) and optional `store: false` for privacy.
- Log `x-request-id` from responses for troubleshooting.

## Phase 5: Prompt + Comment Bank Updates
- Update default prompt templates (server + UI) to enforce exactly 4 paragraphs and the new paragraph rules.
- Add a user-configurable word limit and pass it explicitly in the prompt.
- Add a per-user subject/year-group “subject description” that:
  - Displays to the user when selecting comments.
  - Is sent to the model as context but is explicitly excluded from the report output.
- Ensure placeholder names are preserved in requests (no pupil names sent to OpenAI).
- Rework import/merge prompts to align with the new report rules and output JSON with:
  - `categories`: list of category objects
  - `comments`: ordered arrays by ability/behavior
  - `targets`: explicit target suggestions aligned to paragraph 4
- Map categories to the 4 paragraph groups when possible, plus a general/other bucket for unmatched comments.

## Phase 6: Front-End Updates
- Update UI guidance text and default prompts to reflect the 4-paragraph structure.
- If paragraph-aligned categories are adopted, adjust the UI to group/select comments per paragraph.
- Surface the per-user subject description in the comment selection UI and settings.
- Improve error handling and loading states for report generation and imports.
- Treat UI/UX refresh as a final, optional step once the backend and prompts are stable.

## Phase 7: Security + Privacy
- Validate and sanitize all user input (CSV import, prompts, comments).
- Add rate limiting on OpenAI-backed endpoints.
- Ensure no pupil names are sent to OpenAI; double-check placeholder logic in imports.
- Review auth/authorization for admin endpoints and backup/export routes.

## Phase 8: Testing + QA
- Add unit tests for prompt assembly and placeholder replacement.
- Add tests to ensure the subject description is injected into prompts but never appears in the generated report.
- Add a small golden test set to verify 4-paragraph output and rule adherence.
- Manual smoke tests for login, imports, comment selection, and report generation.

## Phase 9: Docs + Deployment
- Update README with setup, env vars, and migration steps.
- Document new prompt rules and admin workflows.
- Provide a migration checklist (DB migrations, package updates, OpenAI model config).

## Deliverables
- Updated backend and frontend code with modern dependencies.
- GPT-5.2 compatible prompts and Responses API integration.
- User-configurable word limit alongside the 4-paragraph requirement.
- Per-user subject description per subject/year-group, shown in UI and used as report context only.
- Cleaner repo structure with legacy artifacts removed.
- Updated docs and a tested workflow aligned to the new report rules.
