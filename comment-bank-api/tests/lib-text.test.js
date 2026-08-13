import { describe, it, expect } from 'vitest';

import * as text from '../src/lib/text.js';
import * as reportImport from '../src/services/reportImport.js';

// Characterisation tests for the shared text helpers, written BEFORE they were
// moved into src/lib/text.js and run against both copies at once.
//
// `cleanText`, `isTargetPlaceholderComment` and `TARGET_PLACEHOLDER_COMMENT` were
// defined twice — in src/routes/index.js and src/services/reportImport.js. Two
// copies of a text-normalisation helper on the pupil-data path can drift without
// anything noticing, which is the reason for the move (§6.1,
// docs/NEXT-MILESTONE.md step 2).
//
// They HAD drifted, by exactly one `String()`. The difference and how it was
// resolved are in docs/PROJECT_STATE.md §6.23. The point of these tests is that
// the move could not quietly change behaviour without one of them going red —
// and one did, deliberately, which is the last block in this file.
//
// They import the real module rather than re-typing the implementation, because
// a test asserting against a copy of the code proves the copy behaves as written,
// not that the shipped code does.

const implementations = [['lib/text.js', text]];

describe.each(implementations)('%s — cleanText', (_name, module) => {
  const { cleanText } = module;

  it('collapses runs of whitespace to single spaces and trims', () => {
    expect(cleanText('  a   b \n\t c  ')).toBe('a b c');
  });

  it('returns an empty string for every falsy input', () => {
    // The `text ? … : ''` guard, which is why null and undefined do not throw.
    for (const falsy of ['', null, undefined, 0, false, NaN]) {
      expect(cleanText(falsy)).toBe('');
    }
  });

  it('leaves an already-clean string untouched', () => {
    expect(cleanText('Works hard in lessons.')).toBe('Works hard in lessons.');
  });

  it('handles newlines and non-breaking-adjacent whitespace as separators', () => {
    expect(cleanText('one\n\ntwo\tthree')).toBe('one two three');
  });
});

describe.each(implementations)('%s — isTargetPlaceholderComment', (_name, module) => {
  const { isTargetPlaceholderComment } = module;

  it('matches the placeholder regardless of case or surrounding text', () => {
    expect(isTargetPlaceholderComment('***Generate a target for this pupil and add to the report***')).toBe(true);
    expect(isTargetPlaceholderComment('generate a target for this pupil')).toBe(true);
    expect(isTargetPlaceholderComment('GENERATE A TARGET FOR THIS PUPIL, please')).toBe(true);
  });

  it('does not match ordinary comments', () => {
    expect(isTargetPlaceholderComment('Generate more practice questions')).toBe(false);
    expect(isTargetPlaceholderComment('Works hard')).toBe(false);
  });

  it('coerces rather than throwing on non-strings', () => {
    // Both copies already wrap in String(), which is what the two `cleanText`
    // implementations disagreed about.
    for (const value of [null, undefined, 0, 42, {}, []]) {
      expect(isTargetPlaceholderComment(value)).toBe(false);
    }
  });
});

describe('the placeholder constant has exactly one definition', () => {
  it('is the expected string, and reportImport re-exports the same object', () => {
    expect(text.TARGET_PLACEHOLDER_COMMENT)
      .toBe('***Generate a target for this pupil and add to the report***');
    // reportImport re-exports it, so its public surface is unchanged for callers.
    expect(reportImport.TARGET_PLACEHOLDER_COMMENT).toBe(text.TARGET_PLACEHOLDER_COMMENT);
  });
});

describe('the cleanText divergence, resolved', () => {
  // Before 2026-08-13 there were two copies and they disagreed:
  //
  //   routes/index.js        (text ? text.replace(…) : '')          -> THREW
  //   services/reportImport  (text ? String(text).replace(…) : '')  -> coerced
  //
  // The previous version of this file asserted that divergence, green, so that
  // the move would turn it red rather than absorb it silently. It did. This block
  // replaces it — the resolution, not a relaxation.
  //
  // Unified on coercion. Recorded honestly: that makes the routes path WORSE in
  // one way. `{"name": {"a":1}}` used to 500; it now stores a category called
  // "[object Object]". A loud failure became a quiet one. The right fix is a 400
  // at the request boundary, which is validation rather than de-duplication, and
  // is backlogged with this reproduction rather than smuggled in under a refactor.
  it.each([[42, '42'], [['x', 'y'], 'x,y'], [true, 'true'], [{ a: 1 }, '[object Object]']])(
    'coerces %o to %s instead of throwing',
    (value, expected) => {
      expect(text.cleanText(value)).toBe(expected);
    }
  );
});
