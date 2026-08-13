# Lessons learnt

_Started 2026-08-06, covering the work from 2026-07-28 to 2026-08-13: the
free-text redaction thread, the off-origin asset fixes, the doc-verification
pass, and the thirteen-item work-list of 2026-08-13._

The useful entry here is not "X was broken". It is **"X looked like Y, and here
is what would have told us sooner"** — including the wrong theories held on the
way, because the next person will believe them too.

---

## 1. A page can hang on an asset that is not needed to render it

**What happened.** Every Playwright test failed at `page.goto`, timing out. The
tests looked broken. They were not: `footer.html` loaded three Creative Commons
icons from `mirrors.creativecommons.org`, which this container cannot reach. The
request does not fail fast — it hangs — and the `load` event does not fire until
every subresource settles. `page.goto` waits for `load` by default, so *the whole
suite* failed on an icon nobody looks at.

**The wrong theory held first.** "The e2e suite is misconfigured / Playwright is
not set up in this sandbox." Plausible — the browser-binary CDN genuinely *is*
firewalled here, so there was a ready-made explanation that fitted the symptom
and was wrong. It cost real time, and it had been believed long enough to be
written into `docs/PROJECT_STATE.md` §3 as "the one untested slice".

**What would have told us sooner.** Listing the requests instead of reasoning
about the failure: one `page.on('request')` listener, or the browser devtools
network panel, names the stalled URL in seconds. The generic lesson is that a
timeout tells you *nothing* about which resource caused it, so the first move on
any load timeout is to enumerate requests, not to theorise about the harness.

**The second instance.** After fixing the icons, `index.html` still timed out at
30 s with nothing blocked. Identical mechanism, different asset: the Google Fonts
`@import` at the top of `styles.css`. A CSS `@import` is easy to miss because it
is not in the HTML and does not appear in a grep for `http` in `*.html`.

**Grep that finds both:**
```
grep -rnE "https?://" comment-bank-api/public --include=*.html --include=*.css --include=*.js
```

**Now guarded by** `tests/e2e/ui-smoke.spec.js` → *"no page loads an asset from
another origin"*.

**The wider point:** on a filtered school network this is not a test problem, it
is a *product* problem — the page appears to stall for a teacher exactly as it did
for the test runner. The test environment was reproducing the deployment
environment and we spent the first hour treating it as noise.

---

## 2. An empty allow-list passes for two different reasons

The off-origin guard has a `KNOWN_OFF_ORIGIN_VIOLATIONS` list that is currently
empty. An empty list passes when everything is clean — and *also* when the check
never runs, the page list is empty, or the request listener is attached after
navigation starts. Those are indistinguishable from the green tick.

**What we did:** planted `https://example.com/evil.svg` in `footer.html`,
confirmed the test failed *and named that URL*, then reverted and confirmed the
file was byte-identical to `HEAD`.

**Generalised:** every gate added since is meta-tested the same way, in **both**
directions where the gate has two:
- break the thing it guards → must go red, and the message must name what broke;
- fix an entry the gate has recorded as a known bug → must *also* go red, so the
  list cannot go stale.

The second direction is the one usually skipped, and it is the one that decides
whether the list is a bug list or an excuse list.

**But the exactness rule is stakes-dependent, and applying it everywhere gets the
gate switched off.** An *exact* known-failures list is right for a
security-shaped invariant, where every entry is a live hole and someone must
notice when one closes. It is too strict for something like docs↔endpoints, where
a stale README line would start failing builds for a cosmetic reason — and a gate
that fails for cosmetic reasons gets disabled within a fortnight, taking the real
coverage with it. Match the strictness to what a false alarm costs: exact for
security, "no new entries" for documentation. (This distinction came from the
devil's advocate review on 2026-08-06; the original write-up taught one rule for
both and would have taught one of them wrongly.)

**Applied again 2026-08-06** to `tests/route-auth-matrix.test.js`: removing
`app.use('/api/comments', isAuthenticated)` turned it red naming all five
affected routes; adding the missing `/api/categories` guard turned the
`KNOWN_UNGUARDED` assertion red as intended. Reverting was verified with
`git diff --quiet`, not by eye.

---

## 3. Two lists that must agree, with nothing checking that they do

Authentication in `src/routes/index.js` lives in a block of `app.use(prefix, ...)`
guards ~1,600 lines away from the routes they protect. `/api/comments` and
`/api/categories-comments` are in that block; `/api/categories` is not. Four
endpoints have been unguarded for an unknown length of time.

**Why nothing caught it.** The handlers read `req.session.user.id` on their first
line, so an unauthenticated request throws and Express returns 500. No data is
read or written — it is safe *by accident of line ordering*. Nothing crashes at
boot, no test fails, and the endpoint merely looks like it is erroring.

**Why it matters anyway.** The status is wrong (a 5xx alarm fires spuriously; a
401 alarm never fires), and any edit that makes the lookup tolerant —
`req.session?.user?.id`, a default, moving it below a query — silently converts a
crash into an unauthenticated write.

**The shape to look for:** *anywhere a property of one list must appear in
another list, and neither list knows about the other.* Route↔guard here; page
list↔asset guard in §2; `.env.example` keys↔`config/env.js` readers; documented
endpoints↔registered endpoints. In every case the check is the same: enumerate
the real thing at runtime and compare, rather than reading both lists and
believing they match.

**What would have told us sooner:** 40 lines that walk `app.router.stack` and
assert every route rejects a logged-out request. Now `tests/route-auth-matrix.test.js`.

**The follow-on lesson, which is the sharper one.** The first write-up of this
finding said the routes were "safe by accident of line ordering" and stopped
there. That sentence is only true for a *logged-out* request. A logged-in user
has `req.session.user.id`, so the throw never happens — and if any of those four
had taken its scoping id from the request rather than the session, the missing
guard would have been one teacher reading another's data, not a wrong status
code. Same missing guard, two completely different severities, and the summary
sentence hid the difference.

They were checked and all four scope by the session, so there is no disclosure
here. The lesson is not about the outcome: **when you explain why a bug is
harmless, name the case your explanation covers, then check the other one.** A
reassuring sentence is where an investigation stops, so it needs to be the most
carefully bounded thing in the write-up. This one was found by asking for an
outside review rather than by any test.

**A second follow-on, from writing these gates rather than from the bug.** The
instruction above — *enumerate the real thing at runtime and compare* — is easy
to agree with and easy to not quite do. `public-module-coverage` was written to
guard "every browser module is syntax-checked by something", and its first
version compared two *texts*: the filenames in `public/` against the strings
appearing in the test sources. A comment mentioning a filename would have
satisfied it. It was a source scan wearing the clothes of a runtime check, in a
gate whose entire purpose was to stop exactly that.

Nothing went red. Green is what a gate with a false pass looks like from the
outside, so the only thing that finds one is deliberately re-reading your own
work and asking *what would make this pass when it should not?* It was rewritten
to import each module itself, which leaves nothing to fool: 2026-08-09, a
planted syntax error goes red naming the file, and a brand-new module is picked
up with no list to update.

The habit worth keeping: after writing a gate, before trusting it, ask **what
would satisfy this check without satisfying the thing it stands for.** Meta-
testing catches a gate that cannot fail; only that question catches a gate that
fails for the wrong reason.

**A third instance, and the one with teeth (2026-08-12).** `.gitignore` has listed
`dbbackup_web/` for years. It is correct, it is old, and it was doing nothing:
**`.gitignore` does not untrack what was already committed.** Three full database
dumps — including `INSERT INTO Users`, so usernames and bcrypt hashes — had been
tracked and pushed since 2024 (`PROJECT_STATE.md` §6.16).

The shape is the familiar one: a rule stated in one place, reality in another,
nothing comparing them. What is worth noticing is *why this instance survived
longest*. The others were two lists inside the code, where a test could enumerate
one side and compare. This is a rule about the **repository**, and every test in
the suite reads the *working tree* — so no amount of test-writing about the source
could have seen it. The files were imported by nothing, served by nothing, and
mentioned by nothing.

**So when hunting for two lists that must agree, include the ones that are not
about code:** what git tracks, what the ignore rules claim, what the deploy
actually copies, what the service account can reach. The check here was one
command that had never been run:

```bash
git ls-files -i -c --exclude-standard
```

And the trigger for running it was not diligence. It was a devil's advocate
asking whether a claim I had leaned on for six cycles — "backups are also taken
elsewhere" — was measured or assumed. It was assumed. Checking it meant opening a
directory nothing else had any reason to open.

---

## 4. The documentation drifted precisely where the code changed most

The doc-verification pass on 2026-08-06 checked every concrete claim — path,
port, flag, filename, command, count — in `README.md`, `QUICK_OPS.md` and
`docs/PROJECT_STATE.md`. Roughly 45 claims. The environment variable reference was
**entirely accurate** (every default matched `src/config/env.js`); the endpoint
list, the migration list and the token limits were accurate too.

Everything wrong clustered in the two areas that had just been rewritten:

- **The privacy summary.** `README.md` line 3 and `PROJECT_STATE.md` §1 both
  still said *"pupil names are never sent to OpenAI … swapped back after
  generation"* — describing the server-side mechanism that was retired on
  2026-07-30, in the exact words `CLAUDE.md` marks as load-bearing and forbids.
  The *detailed* sections in both files were correct and had been carefully
  updated. Only the one-line summaries at the top were stale.
- **The test-status claims.** "15 files, 67 tests", "8 UI smoke tests never run
  here, blocked by a firewalled CDN" — all superseded (16 files, 91 tests, e2e
  9/9 green).

**The lesson.** Summaries drift faster than detail, because a change is applied
where the change *is*, and the abstract at the top of the file is not where the
change is. The overview is also what a reader trusts most and checks least, and
the thing most likely to be pasted into a DPIA or an email to a head teacher.

**Rule adopted:** when a mechanism changes, grep the whole repo for the *old
mechanism's vocabulary* before considering it done —
`grep -rn "never sent\|swapped back\|after the OpenAI call" --include=*.md .` —
not just the section describing it. Numbers in prose (`15 files`, `2060 lines`,
`~8 pages`) should be treated as claims with a shelf life; if they are worth
stating they are worth a dated re-check, and the date should be *in* the
sentence.

---

## 5. "Tests fail intermittently" was not a test problem

For a stretch the Vitest suite failed 2–3 tests per run — **different ones each
run**, all 5000 ms timeouts, with the total duration swinging from 15 s to 186 s.

**The wrong theories, in the order held:** (1) a stray background `vitest` from an
earlier run competing for the port — killed it, no change; (2) a race in the new
confirm-preview code; (3) genuine flakiness needing a higher committed timeout.

**What it actually was:** `uptime` showed a load average around 30 on 4 cores,
with only one node process inside the container. The host was saturated from
*outside* the container. Nothing in the repo was wrong.

**What would have told us sooner:** `uptime` — one command, and it should be the
first response to "different tests fail each run", not the last. The tell is
**non-determinism plus duration variance**: a real race usually fails in a
consistent place, and a real performance regression is consistently slow. Both
varying together points outside the process.

**The trap avoided:** raising the committed `testTimeout` would have "fixed" it
and permanently weakened the suite for everyone, to compensate for a condition
that is not in the repo and not always present. Use
`./node_modules/.bin/vitest run --testTimeout=30000` and
`./node_modules/.bin/playwright test --workers=1` on the command line when the box
is loaded; leave the defaults alone.

---

## 6. Small environment traps worth writing down once

- **The Bash tool's working directory persists between calls.** A `cd public`
  early in a session made a later `vitest run` report `No tests found` from
  inside `public/`. Re-anchor with an absolute `cd` before running a suite rather
  than assuming the directory.
- **Node resolves dependencies from the script's location, not the cwd.** A probe
  script written to a scratchpad directory cannot `import express` even when run
  with the project as cwd. Put throwaway probes *inside* the project (and delete
  them), or use an absolute path into `node_modules`.
- **`page.setContent` resolves relative URLs against `about:blank`.** Relative
  `src` attributes silently load nothing, which renders as a blank image rather
  than an error. Use absolute `http://127.0.0.1:<port>/…` URLs when rendering a
  fragment for a screenshot.
- **`$?` after a pipeline is the *last* command's status, not the one you care
  about.** Meta-testing `check:inline-scripts` on 2026-08-12, I ran
  `npm run check:inline-scripts 2>&1 | tail -3; echo "exit=$?"` — and read
  `exit=0` while a planted syntax error was in the tree. For about a minute I
  believed the pre-deploy gate passed on broken code, which would have been a
  serious finding. `$?` was `tail`'s. Re-measured without the pipe: **exit 1 with
  the error, exit 0 when clean — the gate is sound.**

  The trap is not the shell rule, which everyone knows. It is that the wrong
  answer *confirmed a suspicion* — I was meta-testing precisely because I doubted
  the gate — and a wrong answer you already half-expect does not feel wrong. When
  a check produces the alarming result you went looking for, measure it a second
  way before writing it down. Use `${PIPESTATUS[0]}`, or do not pipe at all when
  the exit code is the thing under test.

- **A staged migration can be safer without being smaller.** Decision 3(A) in
  `docs/REDACTION-DECISIONS.md` kept both server paths during the cut-over. It
  made the change safe to land incrementally; it did not reduce the total work,
  and the estimate that it would was wrong. That is recorded in the decision doc's
  *Outcome* section rather than quietly forgotten.


---

## 7. Fixing a bug can disable the guard that was watching it

**What happened.** `/api/categories` got its missing auth guard, and
`KNOWN_UNGUARDED` — the list of routes known to be unprotected — was emptied, as
the process requires. A separate test iterates that list to check no entry has
gone stale. With the list empty **the loop body never runs**, so that test began
asserting nothing at all. It passed whatever the router did, including with the
route enumeration returning no routes.

**What it looked like.** A closed bug and a green suite. Both true, and the guard
underneath had quietly stopped existing. Nobody broke it: *fixing* the bug is what
made it vacuous.

**What would have told us sooner.** Running the mutation specs **as a set** rather
than one at a time. Each break had been verified in isolation when written; run
together, this one reported

> 1 of 3 expected assertions stayed green while 2 others went red

A bare pass/fail would have called it covered — something *did* go red. The
shortfall is the signal, which is the whole reason the tool reports per-assertion.

**Carry forward:** *any assertion that loops over a list needs a floor outside the
loop*, and a mutation spec is hand-maintained, so §3 of this document applies to
it like anything else — verify it as a set, periodically, not once at birth.

---

## 8. A verification tool needs the same scepticism as the thing it verifies

**What happened.** Every mutation result for a fortnight passed through a reporter
I wrote and nothing tested. Asking what it *could* do wrong — rather than waiting
for a symptom — found that two tests can sanitise to the same name, because
colons are rewritten to avoid a truncation bug in the tool downstream.

**Why it mattered more than an ordinary bug.** `mutate` collects failed assertion
names into a **set**. If one of a colliding pair reddened and the other did not,
the shared name would land in that set and the break would be reported as
*caught* — a gate looking proven when half of it never moved. A fault in a
verifier does not produce a wrong result; it produces a wrong **verdict about
every result**.

**What would have told us sooner.** Nothing would have. That is the point: the
failure mode is a confident right-looking answer, so no symptom was ever going to
appear. It was found by treating the tool as suspect on principle. There were no
collisions in practice, so nothing recorded was wrong — but the guard is there
now, and it fails closed.

**Carry forward:** *"it has always worked" is not evidence when the failure mode
is a confident wrong answer.*

---

## 9. Three claims that sound like one

Each pair below reads as the same statement and is not. All three cost something
this fortnight.

- **"The tests pass" ≠ "the migration runs."** This suite mocks the database
  entirely — its most valuable property, and the reason a green run says nothing
  about the SQL Sequelize generates. A migration's whole job is to execute against
  a real server, and ours never had. Narrowing it statically (model table name
  versus `createTable`, model attributes versus migration columns) closed the
  failure modes that bite hardest; the rest needs a real connection and is written
  down as an owed check rather than assumed.
- **"Called by no page in this repo" ≠ "called by nothing."** A bookmark, a
  script or a cached admin page still reaches a route. Before deleting eight
  apparently-dead endpoints, put a warning on them and wait — the evidence you
  want is *the warning fired for nobody*, not *the grep was empty*.
- **"De-duplicated" ≠ "behaviour-preserving."** Two copies of one helper had
  drifted by a single `String()`, so merging them had to choose, and the honest
  choice made one path worse before it could be made better. A refactor that
  cannot change behaviour is not a refactor of two things that disagree.

---

## 10. Ask which failure mode a check actually catches

**What happened.** After a fortnight of building gates, the reflex was to build
another: every `§x.y` cross-reference should resolve, every cited path should
exist. It was not built, and declining was the more useful outcome.

**Why.** Two reasons, and the second generalises:

- Three of the four paths it flagged were *proposals* — a rename not yet done,
  files a plan will create. Planning documents are supposed to name things that do
  not exist yet, and a gate with that false-positive rate is switched off within a
  fortnight, taking real coverage with it.
- The section-ref check catches the **harmless** failure and misses the dangerous
  one. A dangling `§6.99` tells the reader something is wrong. A reference that
  *still resolves but now points at different content* — after a renumbering —
  says nothing, and existence-checking cannot see it.

**Carry forward:** before building a check, name the failure modes and ask which
it catches. *If it catches the loud one and misses the quiet one it is worse than
nothing, because the quiet one is now behind a green tick.*

---

## 11. Two false theories held on the way, recorded because they were reasonable

- **"Characterisation tests should assert the behaviour I want."** Written that
  way, they were red before the `cleanText` merge and green after — which cannot
  distinguish *the move fixed the drift* from *the move broke something else*.
  Pinning the divergence **as it actually was**, green before and red after, is
  what makes the change deliberate and legible. Rewritten before the move landed.
- **"A defensive `?? null` is free."** Two of them wrote `null` into columns
  declared `NOT NULL`. Measured: both unreachable, so not a live bug — but had
  either fired, the insert would have thrown into a deliberate swallow and the
  audit row would have vanished **silently**. A fallback that makes a failure
  quieter is worse than no fallback.


---

## 12. A heavy tool leaked for four hours and nothing noticed

**Corrected 2026-08-13 with host evidence.** My first write-up of this was wrong in a way worth
preserving: I dated the incident to ~18:20 and credited myself with stopping it. Both false.

**What actually happened.** Repeated `mutate` invocations — a dozen-odd across the day, several
backgrounded — did not clean up their children. From host measurements: the oldest
`vitest`/`esbuild` processes had run **15,043s (~4.2h)**, so it began near **14:00**; by
**15:42** the 15-minute load average was already **238**; stuck `docker exec` probes against
this container go back to **~14:25**. The supervisor killed the last **69** processes at
**18:25** — 22 `mutation-report.mjs`, 138 vitest, 46 esbuild. I killed some at 18:23; I did not
end it.

**It bred for over four hours and nothing noticed.** Not the suite, not the dashboard — which
showed this container as *down* because the load had wedged `docker exec`, so the one system
watching was blinded by the fault it should have reported. And not me: I ran `uptime` once at
03:33 and never again until something looked wrong.

**What would have told me sooner.** Checking `uptime` after each heavy run, and checking that
the tool's children were gone rather than trusting its exit. `mutate` says it restores the tree;
it does not promise its grandchildren are dead. **An exit code is a statement about the parent.**

**The secondary lesson, still true but not the cause.** At ~18:20 — four hours in — I wrote a
test that shells out to its own suite and put it in that suite, so running the suite ran the
test which ran the suite. That added the final burst to an already-wedged box. The rule stands:
**if a check needs the suite's own output, it cannot live in the suite.** The tell was a check
that should take milliseconds taking minutes, and I read it as cost rather than recursion.

**Two compounding errors in the cleanup**, both in `/claude-guidance/LESSONS.md` §5 and both
walked into anyway: `pkill -f vitest` matches its own command line and partly killed itself
(exit 144), and `pgrep -cf` then reported **2 remaining** when the answer was **0**, matching
itself again — I nearly recorded that as fact. Count with a pattern that cannot match the
counter: `ps -eo pid,args | grep -E "[v]itest"`.

**Carry forward:**
- *An exit code is a statement about the parent.* Verify the children are gone.
- *Check the load after heavy work*, not only when something looks wrong. Four hours of
  evidence sat in `uptime` the whole time.
- *Knowing a trap is not the same as not walking into it* — three times this fortnight I hit
  something in a document I had read that morning. The defence is measuring a second way when
  the first answer is one you would like to be true.
- *A monitor blinded by the fault it should report is the worst failure shape here*: the
  dashboard said "down" when the truth was "up and on fire".

**And the irony, kept because it is instructive:** this happened while implementing a critique
whose whole point was that my verification estate is not self-maintaining. Making it
self-guarding is what made it self-replicating.
