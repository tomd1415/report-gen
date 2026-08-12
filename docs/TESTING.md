# Testing: what each suite is for, and the rules the gates follow

_Written 2026-08-06, updated 2026-08-07. `README.md` lists the commands; this explains **why** the
suites are shaped the way they are, and the conventions the gates follow — which
until now lived only in commit messages, where nobody reads them._

---

## The suites

| Command | What it is | Needs |
|---|---|---|
| `npm test` | Vitest — 24 files, 150 tests | nothing |
| `npm run test:e2e` | Playwright — 13 browser journeys | Chromium |
| `npm run check:inline-scripts` | syntax-checks the inline `<script>` blocks | nothing |
| `npm run check:deploy` | all three, then `git diff --check` | Chromium |

**The Vitest suite needs no database and no API key.** Models and the OpenAI
client are injected into `registerRoutes(app, { models, openai })`, so every test
supplies mocks. This is the single most important property of the suite: it means
a contributor can run it on a clean checkout, and it is why the tests are worth
running on every change rather than only before a deploy.

The consequence to remember: **a passing Vitest run says nothing about the SQL
Sequelize actually generates**, because no query ever executes. Ownership tests
assert the `where` clause that was *passed*, not the rows that came back. For
anything schema-shaped, the real check is booting against a live MariaDB, or
`docs/restore_drill.md`.

`tests/e2e/` runs against a static server (`tests/e2e/static-server.mjs`) with
API responses mocked by `page.route`. So the e2e suite tests **the browser code**,
not the server — the two never talk to each other in CI.

UI-helper tests opt into jsdom per file with `// @vitest-environment jsdom` on
line 1. The project default is `node` (`vitest.config.js`), so a new DOM test
that omits that comment fails with confusing `document is not defined` errors.

---

## Running them on this box

Two traps, both of which have cost time:

**1. `npx vitest` may pick up a globally installed Vitest**, which cannot resolve
`jsdom` from the project's `node_modules`. The symptom is misleading: five test
files vanish from the run and the rest pass, so the summary reads `12 passed`
instead of `18 passed` and looks fine at a glance. Use the project's own binary:

```bash
cd /workspace/comment-bank-api
./node_modules/.bin/vitest run
```

**2. The host is shared and its load average intermittently reaches 20–38 on 4
cores.** Above roughly 20 the suite starts failing 2–3 tests per run, *different
ones each time*, all 5000 ms timeouts, with the total duration swinging from 15 s
to 186 s. That is environmental. The tell is non-determinism **plus** duration
variance — a real race usually fails in a consistent place, and a real
performance regression is consistently slow. Check `uptime` before debugging.

```bash
./node_modules/.bin/vitest run --testTimeout=30000
./node_modules/.bin/playwright test --workers=1
```

**Do not raise the committed defaults to make this go away.** That permanently
weakens the suite for everyone, to compensate for a condition that is not in the
repo and is not always present.

**Trap 1 had spread into the documents that were meant to warn about it.** Swept
2026-08-12: `npx vitest run` was still the *recommended* command in four places
across `NEXT-MILESTONE.md`, `PROJECT_STATE.md` and `LESSONS-LEARNT.md` — three
documents that each explain, elsewhere, why that invocation silently drops test
files. All now use `./node_modules/.bin/vitest`. Worth noticing how it happened:
the warning was written once, in this file, and the *habit* it warns about kept
being written down everywhere else. **A trap documented in one place is not
documented.** If a command is unsafe, the fix is to stop the unsafe form
appearing anywhere, not to explain it well in a single document.

**And now enforced**, in `tests/repo-hygiene.test.js` rather than a tenth gate —
it belongs with the other checks that read the repository rather than the code.
It fails if any tracked `.md`/`.txt` recommends `npx vitest`, with exactly one
file allowed to spell the form out: **this one**, because explaining the trap
requires naming it. Scoped to the invocation, not the word, so ordinary prose
about Vitest is unaffected. `npx playwright` is deliberately not included — no
equivalent trap is documented for it.

The justification for spending a check on a documentation rule, since that is not
usually worth it: this rule provably does not hold itself. It was written down
once and then broken four times in three documents inside a week, by someone who
knew it. That is the bar — not "it would be nice if people remembered", but
"people demonstrably did not, repeatedly".

---

## The gates, and the rules they follow

Nine checks exist to catch a class of problem that ordinary tests do not: a rule
that is *stated* somewhere and enforced nowhere.

| Gate | Where | Guards |
|---|---|---|
| Route auth matrix | `tests/route-auth-matrix.test.js` | every route rejects a logged-out request |
| Off-origin assets | `tests/e2e/ui-smoke.spec.js` | no page loads anything from another origin |
| Inline script syntax | `scripts/check-inline-scripts.mjs` | inline `<script>` blocks parse |
| Import name warning | `tests/e2e/ui-smoke.spec.js` | the highlighter and confirm gate actually block a send |
| Browser-module coverage | `tests/public-module-coverage.test.js` | every `public/*.js` parses — the test imports each one itself |
| Migration coverage | `tests/migration-coverage.test.js` | the glob matches every migration file, every model's table gets created, and the restore drill's table count is right |
| OpenAI privacy params | `tests/openai-privacy-params.test.js` | every OpenAI request really sends `store: false` and a hashed `safety_identifier`, and no call site escapes the check |
| Repository hygiene | `tests/repo-hygiene.test.js` | nothing tracked in git that `.gitignore` claims to ignore, no credential-shaped filenames, no SQL carrying a `Users` dump, and no doc recommending `npx vitest` |
| Feedback targets | `tests/feedback-target-ids.test.js` | every element id a page asks `ReportGenUI` to write to actually exists on that page |

### Rule 1 — a known-failures list is a bug list, not an exceptions list

Four gates carry a list of things that currently fail or cannot be checked:
`KNOWN_UNGUARDED`, `KNOWN_OFF_ORIGIN_VIOLATIONS`, `KNOWN_TRACKED_BUT_IGNORED` and
`KNOWN_UNCHECKABLE_CALL_SITES`. All are **outstanding bugs or blind spots**, not
approved carve-outs. When you fix one, delete its entry — or decrement the count.
Never add an entry to make a build green.

### Rule 2 — assert the list is *exact*, where the stakes justify it

`route-auth-matrix` asserts the set of unguarded routes equals `KNOWN_UNGUARDED`
exactly. That means it fails in **both** directions: a newly unguarded route
fails, and so does fixing a route without shrinking the list. Without the second
half, a known-failures list quietly becomes permanent.

**But match the strictness to what a false alarm costs.** Exactness is right for
a security-shaped invariant, where every entry is a live hole and someone must
notice when one closes. It is wrong for something like docs-versus-endpoints,
where a stale line would start failing builds for a cosmetic reason — and a gate
that fails for cosmetic reasons gets switched off within a fortnight, taking the
real coverage with it. For those, assert "no *new* entries" instead.

### Rule 3 — meta-test every gate, in both directions, before trusting it

A gate nobody has watched fail is decoration. Before relying on a new one:

1. **Break the thing it guards.** It must go red *and name what broke*.
2. **Fix an entry it records as a known bug.** It must *also* go red, so the list
   cannot go stale.

Then revert and confirm with `git diff --quiet`, not by eye. Every gate above has
been through this; the results are in `docs/LESSONS-LEARNT.md` §2.

`openai-privacy-params` is the clearest illustration of *why* both directions,
because it is built from two halves and the meta-test shows neither is redundant
(`PROJECT_STATE.md` §6.14): dropping `store: false` reddens the runtime half and
not the census, while adding a sixth call site reddens the census and not the
runtime half. Had only one half been meta-tested, the other could have been
decoration and nobody would have known.

### Rule 4 — a gate must not be able to pass without checking anything

The commonest way a gate becomes decoration is not being wrong — it is finding
nothing and reporting success. `check-inline-scripts.mjs` used to print
`Checked 0 inline scripts` and exit **0**, so `check:deploy` went green whether or
not the check had run. It now fails if it finds no HTML files, and fails if it
finds HTML but zero inline scripts.

So every gate needs a floor:

- `route-auth-matrix` asserts it enumerated more than 50 routes, so an empty or
  broken router cannot pass it.
- `check-inline-scripts` asserts it checked at least one script in at least one
  file.
- The off-origin guard derives its page list from `public/*.html` and asserts it
  found at least twelve. It used to visit an explicit list, which is a different
  trade: an explicit list cannot shrink by accident but also cannot grow, and it
  had in fact fallen one page behind the directory (`PROJECT_STATE.md` §6.15).
  Deriving plus a floor gets both properties.
- `migration-coverage` asserts the glob resolved at least one migration and that
  at least one table was created. Both matter: umzug's `up()` resolves happily
  with zero migrations (measured — see `PROJECT_STATE.md` §6.13), so without the
  floor the model comparison would pass by comparing against nothing.
- `openai-privacy-params` asserts a minimum number of *captured* OpenAI calls per
  path. Without it, a request that 400s before reaching OpenAI would satisfy
  "every call was private" by having made none.
- `repo-hygiene` asserts `git ls-files` returned more than 50 paths. Every check
  in it reads that command, so a missing git binary or a wrong cwd would
  otherwise make all of them pass by examining an empty list.
- `feedback-target-ids` asserts it found the pages *and* more than a hundred
  literal call sites. It is a regex over HTML, and a regex that quietly stops
  matching is the most ordinary way a check like this becomes a green no-op.

**Prefer "more than zero" to an exact count** unless the number is meant to be
stable. The inline-script count is *meant to fall* as scripts move into
`public/*.js` (see `PROJECT_STATE.md` §6.4), so pinning it would make legitimate
progress fail the build.

### Rule 5 — test the branch that fires when a check cannot run

A check that silently finds nothing is indistinguishable from one that never
ran, and in an interface where clean means safe, an unrendered warning reads as
an endorsement. The import page's possible-name check therefore **fails closed**:
if `report-selection.js` does not load, the import is refused rather than sent
unchecked — and `tests/e2e/ui-smoke.spec.js` aborts that script's request to
prove the refusal actually happens.

Write that test whenever a control's absence looks the same as its success.

_(An earlier Rule 5 described a mechanism this project no longer has. It was
replaced rather than amended, deliberately: `/claude-guidance/LESSONS.md` §3
records that a correction which repeats the claim it retracts gets read as the
claim — two careful readers quoted a retracted sentence back as current, having
matched it and missed the correction beside it. `git log docs/TESTING.md` has the
old text if it is ever needed.)_

### Rule 6 — a gate that reads source text can be satisfied by a comment

If a check answers its question by searching for a *string*, then writing that
string in a comment passes it. `/claude-guidance/LESSONS.md` §3 records this as a
source-scanning test passing on the comment that explains the bug, and it is easy
to reproduce accidentally in one's own work.

`public-module-coverage` was written that way first: it scanned the test sources
for `public/<name>` and passed if the string appeared anywhere, so a comment
naming a file would have satisfied it while nothing imported the module — a false
pass, in a gate whose whole purpose is to stop false passes. It was found on a
deliberate re-read, not by anything going red, which is the point: this failure
mode is invisible from the outside because the gate is green either way.

So **enumerate or execute the real thing** wherever you can:

- import the module rather than grepping for an import of it;
- walk `app.router.stack` rather than reading route declarations;
- run the migrations against a recording stub rather than matching
  `createTable(` in the source;
- drive the request and inspect what was sent rather than grepping for
  `store: false`.

When a source scan genuinely is the right tool, make it **count** rather than
match, and check the direction it fails in. The census in
`openai-privacy-params` counts `.responses.parse(` call sites; a stray mention in
a comment inflates that count and turns the gate **red**. A false alarm someone
reads is an acceptable cost. A false pass is not.

**The question is worth asking of the gates you did not write.** Pointed at the
two oldest ones on 2026-08-12 it found an answer in both: `route-auth-matrix`
never sent a request to anything in `INTENTIONALLY_PUBLIC`, so that list was a
silencer rather than an exception list, and the off-origin guard's hand-written
page list had fallen a page behind `public/`. Details and the meta-tests are in
`PROJECT_STATE.md` §6.15. A gate being old is not evidence it is sound; it only
means nobody has asked recently.

**A skip list needs the same discipline as a known-failures list.** Rules 1 and 2
say a list of things that currently fail must be exact and must go stale loudly.
The same applies to a list of things deliberately *not* checked — otherwise the
cheapest way to make a gate green is to add a line to it.

---

## Adding a test — what is worth writing

Prefer, in this order:

1. **Silent failures** — a wrong number, a skipped step, an empty result. These
   outrank anything that crashes loudly, because a crash gets noticed.
   `tests/import-empty-result.test.js` is the model. It was written to prove an
   import returning nothing *destroyed* the comment bank while reporting success;
   it now asserts the fix, and still asserts both halves together — the call
   fails **and** nothing was deleted. Asserting only the failure would pass even
   if the delete happened first, which was the whole bug.
2. **A control alongside the failure.** Every "this goes wrong" test should sit
   next to one proving the harness does the right thing when the input is good —
   otherwise the failing assertion may be passing for the wrong reason.
3. **Provenance of authority.** Where does the scoping `userId` come from? If the
   answer is "the session", assert that a `userId` in the body or query is
   ignored. `tests/ownership.test.js` does this for the four `/api/categories`
   routes.

Avoid asserting an outcome from an exit code alone, and avoid any check whose
output is discarded when the command exits non-zero.
