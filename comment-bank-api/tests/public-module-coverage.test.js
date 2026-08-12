import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

// Why this exists
// ---------------
// `npm run check:inline-scripts` only parses inline <script> blocks inside the
// HTML. It does NOT look at public/*.js. Verified 2026-08-09 by putting a syntax
// error in public/app-ui.js: the gate printed "Checked 10 inline scripts" and
// exited 0. It cannot easily be extended to cover them either — it parses with
// `new Function`, and these files carry real `export` statements alongside their
// `window.X = {…}` block, which `new Function` refuses.
//
// What actually caught that planted error was the unit suite, and only because
// app-ui.js happens to have a test importing it. That is a dependency nobody
// wrote down: the browser modules are syntax-checked as a side effect of being
// imported by some test. Add a sixth helper with no test and it silently stops
// being checked — and the stated direction (docs/PROJECT_STATE.md §6.4) is to
// move MORE code out of the inline scripts into exactly these files, so the
// unchecked fraction grows over time.
//
// This file imports every one of them itself, so the guarantee no longer depends
// on some other test's import list. A new module is covered the moment it is
// added, with nothing to remember.
//
// Scope, stated plainly: this proves each module PARSES and that its top level
// runs without throwing. It says nothing about whether its behaviour is tested —
// app-ui.js in particular has 143 call sites nothing verifies (§6.11). A green
// run here is not coverage, it is the floor beneath coverage.

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, '..', 'public');

const listPublicModules = () => fs.readdirSync(publicDir)
  .filter((name) => name.endsWith('.js'))
  .sort();

describe('every browser module in public/ can be loaded', () => {
  const modules = listPublicModules();

  // Floor: if the directory listing ever returns nothing — a moved public/, a
  // changed extension — the per-module tests below simply would not exist and
  // the file would report success having checked nothing.
  it('finds the browser modules at all', () => {
    expect(modules.length).toBeGreaterThan(0);
  });

  // One test per module so a failure names the file rather than the loop.
  //
  // These are ESM modules that also attach themselves to `window` behind a
  // `typeof window !== 'undefined'` guard, so importing them under the node
  // environment parses the file and skips the browser wiring. If a future module
  // touches the DOM at its top level this will fail loudly here — that is the
  // right outcome, not a reason to weaken the check: put the DOM work behind the
  // same guard the others use.
  for (const name of modules) {
    it(`loads public/${name}`, async () => {
      const module = await import(`../public/${name}`);
      // A module with no exports is legal but is almost always a mistake in this
      // codebase — every one of these exists to expose helpers to a page and to
      // the tests.
      expect(Object.keys(module).length).toBeGreaterThan(0);
    });
  }
});
