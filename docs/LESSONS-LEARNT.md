# Lessons learnt

_Started 2026-08-06, covering the work from 2026-07-28 to 2026-08-06: the
free-text redaction thread, the off-origin asset fixes, and the doc-verification
pass._

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
`npx vitest run --testTimeout=30000` and `npx playwright test --workers=1` on the
command line when the box is loaded; leave the defaults alone.

---

## 6. Small environment traps worth writing down once

- **The Bash tool's working directory persists between calls.** A `cd public`
  early in a session made a later `npx vitest run` report `No tests found` from
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
- **A staged migration can be safer without being smaller.** Decision 3(A) in
  `docs/REDACTION-DECISIONS.md` kept both server paths during the cut-over. It
  made the change safe to land incrementally; it did not reduce the total work,
  and the estimate that it would was wrong. That is recorded in the decision doc's
  *Outcome* section rather than quietly forgotten.
