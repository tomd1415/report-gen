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
 * What those are, recounted 2026-08-13 across each page AND the modules it
 * loads. The 2026-08-12 count of 32 was across `public/*.html` alone; moving
 * index.html's script into `report-page.js` moved call sites out of the HTML,
 * which turned this gate blind rather than turning it red about the right thing.
 * The scope now follows the `<script src=…>` tags, so the CSP work cannot
 * quietly shrink what is checked. Original breakdown:
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

/** Same-directory `<script src="x.js">` tags — the modules this page loads. */
const SCRIPT_SRC = /<script[^>]*\bsrc=["']([A-Za-z0-9_.-]+\.js)["']/g;

/**
 * Everything whose selectors must resolve against THIS page's ids: the page
 * itself, plus each module it pulls in. Following the script tags is what keeps
 * the gate honest as logic migrates out of the HTML — a shared helper is checked
 * against every page that loads it, which is the correct requirement.
 */
const sourcesFor = (name) => {
  const html = readPage(name);
  const sources = [{ from: name, text: html }];
  for (const [, src] of matchAll(html, SCRIPT_SRC)) {
    const modulePath = path.join(publicDir, src);
    if (fs.existsSync(modulePath)) {
      sources.push({ from: `${name} → ${src}`, text: fs.readFileSync(modulePath, 'utf8') });
    }
  }
  return sources;
};

describe('every feedback target the pages ask for actually exists', () => {
  const pages = htmlPages();

  it('finds the pages and the call sites at all', () => {
    // Floors. Either regex silently ceasing to match would turn this whole file
    // into a green no-op, which is precisely the failure mode it exists to catch.
    expect(pages.length).toBeGreaterThanOrEqual(12);

    const totalLiteral = pages
      .flatMap(sourcesFor)
      .reduce((sum, source) => sum + matchAll(source.text, LITERAL_CALL).length, 0);
    expect(totalLiteral).toBeGreaterThan(100);
  });

  it('resolves every literal selector to an id on the same page', () => {
    const missing = [];
    let examined = 0;

    for (const name of pages) {
      const ids = new Set(matchAll(readPage(name), ELEMENT_ID).map((match) => match[1]));

      for (const source of sourcesFor(name)) {
        for (const [, helper, id] of matchAll(source.text, LITERAL_CALL)) {
          examined += 1;
          if (!ids.has(id)) {
            missing.push(`${source.from}: ReportGenUI.${helper}('#${id}') — no element with that id`);
          }
        }
      }
    }

    // The floor belongs HERE, not only in the sibling test above. `missing` is
    // empty both when every selector resolves and when the regex found no
    // selectors at all — and a floor in a different `it()` is one `.only`, one
    // filter or one file split away from silence. That is not hypothetical: on
    // 2026-08-13 exactly this shape made a route-auth staleness test assert
    // nothing for a day (LESSONS-LEARNT §7). Report what was examined.
    expect(examined).toBeGreaterThan(100);

    // If this fails, the named call is a silent no-op in the browser: the helper
    // returns false, the call site discards it, and the teacher simply never
    // sees that message. Either the element was renamed and the call was not, or
    // the element is created dynamically — in which case this check cannot see
    // it and the call needs a comment saying so.
    expect(missing).toEqual([]);
  });

  it('has no more dynamic call sites than are already known', () => {
    const [literal, all] = pages.flatMap(sourcesFor).reduce(([lit, total], source) => [
      lit + matchAll(source.text, LITERAL_CALL).length,
      total + matchAll(source.text, ANY_CALL).length
    ], [0, 0]);

    expect(all).toBeGreaterThan(literal);
    expect(all - literal).toBe(KNOWN_UNCHECKABLE_CALL_SITES);
  });
});
