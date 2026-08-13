// Saving a subject's configuration is two independent writes: the prompt
// (`/api/prompts`) and the subject context (`/api/subject-context`). There is no
// transaction across them, and there cannot be without a new endpoint — so the
// partial-success case is real and has to be *reported* accurately rather than
// wished away.
//
// This lived as an inline <script> in manage_subjects_years.html until
// 2026-08-13, which made it untestable: a test cannot import a <script> block.
// That was a concrete, named cost of the inline-script debt (PROJECT_STATE §6.4)
// — the CSP unlock and the testability unlock are the same piece of work.
//
// Extracted here as a pure function over an injected `fetch`, so the partial
// failure can be driven in a test instead of only reasoned about.

/** A response body may be JSON with a `message`, or plain text, or empty. */
export async function parseResponseMessage(response) {
  const text = await response.text();
  try {
    const payload = JSON.parse(text);
    return payload.message || text;
  } catch {
    return text;
  }
}

/**
 * Decide whether the prompt is being created or replaced.
 *
 * Kept as its own step because it is a *third* request, and a failure here means
 * neither write was attempted — which is the one case where "nothing was saved"
 * is the honest thing to tell the teacher.
 */
const resolvePromptTarget = async (fetchImpl, subjectId, yearGroupId) => {
  const checkResponse = await fetchImpl(`/api/prompts/${subjectId}/${yearGroupId}`);
  const existingPrompt = await checkResponse.json();

  return existingPrompt && existingPrompt !== ''
    ? { method: 'PUT', url: `/api/prompts/${subjectId}/${yearGroupId}` }
    : { method: 'POST', url: '/api/prompts' };
};

const postJson = (fetchImpl, url, method, body) => fetchImpl(url, {
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

/**
 * Save both halves and report what actually happened to each.
 *
 * Returns `{ ok, promptSaved, contextSaved, message, tone }`. The two `*Saved`
 * flags are the point: the caller must be able to tell "nothing was saved" from
 * "the prompt was saved and the context was not", because those need different
 * things from the teacher and the old code showed the same error for both.
 */
export async function saveSubjectConfig(values, { fetchImpl } = {}) {
  const doFetch = fetchImpl || fetch;
  const { subjectId, yearGroupId, promptPart, subjectDescription, wordLimit } = values;

  const target = await resolvePromptTarget(doFetch, subjectId, yearGroupId);

  const promptResponse = await postJson(doFetch, target.url, target.method, {
    subjectId,
    yearGroupId,
    promptPart
  });

  const contextResponse = await postJson(doFetch, '/api/subject-context', 'POST', {
    subjectId,
    yearGroupId,
    subjectDescription,
    wordLimit
  });

  const promptSaved = promptResponse.ok;
  const contextSaved = contextResponse.ok;

  if (promptSaved && contextSaved) {
    return {
      ok: true,
      promptSaved,
      contextSaved,
      message: 'Prompt and subject context saved.',
      tone: 'success'
    };
  }

  // The partial cases are named individually and say plainly what IS stored.
  // Before 2026-08-13 both of these produced the failing half's error message
  // alone, so a teacher whose prompt had just changed was told only that
  // something went wrong — and the prompt drives every generated report.
  if (promptSaved && !contextSaved) {
    const detail = await parseResponseMessage(contextResponse);
    return {
      ok: false,
      promptSaved,
      contextSaved,
      message: `The prompt was saved, but the subject description and word limit were not: ${detail || 'the server rejected them.'} Your prompt has changed — reload to see what is stored.`,
      tone: 'warning'
    };
  }

  if (!promptSaved && contextSaved) {
    const detail = await parseResponseMessage(promptResponse);
    return {
      ok: false,
      promptSaved,
      contextSaved,
      message: `The subject description and word limit were saved, but the prompt was not: ${detail || 'the server rejected it.'} The prompt still has its previous value.`,
      tone: 'warning'
    };
  }

  const detail = await parseResponseMessage(promptResponse);
  return {
    ok: false,
    promptSaved,
    contextSaved,
    message: detail || 'Error saving prompt.',
    tone: 'error'
  };
}

if (typeof window !== 'undefined') {
  window.ReportGenSubjectConfig = { saveSubjectConfig, parseResponseMessage };
}
