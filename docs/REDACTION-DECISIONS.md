# Redaction plan — the three parked decisions

> **Status: all three settled on 2026-07-29, each in favour of the lean below,
> and implemented.** See the *Outcome* section at the foot of this document for
> what was built and where. The analysis is kept as the record of why.

## Context (so each decision stands on its own)

The report generator lets a teacher add two **free-text** fields — "additional
comments" and "strength focus" — which get sent to the AI model along with the
selected bank comments. The privacy rule is that pupil names must not reach the
model.

We've agreed a plan (not yet built) with two parts:

1. Move the redaction of *the current pupil's own name* into the browser so it is
   never transmitted at all.
2. For *other* pupils' names a teacher might type into the free-text, add three
   layers — on-screen guidance, a warn-only client-side highlighter that flags
   suspect words, and a preview the teacher must confirm before anything is sent.

The three decisions below are details within that plan where work stopped to get
a call. The stated basis for the whole approach is that a warning is
**proportionate**, because teachers are expected never to put another pupil's
name in a report; that expectation is the explicit basis for accepting the
residual risk.

---

## Decision 1 — The preview trigger

**What the decision is:** When should the "here's exactly what will be sent —
confirm before sending" preview actually appear? Every time the teacher clicks
Generate, or only sometimes?

**The realistic options:**

- **(A) Only when there is free-text to review.** If the "additional comments"
  box is empty and no strength-focus rows were added, there's nothing un-vetted —
  the only other content is the bank comments, which are already redacted at
  import. So in that case, skip the preview and send straight away. Show the
  preview only when at least one free-text field has content.

  > **The premise of this option no longer holds (noted 2026-08-12).** "The bank
  > comments are already redacted at import" was true when this was written on
  > 2026-07-29. The import-time name substitution was removed on 2026-08-06 by a
  > later owner decision, so comments imported after that date enter the bank as
  > the AI extracted them from the pasted reports. The reasoning below is left as
  > written because it is the record of why 1(A) was chosen — but **the "nothing
  > un-vetted" claim it rests on is now weaker than it was**, and a report with no
  > free text is sent with no confirm step at all. Whether that changes the
  > decision is the owner's call; it is recorded in `PROJECT_STATE.md` §6.18 and
  > has not been changed unilaterally.
- **(B) On every send, unconditionally.** The preview appears each time, even when
  both free-text fields are empty.

**What each would and would not catch:**

- Both options catch exactly the same *leaks*, because the only place an un-vetted
  pupil name can enter is the free-text. When the free-text is empty there is
  nothing for a preview to catch — so (A) skips the preview precisely in the cases
  where it would show the teacher nothing actionable.
- The real difference is friction versus habit. (B) makes the confirm step appear
  constantly, including on empty-free-text reports where it's pure ceremony. The
  predictable result is habituation: teachers learn the dialog is usually empty
  and start clicking through it reflexively — which quietly erodes the value of
  the confirm even on the reports that *do* contain free-text. (A) makes the
  preview appear only when it carries real content, so when it does show up it
  means something.
- The cost of (A) is a small bit of conditional logic ("is there free-text?") and
  the fact that a report with no free-text gets no explicit "nothing to review"
  moment — which is arguably fine, because there genuinely is nothing to review.

**Which way I lean and why:** **(A), only when free-text is present.** It catches
every case (B) would, and by not crying wolf on empty reports it keeps the
confirm meaningful rather than training people to dismiss it. This also matches
the stated basis for the approach — that a warning is *proportionate* — and a
warning that fires when there's nothing to warn about isn't proportionate.

---

## Decision 2 — The accountability trail

**What the decision is:** This whole approach was described as "a mitigation with
an accountability trail." This decision is what "trail" concretely means: is it
just the in-the-moment confirmation, or do we also *store a record* that the
confirmation happened?

**The realistic options:**

- **(A) Interaction-only.** The teacher is shown the literal text that will be
  sent and must actively click to confirm. That informed sign-off *is* the
  accountability: responsibility is explicit and sits with the person who saw the
  payload and approved it. Nothing is written to the database. This is consistent
  with the project's existing policy of not storing report text.
- **(B) Interaction plus a stored metadata record.** Same confirm step, but
  additionally write a small row to the database each time — for example: which
  user confirmed, a timestamp, and a boolean that they confirmed. Explicitly **no
  report content, no free-text, no pupil data** — just the fact that user X
  confirmed a send at time T.

**What each would and would not catch:**

- Neither option changes what *reaches the model* — this decision is not about
  prevention at all. Both sit downstream of the actual leak-stopping (the
  redaction and the highlighter). So "catch" here means "what could you later
  prove or review," not "what leak is blocked."
- (A) leaves **no after-the-fact record**. If someone later asks "did a teacher
  send free-text on this report, and did they confirm it?", you cannot answer from
  data — only from the fact that the system structurally requires a confirm. There
  is nothing to audit, and nothing to leak from an audit table.
- (B) gives you a genuine, reviewable log: you could later show that confirmations
  were happening, count them, or spot a user who somehow bypassed the step. What
  it would **not** give you is any insight into *what* was sent (deliberately — no
  content is stored), so it can't tell you whether a name actually slipped; it
  only records that a human approved a send. It's also a new thing to store, back
  up, and reason about under data protection — even name-free metadata is a small
  ongoing data-retention commitment, and it mirrors exactly the "should we add an
  ImportJobs audit table?" question that's already sitting unresolved in the
  backlog for the admin-import feature.

**Which way I lean and why:** **(A), interaction-only** — for now. It delivers the
accountability asked for (informed, attributable sign-off on the exact payload) at
zero storage and zero new data-protection surface, and it fits the existing
"don't persist report text" stance. (B) only earns its keep if you actually need
to *demonstrate to a third party* — an auditor, a DPO, an incident review — that
confirmations occur, and even then it proves only that a click happened, not that
data was clean. Keep (B) as a deliberate, separate decision to take later
alongside the ImportJobs audit-table question, rather than fold it in now. The one
thing to be careful about in the docs either way: "trail" must be described
honestly as *informed confirmation*, not as a stored audit log, unless (B) is
chosen.

---

## Decision 3 — The legacy name branch

**What the decision is:** Part (1) of the plan changes how the browser and server
talk to each other. Today the browser sends the pupil's real name to the server,
the server builds the AI prompt with a `PUPIL_NAME` placeholder, and after the AI
responds the server swaps the placeholder back to the real name before returning
the report. Under the new design the browser never sends the name at all: it does
the placeholder-swap itself, both before sending (redacting) and after receiving
(restoring). The question is whether the server should **still support the old
way** as well as the new way, or be switched over completely.

**The realistic options:**

- **(A) Keep both paths (backward-compatible).** The server accepts requests with
  a name (old behaviour: it redacts and swaps back server-side, exactly as today)
  *and* requests without a name (new behaviour: it returns the report still
  containing the `PUPIL_NAME` placeholder, and trusts the browser to have redacted
  on the way in and to restore on the way out). The browser is updated to use the
  new, name-free path; the old path simply remains available.
- **(B) Hard cut-over.** Remove the old behaviour entirely. The server no longer
  accepts or handles a name; there is exactly one code path, the name-free one,
  and everything — server, browser, tests — is switched in a single change.

**What each would and would not catch:**

- On the *privacy goal* both are equivalent once the browser is updated: in normal
  use the name is never transmitted either way, because the shipped browser uses
  the name-free path in both options.
- The difference is failure modes during and after the switch. With **(A)**, if
  anything still sends a name — a browser tab left open on the old page, a cached
  script, some other caller, a mistake in the new client code — the server handles
  it safely and correctly (redacts, swaps back) instead of breaking. The cost is
  that the server keeps a second code path that, in principle, *can* still receive
  a name, so "the name is never sent" is guaranteed by the client's behaviour
  rather than enforced by the server refusing to accept one. It's more resilient
  but slightly less absolute.
- With **(B)**, the guarantee is stronger and cleaner: the server has no way to
  accept a name, so there's only one behaviour to reason about and test, and no
  lingering path that transmits a name. The cost is brittleness at the moment of
  change — any stale client or missed caller doesn't degrade gracefully, it fails
  — and it's a bigger, all-at-once edit with a larger blast radius if something's
  wrong. There's no safety net while the change lands.
- Worth being honest about one subtlety that applies to **both**: moving redaction
  into the browser means the server can no longer independently double-check that
  the current pupil's name is absent from the free-text. In the old design the
  server did that redaction itself; now it can't, because it deliberately never
  sees the name. So correctness of the current-pupil redaction rests entirely on
  the browser code (which is why that code needs solid unit tests). (A) doesn't
  restore that server-side double-check for the new path — it only means the *old*
  path still exists as a fallback.

**Which way I lean and why:** **(A), keep both paths** — but treat it as a
migration stage, not a permanent state. Keeping the old path means the change
lands safely: nothing breaks if a client is stale, and all the existing server
tests continue to pass unchanged, so the new work is purely additive and low-risk
to review. Once the new browser path is confirmed working in real use, retiring
the legacy path becomes a small, safe follow-up (essentially option B, done later
with confidence) rather than a risky big-bang now. This also matches the project's
stated safety rules, which favour additive, reversible changes over rewrites. The
trade-off being accepted is that, until that follow-up, the server technically
still *can* accept a name — which is fine precisely because the shipped client
never sends one.

---

## Summary of leans

- **Preview trigger** — show it only when there's free-text to review.
- **Accountability trail** — informed confirmation with nothing stored.
- **Legacy name branch** — keep the old path temporarily as a safe migration,
  retire it later.

All three leans favour proportionality and low-risk, reversible change over
maximum strictness, which matches the basis set for this work.

---

## Outcome (2026-07-29)

All three decisions were taken as leaned — **1(A)**, **2(A)**, **3(A)** — and the
plan was implemented.

**Client-side redaction (`comment-bank-api/public/report-selection.js`)**
- `redactPupilName(text, name)` — mirrors the server helper of the same name;
  replaces the full name and each part, case-insensitively and word-bounded.
- `restorePupilName(text, name)` — swaps `PUPIL_NAME` back after the response.
- `findSuspectNames(text, { ignore })` — **warn-only** heuristic returning
  capitalised mid-sentence words that might be another pupil's name. It never
  drives redaction: *Newton* and a pupil called *Newton* are indistinguishable.
- 21 unit tests in `comment-bank-api/tests/ui-redaction.test.js`. These matter
  more than usual, because moving redaction into the browser means the server
  can no longer double-check it (see §3 above).

**UI (`comment-bank-api/public/index.html`, `public/styles.css`)**
- Guidance text under both free-text fields.
- Confirm-before-send preview (`#send-preview-modal`) showing the exact redacted
  free text, with suspect words underlined and listed. Per **1(A)** it appears
  only when at least one free-text field has content.
- The gate keys on a signature of the confirmed text, so a retry or "generate
  anyway" with unchanged text does not re-prompt, but any edit does.
- Per **2(A)** nothing is written to the database; the signature is in-memory
  only and is cleared after a successful report.

**Server (`comment-bank-api/src/routes/index.js`)** — migration completed
- Stage 1 (3(A), 2026-07-29): the route accepted both a name-present and a
  name-free request, so the change landed without breaking stale clients.
- Stage 2 (the follow-up 3(A) left open, **done 2026-07-30** once the name-free
  client was verified end to end in a real browser): the legacy path is retired.
  The route now **rejects** any request carrying a name with a 400 and
  "reload the page", rather than ignoring it — a stale client then fails loudly
  and gets fixed, instead of quietly transmitting a name the server discards.
  The server-side `redactPupilName` helper is gone; with no name to match
  against it could do nothing, and redaction now lives solely in the browser.

This is effectively option **(B)** arrived at safely, exactly as 3(A) intended:
one code path, no lingering branch that can receive a name.

**What the migration actually cost**, recorded because the §3 analysis
under-predicted it: 3(A) claimed existing server tests would pass untouched.
They did not. Stage 1 broke one test (`rejects missing name or pronouns`, which
asserted the contract being changed). Stage 2 broke twelve more, because nearly
every `/generate-report` test sent `name: 'Alex'` — the "bigger, all-at-once
edit with a larger blast radius" that §3 attributed to option (B) turned up in
stage 2 regardless. Splitting the change into two stages made it *safer to
land*, not *smaller overall*. The two server-side redaction tests were replaced
by one asserting a transmitted name is refused, and one asserting
browser-redacted free text reaches both prompts unchanged.

**Not done, deliberately:** decision 2(B)'s stored metadata row. It remains a
separate decision to take alongside the unresolved ImportJobs audit-table
question in the backlog.

---

## The import path — a different answer (2026-08-06/07)

Everything above concerns **report generation**. The **import** path was settled
separately and more strictly, and this section exists because `CLAUDE.md` cites
this document as the detail behind the project's privacy framing — so it must not
leave a reader thinking generation is the whole story.

The import pages used to take a `pupilNames` list from the teacher and substitute
each name server-side. Two defects were found in it (`PROJECT_STATE.md` §6.3.2),
and rather than improve the matching the owner **overruled the options offered**:
teachers should not be entering pupil names at all, and no pupil-name list should
be held server-side. So:

- The `pupilNames` field is gone from both import pages, the payloads, the routes
  and `reportImport.js`. **Pasted report text now reaches the model as typed** —
  there is no substitution on this path.
- Both import pages carry the guidance, the **warn-only** suspect-name
  highlighter and the confirm-before-send preview that generation already had, so
  the instruction has something backing it. The helpers fail closed: if
  `report-selection.js` does not load, the send is blocked rather than allowed.

The residual risk is stated plainly in `PROJECT_STATE.md` §6.3.2 and is not
softened here: **this reduces the surface rather than guaranteeing no name ever
appears in pasted text.** The highlighter is a heuristic — *Newton* the physicist
and *Newton* the pupil are indistinguishable — so **no warning appearing does not
mean no name is present**. The accepted basis is unchanged from the top of this
document: teachers are expected not to enter another pupil's name.
