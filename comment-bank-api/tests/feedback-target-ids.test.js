import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

// Why this exists
// ---------------
// Every status message, loading state and validation highlight in this app goes
// through `window.ReportGenUI` (public/app-ui.js). docs/PROJECT_STATE.md §6.11
// records the two ways that layer fails silently:
//
//   1. the module does not load, so all ~138 `ReportGenUI?.…` calls become
//      no-ops — caught, by the unit suite and by an e2e test;
//   2. **an element id is renamed, so one message silently never appears while
//      everything around it keeps working — caught by nothing.**
//
// This file is (2). The helpers take a selector, return `false` when they cannot
// find it, and every single call site discards that return value. So the only
// way to notice is to compare the selectors the pages pass against the ids the
// pages actually contain — two lists that must agree, in the same file as each
// other, with nothing comparing them until now.
//
// It is a static check by necessity: the failure is a *missing* element, which
// by definition produces no runtime signal to observe.

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, '..', 'public');

/**
 * Call sites whose first argument is an expression rather than a literal
 * selector — `setButtonLoading(button)`, `setFieldInvalid(`#${id}`)`. They
 * cannot be checked statically, so this is a record of the blind spot, not an
 * approved exception, and the number should go DOWN.
 *
 * Asserted exactly, on the same reasoning as `KNOWN_UNGUARDED`
 * (docs/TESTING.md rules 1 and 2): a new dynamic call site is a real increase in
 * unverifiable surface, and updating a number is a cheap way to be told about it.
 */
const KNOWN_UNCHECKABLE_CALL_SITES = 32;

/**
 * What those 32 are, counted 2026-08-12 across `public/*.html`:
 *   setButtonLoading      26  — passed an element reference, not a selector
 *   setFieldInvalid        5  — `#${id}` built from a loop variable
 *   getSelectedOptionText  1  — same
 *
 * `setButtonLoading` is most of it, and it is the safest of the three: it is
 * handed an element the page has already looked up, so a rename breaks the
 * lookup loudly rather than silently. The `#${id}` ones are the residue worth
 * removing if this is ever revisited.
 */

/** `ReportGenUI?.showStatus('#some-id'` → captures the helper and the id. */
const LITERAL_CALL = /ReportGenUI\?\.([A-Za-z]+)\(\s*['"]#([A-Za-z0-9_-]+)['"]/g;
/** Any call at all, literal or not, so the two can be counted against each other. */
const ANY_CALL = /ReportGenUI\?\.[A-Za-z]+\(\s*[^,)]/g;
const ELEMENT_ID = /\sid=["']([A-Za-z0-9_-]+)["']/g;

const htmlPages = () => fs.readdirSync(publicDir)
  .filter((name) => name.endsWith('.html'))
  .sort();

const readPage = (name) => fs.readFileSync(path.join(publicDir, name), 'utf8');

const matchAll = (source, pattern) => [...source.matchAll(pattern)];

describe('every feedback target the pages ask for actually exists', () => {
  const pages = htmlPages();

  it('finds the pages and the call sites at all', () => {
    // Floors. Either regex silently ceasing to match would turn this whole file
    // into a green no-op, which is precisely the failure mode it exists to catch.
    expect(pages.length).toBeGreaterThanOrEqual(12);

    const totalLiteral = pages
      .reduce((sum, name) => sum + matchAll(readPage(name), LITERAL_CALL).length, 0);
    expect(totalLiteral).toBeGreaterThan(100);
  });

  it('resolves every literal selector to an id on the same page', () => {
    const missing = [];

    for (const name of pages) {
      const source = readPage(name);
      const ids = new Set(matchAll(source, ELEMENT_ID).map((match) => match[1]));

      for (const [, helper, id] of matchAll(source, LITERAL_CALL)) {
        if (!ids.has(id)) {
          missing.push(`${name}: ReportGenUI.${helper}('#${id}') — no element with that id`);
        }
      }
    }

    // If this fails, the named call is a silent no-op in the browser: the helper
    // returns false, the call site discards it, and the teacher simply never
    // sees that message. Either the element was renamed and the call was not, or
    // the element is created dynamically — in which case this check cannot see
    // it and the call needs a comment saying so.
    expect(missing).toEqual([]);
  });

  it('has no more dynamic call sites than are already known', () => {
    const [literal, all] = pages.reduce(([lit, total], name) => {
      const source = readPage(name);
      return [lit + matchAll(source, LITERAL_CALL).length, total + matchAll(source, ANY_CALL).length];
    }, [0, 0]);

    expect(all).toBeGreaterThan(literal);
    expect(all - literal).toBe(KNOWN_UNCHECKABLE_CALL_SITES);
  });
});
