const LIMITS = {
  name: 80,
  pupilNames: 2000,
  reports: 60000
};

export const TARGET_PLACEHOLDER_COMMENT = '***Generate a target for this pupil and add to the report***';
const TARGET_PLACEHOLDER_PATTERN = /generate a target for this pupil/i;

const cleanText = (text) => (text ? String(text).replace(/\s+/g, ' ').trim() : '');
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isTargetPlaceholderComment = (value) => TARGET_PLACEHOLDER_PATTERN.test(String(value || ''));

const normalizeKey = (category, comment) =>
  `${cleanText(category).toLowerCase()}||${cleanText(comment).toLowerCase()}`;

export class ReportImportValidationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'ReportImportValidationError';
    this.statusCode = statusCode;
  }
}

const categorySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    categories: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          comments: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['name', 'comments']
      }
    }
  },
  required: ['categories']
};

const relevanceSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    flagged: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          category: { type: 'string' },
          comment: { type: 'string' },
          reason: { type: 'string' }
        },
        required: ['category', 'comment', 'reason']
      }
    }
  },
  required: ['flagged']
};

const normalizeCategories = (categories) => {
  const normalized = {};
  for (const category of categories) {
    const name = cleanText(category?.name);
    if (!name) {
      continue;
    }
    const comments = Array.isArray(category?.comments) ? category.comments : [];
    const cleaned = comments.map((comment) => cleanText(comment)).filter(Boolean);
    if (!normalized[name]) {
      normalized[name] = new Set();
    }
    cleaned.forEach((comment) => normalized[name].add(comment));
  }
  return normalized;
};

const serializeCategoryMap = (categoryMap) => {
  return Object.entries(categoryMap).map(([name, comments]) => ({
    name,
    comments: Array.from(comments)
  }));
};

const countComments = (categoryMap) => {
  return Object.values(categoryMap).reduce((sum, comments) => sum + comments.size, 0);
};

const buildCommentItems = (categoryMap) => {
  const items = [];
  for (const [categoryName, comments] of Object.entries(categoryMap)) {
    for (const comment of comments) {
      if (isTargetPlaceholderComment(comment)) {
        continue;
      }
      items.push({ category: categoryName, comment });
    }
  }
  return items;
};

const filterCategoryMapByRelevance = (categoryMap, flaggedItems) => {
  const flaggedKeys = new Set(
    flaggedItems
      .filter((item) => !isTargetPlaceholderComment(item.comment))
      .map((item) => normalizeKey(item.category, item.comment))
  );

  if (flaggedKeys.size === 0) {
    return categoryMap;
  }

  const filtered = {};
  for (const [categoryName, comments] of Object.entries(categoryMap)) {
    const kept = [];
    for (const comment of comments) {
      const key = normalizeKey(categoryName, comment);
      if (!flaggedKeys.has(key)) {
        kept.push(comment);
      }
    }
    if (kept.length > 0) {
      filtered[categoryName] = new Set(kept);
    }
  }
  return filtered;
};

const buildRelevancePrompt = (subjectDescription, commentItems) => `
You are checking whether selected report comments are in-scope for the subject description.
Subject description (scope for this year group):
${subjectDescription}

Rules:
- Effort, motivation, attendance, behaviour, collaboration, organisation, and general learning habits are always relevant.
- Knowledge/skills content must be clearly supported by the subject description.
- If unsure, mark the comment as relevant.
- Use the category string exactly as provided.
- The placeholder comment "${TARGET_PLACEHOLDER_COMMENT}" is always allowed.
- Return only comments that are out of scope.

Comments to review (category + comment):
${JSON.stringify(commentItems, null, 2)}
`;

const replacePupilNames = (reports, pupilNames) => {
  const placeholder = 'PUPIL_NAME';
  const namesArray = pupilNames
    .split(',')
    .map((name) => cleanText(name))
    .filter((name) => name && name.length <= LIMITS.name);

  let reportsWithPlaceholder = reports;
  namesArray.forEach((name) => {
    const escapedName = escapeRegex(name);
    const regex = new RegExp(`(^|[^\\w])${escapedName}([^\\w]|$)`, 'g');
    reportsWithPlaceholder = reportsWithPlaceholder.replace(regex, (match, prefix, suffix) => {
      return `${prefix || ''}${placeholder}${suffix || ''}`;
    });
  });

  return reportsWithPlaceholder;
};

const buildExtractionPrompt = ({ subjectDescription, reportsWithPlaceholder }) => `
Please analyze the following school reports and extract relevant categories and comments that can be used to generate future student reports.
Subject description (scope for this year group):
${subjectDescription || 'Not provided.'}
Rules:
- Use no more than 5 categories aligned to the report structure:
  1) Topics studied / knowledge / skills acquired
  2) Effort / motivation / attendance
  3) Strengths / achievements
  4) Areas for development / targets toward end-of-year Teacher Target
  5) General / Other (only for comments that do not fit above)
- Use the category names above (shorten slightly if needed but keep clear alignment).
- No more than 10 comments per category (including any new comments you add); merge or remove similar comments.
- Keep each comment concise and standalone (aim for 12 words or fewer).
- Order comments from least able to most able; cover a range of abilities/behaviours.
- Keep knowledge/skills comments aligned to the subject description. Effort/behaviour/attendance comments are always allowed.
- Add 1-3 helpful new comments per category to fill likely gaps, grounded in the subject description and typical classroom expectations. If you cannot justify a new comment from the subject description, do not add it.
- Include a comment in the "Areas for development / targets toward end-of-year Teacher Target" category that is exactly: "${TARGET_PLACEHOLDER_COMMENT}".

Reports:
${reportsWithPlaceholder}
`;

const buildMergePrompt = ({ subjectDescription, existingCategoryPayload, newCategories }) => `I have two sets of categories and comments for student reports. Merge them into a single set aligned to the report structure.
Subject description (scope for this year group):
${subjectDescription || 'Not provided.'}
Rules:
- Use no more than 5 categories aligned to:
  1) Topics studied / knowledge / skills acquired
  2) Effort / motivation / attendance
  3) Strengths / achievements
  4) Areas for development / targets toward end-of-year Teacher Target
  5) General / Other (only for comments that do not fit above)
- If categories are similar, merge them. Use the category names above (shorten slightly if needed but keep clear alignment).
- No more than 10 comments per category (including any new comments you add); merge or remove similar comments.
- Keep each comment concise and standalone (aim for 12 words or fewer).
- Keep comments ordered from least able to most able.
- Keep knowledge/skills comments aligned to the subject description. Effort/behaviour/attendance comments are always allowed.
- Add 1-3 helpful new comments per category to fill likely gaps, grounded in the subject description and typical classroom expectations. If you cannot justify a new comment from the subject description, do not add it.
- Include a comment in the "Areas for development / targets toward end-of-year Teacher Target" category that is exactly: "${TARGET_PLACEHOLDER_COMMENT}".
- Give priority to the New categories and comments.

Existing categories and comments:
${JSON.stringify(existingCategoryPayload, null, 2)}

New categories and comments:
${JSON.stringify(serializeCategoryMap(newCategories), null, 2)}
`;

const runRelevanceFilter = async ({
  openai,
  openAIParams,
  logRequestId,
  label,
  subjectDescription,
  categoryMap
}) => {
  if (!subjectDescription) {
    return { categoryMap, filteredCount: 0 };
  }

  const items = buildCommentItems(categoryMap);
  if (items.length === 0) {
    return { categoryMap, filteredCount: 0 };
  }

  const relevanceResponse = await openai.responses.parse({
    ...openAIParams,
    input: [{ role: 'user', content: buildRelevancePrompt(subjectDescription, items) }],
    text: {
      format: {
        type: 'json_schema',
        name: label,
        schema: relevanceSchema,
        strict: true
      }
    },
    max_output_tokens: 1200,
    temperature: 0.2
  });
  logRequestId(relevanceResponse, label);

  const relevance = relevanceResponse.output_parsed || {};
  const flagged = Array.isArray(relevance.flagged) ? relevance.flagged : [];
  const filteredFlagged = flagged.filter((item) => !isTargetPlaceholderComment(item.comment));
  return {
    categoryMap: filterCategoryMapByRelevance(categoryMap, filteredFlagged),
    filteredCount: filteredFlagged.length
  };
};

const destroyExistingCategories = async ({ Category, Comment, existingCategories, subjectId, yearGroupId, ownerUserId, transaction }) => {
  const categoryIds = existingCategories
    .map((category) => category.id)
    .filter((id) => id !== undefined && id !== null);

  if (categoryIds.length > 0 && typeof Comment.destroy === 'function') {
    await Comment.destroy({
      where: { categoryId: categoryIds },
      transaction
    });
  }

  await Category.destroy({
    where: { subjectId, yearGroupId, userId: ownerUserId },
    transaction
  });
};

const persistCategoryMap = async ({
  sequelize,
  Category,
  Comment,
  existingCategories,
  categoryMap,
  subjectId,
  yearGroupId,
  ownerUserId
}) => {
  await sequelize.transaction(async (transaction) => {
    await destroyExistingCategories({
      Category,
      Comment,
      existingCategories,
      subjectId,
      yearGroupId,
      ownerUserId,
      transaction
    });

    for (const [categoryName, comments] of Object.entries(categoryMap)) {
      const category = await Category.create(
        { name: categoryName, subjectId, yearGroupId, userId: ownerUserId },
        { transaction }
      );
      for (const comment of comments) {
        await Comment.create({ text: comment, categoryId: category.id }, { transaction });
      }
    }
  });
};

export async function importReportsToCommentBank({
  models,
  openai,
  sequelize,
  openAIParams,
  logRequestId = () => {},
  ownerUserId,
  actorUserId,
  subjectId,
  yearGroupId,
  pupilNames,
  reports,
  mode = 'merge',
  subjectDescription = ''
}) {
  const { Category, Comment } = models;
  const safePupilNames = typeof pupilNames === 'string' ? pupilNames.trim() : '';
  const safeReports = typeof reports === 'string' ? reports.trim() : '';
  const normalizedMode = mode === 'replace' ? 'replace' : 'merge';

  if (!ownerUserId) {
    throw new ReportImportValidationError('Target staff user is required.');
  }
  if (!actorUserId) {
    throw new ReportImportValidationError('Importing user is required.');
  }
  if (!subjectId || !yearGroupId) {
    throw new ReportImportValidationError('Subject and year group are required.');
  }
  if (!safeReports) {
    throw new ReportImportValidationError('Reports are required.');
  }
  if (safePupilNames.length > LIMITS.pupilNames) {
    throw new ReportImportValidationError(`Pupil names must be ${LIMITS.pupilNames} characters or fewer.`);
  }
  if (safeReports.length > LIMITS.reports) {
    throw new ReportImportValidationError(`Reports must be ${LIMITS.reports} characters or fewer.`);
  }

  const reportsWithPlaceholder = replacePupilNames(safeReports, safePupilNames);

  const extractResponse = await openai.responses.parse({
    ...openAIParams,
    input: [{
      role: 'user',
      content: buildExtractionPrompt({ subjectDescription, reportsWithPlaceholder })
    }],
    text: {
      format: {
        type: 'json_schema',
        name: 'category_bank',
        schema: categorySchema,
        strict: true
      }
    },
    max_output_tokens: 2000,
    temperature: 0.6
  });
  logRequestId(extractResponse, 'import-reports-extract');

  const extracted = extractResponse.output_parsed || {};
  let finalCategories = normalizeCategories(extracted.categories || []);
  let filteredCount = 0;

  const filteredNew = await runRelevanceFilter({
    openai,
    openAIParams,
    logRequestId,
    label: 'comment_relevance_import',
    subjectDescription,
    categoryMap: finalCategories
  });
  finalCategories = filteredNew.categoryMap;
  filteredCount += filteredNew.filteredCount;

  const existingCategories = await Category.findAll({
    where: { subjectId, yearGroupId, userId: ownerUserId },
    include: [Comment]
  });
  const hadExistingCategories = existingCategories.length > 0;

  if (normalizedMode === 'merge' && hadExistingCategories) {
    const existingCategoryPayload = existingCategories.map((category) => ({
      name: category.name,
      comments: (category.Comments || []).map((comment) => cleanText(comment.text)).filter(Boolean)
    }));

    const mergeResponse = await openai.responses.parse({
      ...openAIParams,
      input: [{
        role: 'user',
        content: buildMergePrompt({
          subjectDescription,
          existingCategoryPayload,
          newCategories: finalCategories
        })
      }],
      text: {
        format: {
          type: 'json_schema',
          name: 'category_bank_merge',
          schema: categorySchema,
          strict: true
        }
      },
      max_output_tokens: 2000,
      temperature: 0.6
    });
    logRequestId(mergeResponse, 'import-reports-merge');

    const mergedParsed = mergeResponse.output_parsed || {};
    finalCategories = normalizeCategories(mergedParsed.categories || []);

    const filteredMerged = await runRelevanceFilter({
      openai,
      openAIParams,
      logRequestId,
      label: 'comment_relevance_merge',
      subjectDescription,
      categoryMap: finalCategories
    });
    finalCategories = filteredMerged.categoryMap;
    filteredCount += filteredMerged.filteredCount;
  }

  await persistCategoryMap({
    sequelize,
    Category,
    Comment,
    existingCategories,
    categoryMap: finalCategories,
    subjectId,
    yearGroupId,
    ownerUserId
  });

  return {
    message: 'Reports imported successfully and categories/comments generated.',
    mode: normalizedMode,
    ownerUserId,
    actorUserId,
    subjectId,
    yearGroupId,
    totalCategories: Object.keys(finalCategories).length,
    totalComments: countComments(finalCategories),
    filteredCount,
    replacedExisting: normalizedMode === 'replace' && hadExistingCategories,
    mergedExisting: normalizedMode === 'merge' && hadExistingCategories
  };
}
