/**
 * Shared text helpers.
 *
 * These were defined **twice** — in `src/routes/index.js` and
 * `src/services/reportImport.js` — until 2026-08-13. Two copies of a
 * normalisation helper on the pupil-data path can drift without anything
 * noticing, and they had: see the note on `cleanText` below. This is the
 * deliberately small first step of the route-file split (`PROJECT_STATE.md`
 * §6.1, `docs/NEXT-MILESTONE.md` step 2).
 */

export const TARGET_PLACEHOLDER_COMMENT = '***Generate a target for this pupil and add to the report***';

const TARGET_PLACEHOLDER_PATTERN = /generate a target for this pupil/i;

/**
 * Collapse whitespace runs to single spaces and trim.
 *
 * **The `String()` is the resolved half of a real divergence.** The two copies
 * differed by exactly this call: `reportImport`'s had it, `routes`' did not, so
 * `routes` threw `TypeError: text.replace is not a function` on any non-string
 * truthy value. Measured, not reasoned about — `POST /api/categories` with
 * `{"name": 123}` answered **500**.
 *
 * Unified on the coercing version because a text-normalisation helper should not
 * throw on non-text, and because the alternative would introduce crashes into
 * the import path, which processes model output where a value may legitimately
 * not be a string.
 *
 * **This makes the routes path worse in one specific way, and that is recorded
 * rather than hidden:** `{"name": {"a":1}}` no longer 500s, it stores a category
 * called `"[object Object]"`. A loud failure became a quiet one. The correct fix
 * is a type check at the request boundary returning **400**, which is a
 * validation change rather than a de-duplication and is backlogged with this
 * reproduction (`docs/future_improvements.md`). It was not smuggled in under a
 * refactor.
 */
export const cleanText = (text) => (text ? String(text).replace(/\s+/g, ' ').trim() : '');

/**
 * Both copies of this already coerced with `String()`, so it is unchanged.
 */
export const isTargetPlaceholderComment = (value) => TARGET_PLACEHOLDER_PATTERN.test(String(value || ''));
