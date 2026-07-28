# Project notes

## Free-text privacy framing (load-bearing — do not soften)
The free-text mitigation is **"a mitigation with an accountability trail," not
"names never reach the model."** The current pupil's name is redacted in the
browser and never transmitted; *other* pupils' names cannot be auto-redacted (no
roster is held, by design) and are handled by guidance + a **warn-only**
highlighter + a confirm-before-send preview. The explicit basis for accepting the
residual risk is that **teachers are expected not to enter another pupil's name**.
Detail: `docs/REDACTION-DECISIONS.md`, `docs/PROJECT_STATE.md` §6.3.1.
