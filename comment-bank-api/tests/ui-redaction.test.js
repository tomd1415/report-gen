// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  redactPupilName,
  restorePupilName,
  findSuspectNames,
  PUPIL_NAME_PLACEHOLDER
} from '../public/report-selection.js';

describe('client-side redactPupilName', () => {
  it('replaces the full name and each of its parts', () => {
    const result = redactPupilName('Alice Smith works hard. Alice is kind and Smith listens.', 'Alice Smith');
    expect(result).not.toMatch(/Alice/);
    expect(result).not.toMatch(/Smith/);
    expect(result).toContain(PUPIL_NAME_PLACEHOLDER);
  });

  it('is case-insensitive', () => {
    expect(redactPupilName('alice tried, ALICE succeeded', 'Alice')).toBe(
      `${PUPIL_NAME_PLACEHOLDER} tried, ${PUPIL_NAME_PLACEHOLDER} succeeded`
    );
  });

  it('only matches whole words, so substrings survive', () => {
    expect(redactPupilName('Alicia and Smithson are unrelated', 'Alice Smith')).toBe(
      'Alicia and Smithson are unrelated'
    );
  });

  it('redacts names adjacent to punctuation', () => {
    expect(redactPupilName('Well done, Alice!', 'Alice')).toBe(`Well done, ${PUPIL_NAME_PLACEHOLDER}!`);
  });

  it('ignores single-character name parts', () => {
    const result = redactPupilName('J was on task', 'J Smith');
    expect(result).toBe('J was on task');
  });

  it('escapes regex metacharacters in the name', () => {
    expect(redactPupilName('A.B. did well', 'A.B.')).toContain(PUPIL_NAME_PLACEHOLDER);
    expect(() => redactPupilName('text', 'O(Brien')).not.toThrow();
  });

  it('returns cleaned text when there is no name or no text', () => {
    expect(redactPupilName('  spaced   out  ', '')).toBe('spaced out');
    expect(redactPupilName('', 'Alice')).toBe('');
  });

  it('matches the server helper for the same inputs', () => {
    // Parity guard: the server-side helper in src/routes/index.js is the
    // reference implementation; this mirrors its documented behaviour.
    expect(redactPupilName('Alice Smith and Alice', 'Alice Smith')).toBe(
      `${PUPIL_NAME_PLACEHOLDER} and ${PUPIL_NAME_PLACEHOLDER}`
    );
  });
});

describe('restorePupilName', () => {
  it('swaps every placeholder back to the real name', () => {
    const redacted = `${PUPIL_NAME_PLACEHOLDER} has worked hard. ${PUPIL_NAME_PLACEHOLDER} should keep going.`;
    expect(restorePupilName(redacted, 'Alice')).toBe('Alice has worked hard. Alice should keep going.');
  });

  it('round-trips with redactPupilName', () => {
    const original = 'Alice made progress this term.';
    expect(restorePupilName(redactPupilName(original, 'Alice'), 'Alice')).toBe(original);
  });

  it('leaves text untouched when the name is missing', () => {
    expect(restorePupilName(`${PUPIL_NAME_PLACEHOLDER} did well`, '')).toBe(`${PUPIL_NAME_PLACEHOLDER} did well`);
  });

  it('handles empty input', () => {
    expect(restorePupilName('', 'Alice')).toBe('');
  });
});

describe('findSuspectNames (warn-only)', () => {
  it('flags a mid-sentence capitalised word', () => {
    expect(findSuspectNames('He works well alongside Jordan in lessons.')).toEqual(['Jordan']);
  });

  it('does not flag the first word of a sentence', () => {
    expect(findSuspectNames('Jordan is a topic we studied.')).toEqual([]);
    expect(findSuspectNames('She did well. Progress is good.')).toEqual([]);
  });

  it('does not flag acronyms', () => {
    expect(findSuspectNames('Her work in ICT and GCSE PE is strong.')).toEqual([]);
  });

  it('does not flag common non-name capitals', () => {
    expect(findSuspectNames('Work in English improved during Autumn term on Monday.')).toEqual([]);
  });

  it('ignores words the caller asks it to ignore', () => {
    expect(findSuspectNames('Good work from Alice Smith today.', { ignore: ['Alice Smith'] })).toEqual([]);
  });

  it('ignores the placeholder itself', () => {
    expect(findSuspectNames(`Great effort from ${PUPIL_NAME_PLACEHOLDER} this term.`)).toEqual([]);
  });

  it('deduplicates repeated suspects', () => {
    expect(findSuspectNames('Works with Jordan, and Jordan helps back.')).toEqual(['Jordan']);
  });

  it('still flags legitimate proper nouns, which is why it is warn-only', () => {
    // Newton is a real topic, not a pupil. The heuristic cannot tell them
    // apart, so it must only warn and never redact automatically.
    expect(findSuspectNames('She understood Newton well.')).toEqual(['Newton']);
  });

  it('returns nothing for empty or lowercase text', () => {
    expect(findSuspectNames('')).toEqual([]);
    expect(findSuspectNames('all lowercase text here')).toEqual([]);
  });
});
