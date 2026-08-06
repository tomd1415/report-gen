import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(rootDir, 'public');
const scriptPattern = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;

let checked = 0;
let failed = false;
let htmlFiles = 0;

for (const fileName of fs.readdirSync(publicDir).filter((name) => name.endsWith('.html')).sort()) {
  htmlFiles += 1;
  const filePath = path.join(publicDir, fileName);
  const html = fs.readFileSync(filePath, 'utf8');
  const scripts = [...html.matchAll(scriptPattern)].map((match) => match[1]);

  scripts.forEach((script, index) => {
    checked += 1;
    try {
      new Function(script);
    } catch (error) {
      failed = true;
      console.error(`${path.relative(rootDir, filePath)} inline script ${index + 1}: ${error.message}`);
    }
  });
}

// This gate used to pass vacuously: with nothing to check it printed
// "Checked 0 inline scripts" and exited 0, so `npm run check:deploy` went green
// whether or not the check had actually run. Anything that stopped the scan
// finding work — a moved public/ directory, a change in how the pages declare
// scripts, a regex that no longer matches — would have looked identical to
// success. (Verified 2026-08-06 by pointing the script at a directory with no
// inline scripts: exit 0.)
//
// The floor is deliberately "more than zero" rather than an exact count. The
// documented plan (docs/PROJECT_STATE.md §6.4) is to move inline scripts out
// into public/*.js so CSP can be enabled, so this number is *meant* to fall over
// time. Pinning it would make legitimate progress fail the build, and a gate
// that fails for the wrong reason gets switched off.
if (htmlFiles === 0) {
  console.error(`No HTML files found in ${path.relative(rootDir, publicDir)} — the check did not run.`);
  process.exitCode = 1;
} else if (checked === 0) {
  console.error(
    `Found ${htmlFiles} HTML file${htmlFiles === 1 ? '' : 's'} but zero inline scripts. `
    + 'Either every inline script has been moved out (in which case delete this check and '
    + 'enable CSP — see docs/PROJECT_STATE.md §6.4), or the scan has stopped matching. '
    + 'Refusing to report success without checking anything.'
  );
  process.exitCode = 1;
} else if (failed) {
  process.exitCode = 1;
} else {
  console.log(
    `Checked ${checked} inline script${checked === 1 ? '' : 's'} `
    + `across ${htmlFiles} HTML file${htmlFiles === 1 ? '' : 's'} for syntax errors.`
  );
}
