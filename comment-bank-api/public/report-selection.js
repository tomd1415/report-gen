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

if (typeof window !== 'undefined') {
  window.ReportSelection = { categoryGroups, matchCategoryGroup, collectSelections };
}
