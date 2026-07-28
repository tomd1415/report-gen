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
    const regex = new RegExp(`(^|[^\\w])${escapeRegex(target)}([^\\w]|$)`, 'gi');
    result = result.replace(regex, (match, prefix, suffix) => `${prefix || ''}${PUPIL_NAME_PLACEHOLDER}${suffix || ''}`);
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

if (typeof window !== 'undefined') {
  window.ReportSelection = {
    categoryGroups,
    matchCategoryGroup,
    collectSelections,
    redactPupilName,
    restorePupilName,
    findSuspectNames,
    PUPIL_NAME_PLACEHOLDER
  };
}
