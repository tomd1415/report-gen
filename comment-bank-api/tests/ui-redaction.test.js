// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  redactPupilName,
  restorePupilName,
  findSuspectNames,
  summariseSuspectNames,
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

describe('client-side redactPupilName — adjacent occurrences (regression, 2026-08-06)', () => {
  // These all leaked before the fix. The trailing word boundary used to be a
  // captured group, which /g consumes, so the delimiter that should have opened
  // the *next* match had already been eaten. The symptom is the worst kind:
  // redaction silently half-works and the output still looks redacted.
  const leaks = (text, name) => {
    const out = redactPupilName(text, name);
    return name.split(' ').some((part) => new RegExp(`\\b${part}\\b`, 'i').test(out));
  };

  it('redacts a name repeated with a single space between', () => {
    expect(redactPupilName('Alex Alex worked hard.', 'Alex'))
      .toBe('PUPIL_NAME PUPIL_NAME worked hard.');
  });

  it('redacts three adjacent repeats, not just the first and last', () => {
    expect(redactPupilName('Alex Alex Alex.', 'Alex'))
      .toBe('PUPIL_NAME PUPIL_NAME PUPIL_NAME.');
  });

  it('redacts a name repeated across a hyphen', () => {
    expect(redactPupilName('Alex-Alex', 'Alex')).toBe('PUPIL_NAME-PUPIL_NAME');
  });

  it('redacts a name repeated across a newline (collapsed to a space first)', () => {
    expect(redactPupilName('Alex\nAlex', 'Alex')).toBe('PUPIL_NAME PUPIL_NAME');
  });

  it('leaks nothing for any adjacent-delimiter combination', () => {
    for (const delimiter of [' ', '-', '\t', '\n', ',', '.', '/', '(', ')']) {
      expect(leaks(`Alex${delimiter}Alex`, 'Alex')).toBe(false);
    }
  });

  it('still leaves non-matching words alone', () => {
    // The fix must not make the match greedier: 'Alexandra' is a different name
    // and must not be partially redacted.
    expect(redactPupilName('Alexandra and Alex are different.', 'Alex'))
      .toBe('Alexandra and PUPIL_NAME are different.');
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

describe('summariseSuspectNames (warn-only, for the import page)', () => {
  it('returns each suspect once with a count and a snippet', () => {
    const text = 'Worked well with Jordan. Later Jordan helped again. Also Priya joined.';
    const result = summariseSuspectNames(text);

    expect(result.map((entry) => entry.name)).toEqual(['Jordan', 'Priya']);
    expect(result[0].count).toBe(2);
    expect(result[1].count).toBe(1);
    expect(result[0].snippet).toContain('Jordan');
  });

  it('orders by frequency, because a name repeated through a batch is the likelier pupil', () => {
    const text = 'She studied Newton. Then Sam spoke. Sam listened. Sam improved. Sam finished.';
    const result = summariseSuspectNames(text);

    expect(result[0].name).toBe('Sam');
    expect(result[0].count).toBe(4);
    expect(result.map((entry) => entry.name)).toContain('Newton');
  });

  it('takes the snippet from the FIRST occurrence, so a repeated name cannot bury the others', () => {
    const text = 'Opening line about Kai here. ' + 'Kai again. '.repeat(30) + 'And Priya once.';
    const result = summariseSuspectNames(text);

    expect(result.filter((entry) => entry.name === 'Kai')).toHaveLength(1);
    expect(result[0].snippet).toContain('Opening line about Kai here');
    expect(result.map((entry) => entry.name)).toContain('Priya');
  });

  it('honours the ignore list', () => {
    const text = 'Worked with Jordan and Priya today.';
    expect(summariseSuspectNames(text, { ignore: ['Jordan'] }).map((e) => e.name)).toEqual(['Priya']);
  });

  it('returns nothing for empty or clean text', () => {
    expect(summariseSuspectNames('')).toEqual([]);
    expect(summariseSuspectNames(null)).toEqual([]);
    expect(summariseSuspectNames('all lowercase text with no names')).toEqual([]);
  });

  it('agrees with findSuspectNames about WHICH words are suspect', () => {
    // The two must not drift: the summary is the thing the teacher acts on, and
    // the inline warning is driven by the same set.
    const text = 'A note about Jordan, Newton and Priya in the lesson.';
    expect(summariseSuspectNames(text).map((e) => e.name).sort())
      .toEqual(findSuspectNames(text).sort());
  });

  it('stays fast on a realistic 60k-character paste', () => {
    // LIMITS.reports caps the paste at 60000 characters; the highlighter runs on
    // every keystroke, so this must not be quadratic.
    //
    // MEASURED 2026-08-08 on this box: 63k chars took 80 ms cold, then 14-27 ms
    // warm. The 1000 ms bound below is therefore ~40x looser than reality, and
    // deliberately so — it is sized to catch a quadratic blow-up (which would be
    // seconds), not a 2x regression, because this host's load average reaches
    // 20-38 and a tight timing assertion would flake constantly. Recording the
    // real figure so a future reader can tell a genuine slowdown from normal:
    // if this ever takes 200 ms warm, something has changed even though the
    // assertion still passes.
    const text = 'PUPIL_NAME worked hard with Jordan this term. '.repeat(1300);
    expect(text.length).toBeGreaterThan(55000);

    const started = Date.now();
    const result = summariseSuspectNames(text);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(result.map((entry) => entry.name)).toEqual(['Jordan']);
  });
});
