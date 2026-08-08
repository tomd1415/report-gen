export const categoryGroups = [
  {
    key: 'topics',
    label: 'Topics / Knowledge / Skills',
    patterns: [/topic/i, /areas?\s+studied/i, /studied/i, /knowledge/i, /skill/i, /curriculum/i]
  },
  {
    key: 'effort',
    label: 'Effort / Motivation / Attendance',
    patterns: [/effort/i, /motivation/i, /attendance/i, /engagement/i, /participation/i, /attitude/i]
  },
  {
    key: 'strengths',
    label: 'Strengths / Achievements',
    patterns: [/strength/i, /achievement/i, /success/i, /progress/i, /attainment/i]
  },
  {
    key: 'development',
    label: 'Areas for Development / Targets',
    patterns: [/development/i, /target/i, /improve/i, /next step/i, /progression/i]
  }
];

export const matchCategoryGroup = (name) => {
  if (!name) {
    return null;
  }
  const lowered = name.toLowerCase();
  if (/general|other/i.test(lowered)) {
    return null;
  }
  for (const group of categoryGroups) {
    if (group.patterns.some((pattern) => pattern.test(lowered))) {
      return group.key;
    }
  }
  return null;
};

export const collectSelections = (container) => {
  const categorySections = Array.from(container?.querySelectorAll('.comment-category') || []);
  const selections = {};
  const availableGroups = {
    topics: false,
    effort: false,
    strengths: false,
    development: false
  };
  const selectedGroups = {
    topics: false,
    effort: false,
    strengths: false,
    development: false
  };

  categorySections.forEach(section => {
    const categoryName = section.dataset.categoryName || '';
    const checked = Array.from(section.querySelectorAll('input[type="checkbox"]:checked'))
      .map(input => input.value)
      .filter(Boolean);

    if (checked.length > 0) {
      selections[categoryName] = checked;
    }

    const groupKey = matchCategoryGroup(categoryName);
    if (groupKey) {
      availableGroups[groupKey] = true;
      if (checked.length > 0) {
        selectedGroups[groupKey] = true;
      }
    }
  });

  const missingGroups = categoryGroups
    .filter(group => availableGroups[group.key] && !selectedGroups[group.key])
    .map(group => group.label);

  return { selections, missingGroups };
};

export const PUPIL_NAME_PLACEHOLDER = 'PUPIL_NAME';

const cleanText = (text) => (text ? String(text).replace(/\s+/g, ' ').trim() : '');
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Mirrors the server-side helper of the same name in src/routes/index.js so the
// current pupil's name is replaced with the placeholder *in the browser* and is
// therefore never transmitted. Redacts the full name and each of its
// whitespace-separated parts (case-insensitively, word-bounded), longest first.
export const redactPupilName = (text, name) => {
  const cleaned = cleanText(text);
  const cleanedName = cleanText(name);
  if (!cleaned || !cleanedName) {
    return cleaned;
  }
  const targets = [...new Set([cleanedName, ...cleanedName.split(' ')])]
    .map((part) => part.trim())
    .filter((part) => part.length >= 2)
    .sort((a, b) => b.length - a.length);
  let result = cleaned;
  targets.forEach((target) => {
    // The trailing boundary is a LOOKAHEAD, not a captured group. A captured
    // `([^\w]|$)` is consumed by the match, so with the /g flag the scan resumes
    // *after* the delimiter and the next occurrence has no preceding boundary
    // left to match against — "Alex Alex" redacted only the first one. A
    // lookahead matches the boundary without consuming it, so the delimiter is
    // still there to open the following match. (Found 2026-08-06. The import
    // path carried the same bug in replacePupilNames; that whole function was
    // removed later the same day with the pupil-name list, so this is now the
    // only copy — do not go looking for the other one.)
    const regex = new RegExp(`(^|[^\\w])${escapeRegex(target)}(?=[^\\w]|$)`, 'gi');
    result = result.replace(regex, (match, prefix) => `${prefix || ''}${PUPIL_NAME_PLACEHOLDER}`);
  });
  return result;
};

// Inverse of redactPupilName, applied to the model's response. The server no
// longer knows the name on the name-free path, so the swap-back happens here.
export const restorePupilName = (text, name) => {
  const cleanedName = cleanText(name);
  if (!text || !cleanedName) {
    return text || '';
  }
  return String(text).replace(new RegExp(escapeRegex(PUPIL_NAME_PLACEHOLDER), 'g'), cleanedName);
};

// Words that are capitalised for reasons other than being a person's name, so
// flagging them would be pure noise. Deliberately short: this is a warn-only
// heuristic and over-flagging is far cheaper than a missed name.
const SUSPECT_STOPWORDS = new Set([
  'i', 'a', 'an', 'the', 'this', 'that', 'these', 'those', 'he', 'she', 'they',
  'him', 'her', 'them', 'his', 'hers', 'their', 'we', 'us', 'our', 'you', 'your',
  'it', 'its', 'and', 'but', 'or', 'so', 'if', 'as', 'at', 'by', 'for', 'from',
  'in', 'into', 'of', 'on', 'to', 'with', 'when', 'while', 'during', 'after',
  'before', 'however', 'although', 'because', 'there', 'here', 'both', 'each',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december', 'autumn', 'spring', 'summer',
  'term', 'year', 'english', 'maths', 'mathematics', 'science', 'history',
  'geography', 'art', 'music', 'pe', 'ict', 'computing', 'gcse', 'ks3', 'ks4',
  'send', 'ta', 'ehcp', 'sen',
  PUPIL_NAME_PLACEHOLDER.toLowerCase()
]);

// WARN-ONLY. Returns capitalised words that *might* be another pupil's name so
// the UI can highlight them for the teacher to check. It must never drive
// automatic redaction: legitimate proper nouns (Newton, the Tudors) look
// identical to a name and auto-redacting them would corrupt the report.
export const findSuspectNames = (text, { ignore = [] } = {}) => {
  const cleaned = cleanText(text);
  if (!cleaned) {
    return [];
  }
  const ignored = new Set(
    ignore
      .flatMap((entry) => cleanText(entry).split(' '))
      .map((part) => part.toLowerCase())
      .filter(Boolean)
  );

  const tokens = cleaned.split(' ');
  const suspects = [];
  const seen = new Set();
  let startsSentence = true;

  tokens.forEach((token) => {
    const word = token.replace(/^[^\p{L}']+|[^\p{L}']+$/gu, '');
    const isSentenceStart = startsSentence;
    // The next token begins a sentence if this one ended with . ! ? or a colon.
    startsSentence = /[.!?:]["')\]]?$/.test(token);

    if (!word || word.length < 2) {
      return;
    }
    const lowered = word.toLowerCase();
    if (!/^\p{Lu}/u.test(word)) {
      return;
    }
    // ALL-CAPS runs are acronyms far more often than names.
    if (word === word.toUpperCase()) {
      return;
    }
    if (SUSPECT_STOPWORDS.has(lowered) || ignored.has(lowered)) {
      return;
    }
    // A capitalised word at the start of a sentence is unremarkable.
    if (isSentenceStart) {
      return;
    }
    if (seen.has(lowered)) {
      return;
    }
    seen.add(lowered);
    suspects.push(word);
  });

  return suspects;
};

// WARN-ONLY, like findSuspectNames, and built on it. Pasted reports run to tens
// of thousands of characters, so showing the whole payload for review — as the
// generation page does with its two short free-text boxes — would be unreadable
// and would train people to click straight through it. This returns each
// suspected name once, with a count and a short surrounding snippet, so the
// teacher reviews a handful of lines instead of a wall of text.
//
// contextWords is the number of words kept either side of the match.
export const summariseSuspectNames = (text, { ignore = [], contextWords = 6 } = {}) => {
  const cleaned = cleanText(text);
  if (!cleaned) {
    return [];
  }
  const suspects = findSuspectNames(cleaned, { ignore });
  if (suspects.length === 0) {
    return [];
  }

  const tokens = cleaned.split(' ');
  const bareWord = (token) => token.replace(/^[^\p{L}']+|[^\p{L}']+$/gu, '');
  const wanted = new Map(suspects.map((word) => [word.toLowerCase(), word]));
  const found = new Map();

  tokens.forEach((token, index) => {
    const key = bareWord(token).toLowerCase();
    if (!key || !wanted.has(key)) {
      return;
    }
    if (!found.has(key)) {
      found.set(key, {
        name: wanted.get(key),
        count: 0,
        // Snippet is taken at the FIRST occurrence only. Showing every one of a
        // name repeated forty times through a batch of reports would bury the
        // other suspects, which is the opposite of what this is for.
        snippet: tokens
          .slice(Math.max(0, index - contextWords), index + contextWords + 1)
          .join(' ')
      });
    }
    found.get(key).count += 1;
  });

  // Most-frequent first: a word appearing repeatedly through a batch of reports
  // is more likely to be a pupil than a one-off proper noun.
  return [...found.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

if (typeof window !== 'undefined') {
  window.ReportSelection = {
    categoryGroups,
    matchCategoryGroup,
    collectSelections,
    redactPupilName,
    restorePupilName,
    findSuspectNames,
    summariseSuspectNames,
    PUPIL_NAME_PLACEHOLDER
  };
}
