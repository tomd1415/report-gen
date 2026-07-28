# Handoff: free-text pupil-name redaction — 2026-07-28

> **RESOLVED 2026-07-29.** The three decisions were settled (1(A), 2(A), 3(A))
> and the plan was implemented. See `docs/REDACTION-DECISIONS.md` → *Outcome* and
> `docs/PROJECT_STATE.md` §6.3.1. Kept as the record of the thread; do not treat
> the *Next actions* below as outstanding.
**Goal:** stop pupil names reaching the AI model via the two free-text fields
("additional comments", "strength focus"). **Done looks like:** agreed layered
mitigation + client-side current-pupil redaction implemented, tests green, docs
reframed — but **implementation is not yet authorized**; three sub-decisions must
be answered first.

## Environment
- Debian 12 (bookworm) container, **no systemd**. Node **v20.20.2**. Repo at
  `/workspace` (git, branch `main`).
- App: `/workspace/comment-bank-api`, `server.mjs` → **:44344**. MariaDB
  **10.11.18** → **127.0.0.1:3306**.
- `/workspace/comment-bank-api/.env` (local dev, gitignored): DB `comment_bank`,
  user `reportgen` / pw in that file, **placeholder** OpenAI key. No real secrets.

## Established (fact ← evidence)
- Both servers up now ← `pgrep -a mariadbd` → `129381 /usr/sbin/mariadbd`;
  `curl -s :44344/api/health` → `{"ok":true,"status":"ok"}`.
- **MariaDB server pkg + `/var/lib/mysql` do NOT survive a container restart** ←
  this session, post-restart: `dpkg -l | grep mariadb-server` empty,
  `/var/lib/mysql` absent; only client libs remained. Fixed by
  `apt-get install -y mariadb-server` → re-init → recreate DB+user → app re-ran
  migrations. The Node app also does not auto-start (no init).
- Server-side redaction of free-text against the submitted pupil name is
  **shipped** ← commit `e4cb852` (`git show --stat e4cb852`: `routes/index.js`
  +30, `report-generation.test.js` +62). Helper `redactPupilName` in
  `comment-bank-api/src/routes/index.js`.
- Test suite green ← `npm test` (in `comment-bank-api`) → `15 files, 69 tests
  passed`.
- The three decisions below are written up in full at
  `docs/REDACTION-DECISIONS.md` ← commit `9b4046f`.

## Ruled out (approach ← the observation that killed it)
- Server-side per-class pupil-name list ← user rejected on data-protection
  grounds; no pupil-name roster may be held server-side. [decided]
- In-browser *persisted* name list ← same DP objection once persisted; off the
  table.
- Auto-redacting heuristic-detected names in free-text ← would destroy legitimate
  proper nouns (e.g. *Newton*, *the Tudors*); the highlighter must be **warn-only**.

## Open questions (the three parked decisions — leans are [proposed], not chosen)
Full analysis in `docs/REDACTION-DECISIONS.md`. These need the user's answer, not
a command — there is no discriminating test.
- **Preview trigger:** show confirm only when free-text is non-empty (lean A) vs
  every send (B).
- **Accountability trail:** interaction-only, nothing stored (lean A) vs also a
  stored metadata row — user + timestamp + confirmed bool, no content (B).
- **Legacy name branch:** keep both server paths as a migration (lean A) vs hard
  cut-over to name-never-sent (B).

## Next actions (in order)
1. If servers are down (`curl -s :44344/api/health` fails): start MariaDB
   `nohup /usr/sbin/mariadbd --user=mysql &`, then
   `cd /workspace/comment-bank-api && nohup node server.mjs &` (migrations run on
   boot). If `/usr/sbin/mariadbd` or `/var/lib/mysql` is missing →
   `apt-get install -y mariadb-server`, then recreate DB `comment_bank` + user
   `reportgen` (pw in `.env`) before starting the app.
2. Get the user to settle the three decisions in `docs/REDACTION-DECISIONS.md`.
   **Do not write implementation code before that** — the user said "spec it
   first and show me the plan before implementing" and has not authorized code.
3. Once decided, implement the agreed plan: (a) pure client helpers
   `redactPupilName` / `restorePupilName` / warn-only `findSuspectNames` in
   `public/report-selection.js` (unit-tested like `tests/ui-selection.test.js`),
   plus DOM wiring + confirm-preview + guidance text in `public/index.html`;
   (b) make `POST /generate-report` accept a name-absent path in
   `src/routes/index.js` (keep the legacy name-present path per decision 3);
   (c) reframe `README.md` privacy notes and update `PROJECT_STATE.md` §6.3 per
   the doc conditions below.

## Provenance
`[decided]` = user chose it. `[proposed]` = suggested. `[assumed]` = unverified.
- [decided] Keep the free-text feature; mitigation = guidance + warn-only
  client-side highlight + confirm-before-send preview.
- [decided] Move current-pupil name redaction **and** the placeholder swap-back
  client-side, so the name is never transmitted.
- [decided] Doc conditions: describe this as **"a mitigation with an
  accountability trail," NOT "names never reach the model"**; and record the
  **"teachers are expected not to enter another pupil's name"** assumption as the
  explicit basis for accepting the residual risk.
- [decided] Implementation is **not yet authorized**; the plan was shown; the
  three sub-decisions are pending.
- [proposed] All three leans above (preview A, trail A, legacy A).
- [assumed] "servers up" and "69 tests" reflect the receiver's current state —
  cheap to re-check with the commands above; `README.md` is still in its
  original wording (the doc reframing is part of unstarted implementation).

**To the receiving session:** investigate and execute yourself; do not hand the
user a list to relay. Treat *Established* as claims worth a cheap spot-check,
*Ruled out* as settled unless your evidence contradicts it, and the three
*[proposed]* leans as exactly that — ask before building on them.
