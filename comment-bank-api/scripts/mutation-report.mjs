#!/usr/bin/env node
/**
 * Run a suite and report one `PASS <name>` / `FAIL <name>` line per test.
 *
 * Why this exists
 * ---------------
 * `mutate` (see /claude-guidance/LESSONS.md §5) proves that a planted break turns
 * a **named** assertion red. It reads suite output with two parsers: Python
 * unittest, and a `PASS name` / `FAIL name` line format for shell suites. It
 * understands neither Vitest nor Playwright, and a suite it cannot parse yields
 * no names at all — which it correctly refuses to mutate against, because "a
 * search that finds nothing is indistinguishable from a search that never ran".
 *
 * So this adapts one to the other. It is deliberately a separate script rather
 * than a reporter config, so that `npm test` output is unchanged for humans.
 *
 * Usage:  node scripts/mutation-report.mjs [unit|e2e]
 * Exit:   0 if every test passed, 1 otherwise.
 *
 * One sharp edge, worth knowing before you write a spec
 * ----------------------------------------------------
 * mutate's failure-line regex is `^\s*FAIL (.+?)(?::.*)?$` — it stops at a
 * colon, while its pass-line regex does not. A test called
 * `keeps KNOWN_UNGUARDED honest: every entry names a route that still exists`
 * would therefore be recorded as passing under its full name and failing under a
 * truncated one, and mutate would report the named assertion as having stayed
 * green while it was in fact red. That is the exact class of bug mutate exists to
 * find, so it must not be introduced by the adapter.
 *
 * Colons are replaced with ' -' in both directions. Names in a spec's `expect`
 * must use the sanitised form; run this script to see them.
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const mode = process.argv[2] ?? 'unit';

/** Also collapses whitespace: mutate's regexes trim, and a name that differs
 *  only by spacing between runs is a name that cannot be matched. */
const sanitise = (name) => name.replace(/:/g, ' -').replace(/\s+/g, ' ').trim();

const run = (command, args) => new Promise((resolve) => {
  const child = spawn(command, args, { cwd: projectRoot });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('close', (code) => resolve({ code, stdout, stderr }));
});

/** Vitest's JSON reporter: flat assertionResults per file. */
const readVitest = (raw) => JSON.parse(raw).testResults
  .flatMap((file) => file.assertionResults)
  .map((test) => ({ name: test.fullName, passed: test.status === 'passed' }));

/** Playwright's JSON reporter: suites nest, and each spec holds its results. */
const readPlaywright = (raw) => {
  const out = [];
  const walk = (suite, trail) => {
    const here = suite.title ? [...trail, suite.title] : trail;
    for (const spec of suite.specs ?? []) {
      out.push({
        name: [...here, spec.title].join(' '),
        passed: spec.ok === true
      });
    }
    for (const child of suite.suites ?? []) walk(child, here);
  };
  for (const suite of JSON.parse(raw).suites ?? []) walk(suite, []);
  return out;
};

const suites = {
  unit: {
    command: './node_modules/.bin/vitest',
    args: ['run', '--reporter=json', '--silent'],
    read: readVitest
  },
  e2e: {
    command: './node_modules/.bin/playwright',
    args: ['test', '--reporter=json', '--workers=2'],
    read: readPlaywright
  },
  // Not a test framework at all — a script whose exit code is the verdict. It is
  // included because it is one of the four gates and because its own history is
  // the reason mutate exists: it used to print "Checked 0 inline scripts" and
  // exit 0, so `check:deploy` went green whether or not it had run. A gate that
  // is a bare exit code is exactly the kind that never gets mutation-tested.
  inline: {
    command: 'node',
    args: ['scripts/check-inline-scripts.mjs'],
    read: null
  }
};

const suite = suites[mode];
if (!suite) {
  console.error(`unknown suite ${mode}; expected one of ${Object.keys(suites).join(', ')}`);
  process.exit(2);
}

const { code, stdout, stderr } = await run(suite.command, suite.args);

// The exit-code-only gate. One synthetic assertion name, so a spec can name it
// the same way it names a real test.
if (suite.read === null) {
  const detail = `${stdout}${stderr}`.trim().split('\n').filter(Boolean).slice(-1)[0] ?? '';
  console.log(`${code === 0 ? 'PASS' : 'FAIL'} check-inline-scripts`);
  console.log(`# exit ${code} — ${detail}`);
  process.exit(code === 0 ? 0 : 1);
}

// The JSON reporters print the blob to stdout, but a crashing suite prints a
// stack trace there too. Take the outermost JSON object rather than assuming the
// whole stream is JSON.
const start = stdout.indexOf('{');
const raw = start === -1 ? '' : stdout.slice(start, stdout.lastIndexOf('}') + 1);

let tests;
try {
  tests = suite.read(raw);
} catch (error) {
  // Emit nothing rather than a partial list. mutate treats an unparseable run as
  // an error and refuses to mutate, which is the correct outcome — reporting a
  // handful of names from a suite that crashed would look like a small failure
  // instead of no information at all.
  console.error(`could not read ${mode} results: ${error.message}`);
  console.error(stderr.slice(-2000));
  process.exit(2);
}

if (tests.length === 0) {
  console.error(`${mode} suite reported no tests — refusing to report success`);
  process.exit(2);
}

for (const test of tests) {
  console.log(`${test.passed ? 'PASS' : 'FAIL'} ${sanitise(test.name)}`);
}

const failed = tests.filter((test) => !test.passed).length;
console.log(`# ${tests.length} tests, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
