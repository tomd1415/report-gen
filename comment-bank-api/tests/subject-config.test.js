import { describe, it, expect, vi } from 'vitest';
import { saveSubjectConfig } from '../public/subject-config.js';

// Saving a subject's configuration is two independent writes with no transaction
// across them: `/api/prompts` then `/api/subject-context`. The partial-success
// case is therefore real, and until 2026-08-13 it was reported as a flat failure
// — the teacher was shown the *context* error and nothing else, while the prompt
// had already changed.
//
// Why that is not a cosmetic bug: the prompt is the instruction that drives every
// report generated for that subject and year group. A teacher told "error" either
// retries (harmless) or gives up believing nothing was saved (not harmless — the
// prompt is now different from what they think it is, and nothing on the page
// says so). The visible state and the stored state disagree, silently.
//
// These tests assert the reported message against **what was actually stored**,
// which is the only framing that catches it. Asserting "an error was shown" would
// have passed against the old code.

const jsonResponse = (ok, body = {}) => ({
  ok,
  json: async () => body,
  text: async () => JSON.stringify(body)
});

/**
 * @param {object} opts
 * @param {boolean} opts.promptOk    did /api/prompts succeed
 * @param {boolean} opts.contextOk   did /api/subject-context succeed
 * @param {boolean} opts.promptExists does a prompt already exist (PUT vs POST)
 */
const fetchStub = ({ promptOk = true, contextOk = true, promptExists = true } = {}) => {
  const calls = [];
  const impl = vi.fn(async (url, options) => {
    calls.push({ url, method: options?.method ?? 'GET', body: options?.body });

    if (!options) {
      // The existence check. Its own request, and a third failure mode.
      return jsonResponse(true, promptExists ? { promptPart: 'existing' } : '');
    }
    if (url.startsWith('/api/prompts')) {
      return jsonResponse(promptOk, promptOk ? { ok: true } : { message: 'Prompt too long.' });
    }
    return jsonResponse(contextOk, contextOk ? { ok: true } : { message: 'Word limit must be a number.' });
  });
  return { impl, calls };
};

const values = {
  subjectId: '1',
  yearGroupId: '2',
  promptPart: 'Write warmly.',
  subjectDescription: 'Mathematics',
  wordLimit: '140'
};

describe('saving a subject configuration', () => {
  it('reports success when both writes succeed', async () => {
    // The control. Without it the assertions below would still pass if the
    // function simply reported failure for everything.
    const { impl } = fetchStub({});
    const result = await saveSubjectConfig(values, { fetchImpl: impl });

    expect(result.ok).toBe(true);
    expect(result.promptSaved).toBe(true);
    expect(result.contextSaved).toBe(true);
    expect(result.message).toMatch(/saved/i);
  });

  it('says the prompt WAS saved when only the context write fails', async () => {
    // The defect. Against the pre-2026-08-13 code this fails: the message was
    // the context error alone, so the one fact the teacher most needed — that
    // their prompt had already changed — was the one thing not said.
    const { impl } = fetchStub({ contextOk: false });
    const result = await saveSubjectConfig(values, { fetchImpl: impl });

    expect(result.ok).toBe(false);
    expect(result.promptSaved).toBe(true);
    expect(result.contextSaved).toBe(false);

    // Asserted against what was stored, not against "some error appeared".
    expect(result.message).toMatch(/prompt was saved/i);
    expect(result.message).toMatch(/word limit must be a number/i);
  });

  it('says the prompt was NOT saved when only the prompt write fails', async () => {
    const { impl } = fetchStub({ promptOk: false });
    const result = await saveSubjectConfig(values, { fetchImpl: impl });

    expect(result.promptSaved).toBe(false);
    expect(result.contextSaved).toBe(true);
    expect(result.message).toMatch(/prompt was not/i);
    expect(result.message).toMatch(/previous value/i);
  });

  it('reports a plain failure when neither write succeeds', async () => {
    const { impl } = fetchStub({ promptOk: false, contextOk: false });
    const result = await saveSubjectConfig(values, { fetchImpl: impl });

    expect(result.promptSaved).toBe(false);
    expect(result.contextSaved).toBe(false);
    // Nothing changed, so "nothing was saved" is the honest message here — and
    // this is the only case where it is.
    expect(result.message).not.toMatch(/was saved/i);
  });

  it('creates a prompt with POST when none exists, and replaces with PUT when one does', async () => {
    // Pinned because the extraction moved this decision, and getting it wrong
    // would either duplicate a prompt or silently fail to create one.
    const missing = fetchStub({ promptExists: false });
    await saveSubjectConfig(values, { fetchImpl: missing.impl });
    expect(missing.calls[1]).toMatchObject({ url: '/api/prompts', method: 'POST' });

    const existing = fetchStub({ promptExists: true });
    await saveSubjectConfig(values, { fetchImpl: existing.impl });
    expect(existing.calls[1]).toMatchObject({ url: '/api/prompts/1/2', method: 'PUT' });
  });
});
