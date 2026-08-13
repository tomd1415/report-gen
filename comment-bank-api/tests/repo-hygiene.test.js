import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';

// Why this exists
// ---------------
// On 2026-08-12 three full database dumps were found tracked in git and pushed
// to the remote, including `INSERT INTO Users` — usernames and bcrypt hashes
// (docs/PROJECT_STATE.md §6.16). `.gitignore` has listed `dbbackup_web/` for
// years, which is exactly why nobody noticed: **the rule was correct and doing
// nothing, because .gitignore does not untrack what was already committed.**
//
// That is the shape this suite keeps finding — two things that must agree, with
// nothing comparing them. Here it is "what .gitignore says is not in the repo"
// against "what git says is in the repo", and one command settles it. It was
// never run, so the dumps sat there from 2024 to 2026.
//
// These checks read the repository, not the source tree, so they catch a file
// that no code imports and no page loads — which is precisely how this one hid.

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, '..', '..');

/**
 * Tracked files that .gitignore says should not be tracked.
 *
 * **These three are an ACCEPTED EXCEPTION, not an outstanding bug** — the owner
 * decided on 2026-08-12 to leave them, on the stated basis that **the repository
 * is private and the accounts in those dumps are test accounts**. That is the
 * only reason this list is allowed to be non-empty, and it is a deliberate
 * departure from docs/TESTING.md rule 1 (a known-failures list is a bug list),
 * so it is written down here rather than left as an unexplained allowance.
 *
 * **The premise is the thing to watch.** If the repository is ever made public,
 * or if a real staff account ever appears in one of these files, the decision was
 * taken on facts that no longer hold and needs retaking — bcrypt hashes in a
 * public repo are disclosed the moment anyone clones it. See
 * docs/PROJECT_STATE.md §6.16, and §6.18 for why a decision's premise is worth
 * recording next to the decision.
 *
 * Still asserted EXACT, and that is the point of keeping it at all: a *fourth*
 * dump is not covered by the decision and must fail, and removing one of these
 * must also fail so the list cannot drift away from what was actually agreed.
 */
const KNOWN_TRACKED_BUT_IGNORED = [
  'dbbackup_web/database-backup-2024-06-09.sql',
  'dbbackup_web/database-backup-2024-06-29.sql',
  'dbbackup_web/database-backup-2024-06-30.sql'
];

const git = (args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });

const gitLines = (args) => git(args)
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

describe('repository hygiene', () => {
  // Floor. Every check below reads `git ls-files`; if that returned nothing —
  // no git binary, a detached worktree, the wrong cwd — they would all pass by
  // examining an empty list. A gate that finds nothing must not report success.
  it('can see the repository at all', () => {
    const tracked = gitLines(['ls-files']);
    expect(tracked.length).toBeGreaterThan(50);
  });

  it('tracks nothing that .gitignore claims to ignore', () => {
    // The one-line check that would have caught the dumps in 2024.
    const trackedButIgnored = gitLines(['ls-files', '-i', '-c', '--exclude-standard']).sort();

    expect(trackedButIgnored).toEqual([...KNOWN_TRACKED_BUT_IGNORED].sort());
  });

  it('recommends no command that silently skips tests', () => {
    // `npx vitest` may resolve a globally installed Vitest that cannot see this
    // project's jsdom. Five test files then vanish from the run and the summary
    // still reads green (docs/TESTING.md, "Running them on this box").
    //
    // This is here because the rule provably does not hold itself. It was
    // written down once, and the unsafe form went on being recommended in four
    // places across three documents — including two that explain the trap
    // elsewhere in their own text, and including a milestone step that told the
    // reader to verify a security fix with it. Swept and fixed 2026-08-12; this
    // stops it coming back.
    //
    // Scoped to the invocation, not the word, so it cannot false-alarm on
    // ordinary prose about Vitest. `npx playwright` is deliberately not included:
    // no equivalent trap is documented for it.
    const ALLOWED_TO_MENTION_IT = ['docs/TESTING.md'];

    const docs = gitLines(['ls-files', '*.md', '*.txt']);
    expect(docs.length).toBeGreaterThan(5);

    const offenders = docs.filter((file) => {
      if (ALLOWED_TO_MENTION_IT.includes(file)) return false;
      return /npx\s+vitest/.test(fs.readFileSync(path.join(repoRoot, file), 'utf8'));
    });

    // Use `./node_modules/.bin/vitest` instead. If you are writing *about* the
    // trap rather than recommending the command, say so in docs/TESTING.md,
    // which is the one place allowed to spell it out — adding another file to
    // that list spreads the thing this check exists to contain.
    expect(offenders).toEqual([]);
  });

  it('tracks no file whose name says it holds a credential', () => {
    // Narrow on purpose: every pattern here is something that should never be
    // committed under any circumstances, so there is no allowlist to maintain
    // and no false alarm to teach people to ignore. `.env.example` is excluded
    // by the negative lookahead — it is a template and is meant to be tracked.
    //
    // Checked by hand 2026-08-12: its OPENAI_API_KEY value is an 11-character
    // `sk-` placeholder, far too short to be a real key. Nothing to do.
    const dangerous = /(^|\/)(\.env(?!\.example)($|\.)|id_rsa|.*\.(pem|key|p12|pfx)$)/;

    const tracked = gitLines(['ls-files']);
    // Its own floor, added 2026-08-13. The mutation run that day predicted this
    // assertion would stay GREEN when `gitLines` was made to return nothing —
    // and it did. `offenders` was `[]` because there was nothing to filter, not
    // because the repository was clean, and the two are indistinguishable from
    // the result. It was relying on the sibling floor test above, which is a
    // real protection but a fragile one: a `.only`, a filter, or splitting this
    // file apart separates them and nothing says so.
    expect(tracked.length).toBeGreaterThan(50);

    const offenders = tracked.filter((file) => dangerous.test(file));
    expect(
      offenders,
      'A credential-shaped file is committed to this repository. Remove it, and treat anything '
      + 'inside it as disclosed — rotate the key or password. Deleting it in a new commit does '
      + 'NOT remove it from history; ask before rewriting history.'
    ).toEqual([]);
  });

  it('tracks no SQL file containing a Users table dump', () => {
    // Name-based checks miss the interesting case: `insert_years_subjects.sql`
    // is a legitimate tracked .sql (Subjects and YearGroups only — verified),
    // so blocking the extension outright would be a false alarm people learn to
    // silence. What matters is the content: password hashes.
    //
    // Same exact list, and the same accepted exception recorded on it — the
    // owner chose on 2026-08-12 to leave those three, because the repository is
    // private and the accounts are test accounts. A *fourth* dump would not be
    // covered by that decision and fails here, which is the case this check is
    // really for: the next one to be committed, by someone who does not know.
    const sqlFiles = gitLines(['ls-files', '*.sql']);
    expect(sqlFiles.length).toBeGreaterThan(0);

    const withUserRows = sqlFiles.filter((file) => {
      const contents = fs.readFileSync(path.join(repoRoot, file), 'utf8');
      return /INSERT INTO\s+[`"]?Users[`"]?/i.test(contents);
    });

    expect(withUserRows.sort()).toEqual([...KNOWN_TRACKED_BUT_IGNORED].sort());
  });
});
