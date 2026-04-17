import crypto from 'crypto';
import bcrypt from 'bcrypt';
import csv from 'csv-parser';
import fs from 'fs';
import multer from 'multer';
import { Parser } from 'json2csv';
import rateLimit from 'express-rate-limit';
import { isAuthenticated, isAdmin } from '../middleware/auth.js';
import { exportDatabase, backupDatabase } from '../services/dbBackup.js';
import { importReportsToCommentBank, ReportImportValidationError } from '../services/reportImport.js';
import { config } from '../config/env.js';
import { sequelize } from '../db/sequelize.js';

const LIMITS = {
  name: 80,
  pronouns: 60,
  additionalComments: 1000,
  promptPart: 5000,
  subjectDescription: 2000,
  commentText: 300,
  selectedComment: 1000,
  categoryName: 120,
  pupilNames: 2000,
  reports: 60000,
  maxSelectedComments: 8,
  maxCategories: 50,
  maxCommentsPerCategory: 50,
  strengthFocusMax: 5,
  strengthFocusTopic: 80,
  strengthFocusLevel: 30
};

const TARGET_PLACEHOLDER_COMMENT = '***Generate a target for this pupil and add to the report***';
const TARGET_PLACEHOLDER_PATTERN = /generate a target for this pupil/i;
const isTargetPlaceholderComment = (value) => TARGET_PLACEHOLDER_PATTERN.test(String(value || ''));
const normalizeKey = (category, comment) =>
  `${cleanText(category).toLowerCase()}||${cleanText(comment).toLowerCase()}`;

const UPLOAD_LIMIT_BYTES = 5 * 1024 * 1024;
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: UPLOAD_LIMIT_BYTES }
});
const packageVersion = (() => {
  try {
    const packageJson = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    return packageJson.version || 'unknown';
  } catch {
    return 'unknown';
  }
})();

const cleanText = (text) => (text ? text.replace(/\s+/g, ' ').trim() : '');
const cleanAndLimit = (value, maxLength) => {
  const cleaned = cleanText(value);
  if (!cleaned) {
    return '';
  }
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
};
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const parseWordLimit = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};
const hashIdentifier = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const getSafetyIdentifier = (req) => {
  const userId = req.session?.user?.id;
  return userId ? hashIdentifier(userId) : 'anonymous';
};
const logRequestId = (response, label) => {
  if (response?._request_id) {
    console.log(`${label} request id: ${response._request_id}`);
  }
};
const sendError = (res, status, message, extra = {}) =>
  res.status(status).json({ message, ...extra });
const getBuildCommit = () =>
  process.env.GIT_COMMIT
  || process.env.SOURCE_VERSION
  || process.env.RENDER_GIT_COMMIT
  || process.env.COMMIT_SHA
  || null;

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

const reportSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    paragraphs: {
      type: 'array',
      minItems: 4,
      maxItems: 4,
      items: { type: 'string' }
    }
  },
  required: ['paragraphs']
};
const EXPECTED_REPORT_PARAGRAPHS = 4;
const INCOMPLETE_REPORT_MESSAGE = 'The AI did not return a complete 4-paragraph report. Your entries have been kept; please try again.';

const extractGeneratedParagraphs = (response) => {
  const parsed = response.output_parsed || {};
  const parsedParagraphs = Array.isArray(parsed.paragraphs)
    ? parsed.paragraphs.map((paragraph) => cleanText(paragraph)).filter(Boolean)
    : [];

  if (parsedParagraphs.length === EXPECTED_REPORT_PARAGRAPHS) {
    return parsedParagraphs;
  }

  const fallbackText = response.output_text?.trim() || '';
  if (!fallbackText) {
    return parsedParagraphs;
  }

  return fallbackText
    .split(/\n\s*\n/)
    .map((paragraph) => cleanText(paragraph))
    .filter(Boolean);
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

const buildOpenAIParams = (req) => ({
  model: config.openai.model,
  reasoning: { effort: config.openai.reasoningEffort },
  store: false,
  safety_identifier: getSafetyIdentifier(req)
});

export function registerRoutes(app, { models, openai, sequelizeClient = sequelize }) {
  const {
    User,
    Subject,
    YearGroup,
    Category,
    Comment,
    Prompt,
    SubjectContext,
    UserSubject,
    UserYearGroup
  } = models;

  const openAiLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    limit: config.rateLimit.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => req.session?.user?.id?.toString() || req.ip,
    message: { message: 'Rate limit exceeded. Try again later.' }
  });
  const authLimiter = rateLimit({
    windowMs: config.authRateLimit.windowMs,
    limit: config.authRateLimit.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many authentication attempts. Please try again later.' }
  });

  const findOwnedCategory = (id, userId, options = {}) => {
    return Category.findOne({
      where: { id, userId },
      ...options
    });
  };

  const findOwnedComment = (id, userId) => {
    return Comment.findOne({
      where: { id },
      include: [{
        model: Category,
        where: { userId }
      }]
    });
  };

  const findOwnedPrompt = (id, userId) => {
    return Prompt.findOne({
      where: { id, userId }
    });
  };

  const isTruthy = (value) => value === true || value === 'true' || value === 'on' || value === '1';
  const serializeUser = (user) => ({
    id: user.id,
    username: user.username,
    isAdmin: Boolean(user.isAdmin)
  });
  const isDuplicateUserError = (error) =>
    error?.name === 'SequelizeUniqueConstraintError' ||
    error?.parent?.code === 'ER_DUP_ENTRY' ||
    error?.original?.code === 'ER_DUP_ENTRY';
  const validateManagedUserPayload = ({ username, password }) => {
    const cleanedUsername = cleanText(username);

    if (!cleanedUsername) {
      return { message: 'Username is required.' };
    }
    if (cleanedUsername.length > LIMITS.name) {
      return { message: `Username must be ${LIMITS.name} characters or fewer.` };
    }
    if (typeof password !== 'string' || !password.trim()) {
      return { message: 'Password is required.' };
    }

    return { username: cleanedUsername, password };
  };
  const createManagedUser = async (req, res, successMessage) => {
    const validation = validateManagedUserPayload(req.body);
    if (validation.message) {
      return res.status(400).json({ message: validation.message });
    }

    try {
      const hashedPassword = await bcrypt.hash(validation.password, 10);
      const user = await User.create({
        username: validation.username,
        password: hashedPassword,
        isAdmin: isTruthy(req.body.isAdmin)
      });
      res.json({ message: successMessage, user: serializeUser(user) });
    } catch (error) {
      if (isDuplicateUserError(error)) {
        return res.status(409).json({ message: 'A user with that username already exists.' });
      }
      console.error('Error creating user:', error);
      sendError(res, 500, 'Error creating user');
    }
  };

  const findTargetUser = async (userId) => {
    const parsedUserId = Number.parseInt(userId, 10);
    if (Number.isNaN(parsedUserId)) {
      return null;
    }
    return User.findByPk(parsedUserId);
  };

  const ensureUserVisibility = async ({ userId, subjectId, yearGroupId }) => {
    const result = {
      subjectCreated: false,
      yearGroupCreated: false
    };

    if (subjectId) {
      const [, created] = await UserSubject.findOrCreate({ where: { userId, subjectId } });
      result.subjectCreated = created;
    }

    if (yearGroupId) {
      const [, created] = await UserYearGroup.findOrCreate({ where: { userId, yearGroupId } });
      result.yearGroupCreated = created;
    }

    return result;
  };

  const parseCategoryCsvFile = async (filePath) => {
    const categories = {};
    let skippedRows = 0;

    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          const categoryName = cleanAndLimit(data['categoryName'], LIMITS.categoryName);
          const commentText = cleanAndLimit(data['commentText'], LIMITS.commentText);

          if (!categoryName || !commentText) {
            skippedRows += 1;
            return;
          }

          if (!categories[categoryName]) {
            if (Object.keys(categories).length >= LIMITS.maxCategories) {
              skippedRows += 1;
              return;
            }
            categories[categoryName] = [];
          }

          if (categories[categoryName].length >= LIMITS.maxCommentsPerCategory) {
            skippedRows += 1;
            return;
          }

          categories[categoryName].push(commentText);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    return { categories, skippedRows };
  };

  const replaceCategoryBankFromArrays = async ({ categories, subjectId, yearGroupId, userId }) => {
    await sequelize.transaction(async (transaction) => {
      const existingCategories = await Category.findAll({
        where: { subjectId, yearGroupId, userId },
        attributes: ['id'],
        transaction
      });
      const categoryIds = existingCategories
        .map((category) => category.id)
        .filter((id) => id !== undefined && id !== null);

      if (categoryIds.length > 0) {
        await Comment.destroy({
          where: { categoryId: categoryIds },
          transaction
        });
      }

      await Category.destroy({
        where: { subjectId, yearGroupId, userId },
        transaction
      });

      for (const [name, comments] of Object.entries(categories)) {
        const category = await Category.create({ name, subjectId, yearGroupId, userId }, { transaction });
        for (const text of comments) {
          await Comment.create({ text, categoryId: category.id }, { transaction });
        }
      }
    });

    return {
      totalCategories: Object.keys(categories).length,
      totalComments: Object.values(categories).reduce((sum, comments) => sum + comments.length, 0)
    };
  };

  app.use('/api/subjects', isAuthenticated);
  app.use('/api/year-groups', isAuthenticated);
  app.use('/api/categories-comments', isAuthenticated);
  app.use('/generate-report', isAuthenticated, openAiLimiter);
  app.use('/api/comments', isAuthenticated);
  app.use('/api/move-comment', isAuthenticated);
  app.use('/api/prompts', isAuthenticated);
  app.use('/api/subject-context', isAuthenticated);
  app.use('/api/admin/staff', isAuthenticated, isAdmin);
  app.use('/api/export-categories-comments', isAuthenticated);
  app.use('/api/import-categories-comments', isAuthenticated);
  app.use('/api/import-reports', isAuthenticated, openAiLimiter);
  app.use(['/api/login', '/api/admin/login', '/api/register'], authLimiter);

  app.get('/api/authenticated', (req, res) => {
    if (req.session.user) {
      res.json({ authenticated: true });
    } else {
      res.status(401).json({ authenticated: false });
    }
  });

  app.get('/api/user-info', isAuthenticated, async (req, res) => {
    try {
      if (req.session.user) {
        res.json({ username: req.session.user.username, isAdmin: req.session.user.isAdmin });
      } else {
        res.status(404).json({ message: 'User not found' });
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
      sendError(res, 500, 'Error fetching user info');
    }
  });

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, status: 'ok' });
  });

  app.get('/api/health/db', isAuthenticated, isAdmin, async (req, res) => {
    try {
      await sequelizeClient.authenticate();
      res.json({ ok: true, status: 'ok', database: 'ok' });
    } catch (error) {
      console.error('Database health check failed:', error);
      sendError(res, 503, 'Database connection failed.', {
        ok: false,
        status: 'error',
        database: 'error'
      });
    }
  });

  app.get('/api/version', (req, res) => {
    res.json({
      name: 'comment-bank-api',
      version: packageVersion,
      environment: config.env,
      commit: getBuildCommit()
    });
  });

  app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    try {
      if (config.env === 'production' && !config.auth.allowRegistrationInProd) {
        return res.status(403).json({ message: 'Registration is disabled in production.' });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.create({ username, password: hashedPassword });
      res.json({ message: 'User registered successfully', user: serializeUser(user) });
    } catch (error) {
      console.error('Error registering user:', error);
      sendError(res, 500, 'Error registering user');
    }
  });

  app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
      const user = await User.findOne({ where: { username } });
      if (user && await bcrypt.compare(password, user.password)) {
        req.session.user = { id: user.id, username: user.username, isAdmin: user.isAdmin };
        res.json({ message: 'Login successful' });
      } else {
        res.status(401).json({ message: 'Invalid credentials' });
      }
    } catch (error) {
      console.error('Error logging in:', error);
      sendError(res, 500, 'Error logging in');
    }
  });

  app.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
      res.json({ message: 'Logout successful' });
    });
  });

  app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    try {
      const user = await User.findOne({ where: { username } });
      if (user && await bcrypt.compare(password, user.password)) {
        if (user.isAdmin) {
          req.session.user = { id: user.id, username: user.username, isAdmin: user.isAdmin };
          res.json({ message: 'Login successful', isAdmin: true });
        } else {
          res.status(403).json({ message: 'Access Denied' });
        }
      } else {
        res.status(401).json({ message: 'Invalid credentials' });
      }
    } catch (error) {
      console.error('Error logging in:', error);
      sendError(res, 500, 'Error logging in');
    }
  });

  app.post('/api/admin/year-group', isAdmin, async (req, res) => {
    const { name } = req.body;
    try {
      const cleanedName = cleanText(name);
      if (!cleanedName) {
        return res.status(400).json({ message: 'Year group name is required.' });
      }
      if (cleanedName.length > LIMITS.categoryName) {
        return res.status(400).json({ message: `Year group name must be ${LIMITS.categoryName} characters or fewer.` });
      }
      const yearGroup = await YearGroup.create({ name: cleanedName });
      res.json(yearGroup);
    } catch (error) {
      console.error('Error creating year group:', error);
      sendError(res, 500, 'Error creating year group');
    }
  });

  app.delete('/api/admin/year-group/:name', isAdmin, async (req, res) => {
    const { name } = req.params;
    try {
      const yearGroup = await YearGroup.findOne({ where: { name } });
      if (yearGroup) {
        await yearGroup.destroy();
        res.sendStatus(204);
      } else {
        sendError(res, 404, 'Year group not found');
      }
    } catch (error) {
      console.error('Error deleting year group:', error);
      sendError(res, 500, 'Error deleting year group');
    }
  });

  app.post('/api/admin/subject', isAdmin, async (req, res) => {
    const { name } = req.body;
    try {
      const cleanedName = cleanText(name);
      if (!cleanedName) {
        return res.status(400).json({ message: 'Subject name is required.' });
      }
      if (cleanedName.length > LIMITS.categoryName) {
        return res.status(400).json({ message: `Subject name must be ${LIMITS.categoryName} characters or fewer.` });
      }
      const subject = await Subject.create({ name: cleanedName });
      res.json(subject);
    } catch (error) {
      console.error('Error creating subject:', error);
      sendError(res, 500, 'Error creating subject');
    }
  });

  app.delete('/api/admin/subject/:name', isAdmin, async (req, res) => {
    const { name } = req.params;
    try {
      const subject = await Subject.findOne({ where: { name } });
      if (subject) {
        await subject.destroy();
        res.sendStatus(204);
      } else {
        sendError(res, 404, 'Subject not found');
      }
    } catch (error) {
      console.error('Error deleting subject:', error);
      sendError(res, 500, 'Error deleting subject');
    }
  });

  app.post('/api/admin/user', isAdmin, async (req, res) => {
    await createManagedUser(req, res, 'User added successfully');
  });

  app.delete('/api/admin/user/:username', isAdmin, async (req, res) => {
    const { username } = req.params;
    try {
      const user = await User.findOne({ where: { username } });
      if (user) {
        await user.destroy();
        res.sendStatus(204);
      } else {
        sendError(res, 404, 'User not found');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      sendError(res, 500, 'Error deleting user');
    }
  });

  app.get('/api/admin/export', isAdmin, async (req, res) => {
    if (!config.backup.enabled) {
      return sendError(res, 403, 'Database export disabled');
    }
    try {
      const filePath = await exportDatabase();
      res.download(filePath);
    } catch (error) {
      console.error('Error exporting database:', error);
      sendError(res, 500, 'Error exporting database');
    }
  });

  app.post('/api/admin/backup', isAdmin, async (req, res) => {
    if (!config.backup.enabled) {
      return res.status(403).json({ message: 'Database backup disabled' });
    }
    try {
      const filePath = await backupDatabase();
      res.json({ message: 'Backup successful', file: filePath });
    } catch (error) {
      console.error('Error backing up database:', error);
      sendError(res, 500, 'Error backing up database');
    }
  });

  app.post('/api/subjects', isAdmin, async (req, res) => {
    const { name } = req.body;
    try {
      const cleanedName = cleanText(name);
      if (!cleanedName) {
        return res.status(400).json({ message: 'Subject name is required.' });
      }
      if (cleanedName.length > LIMITS.categoryName) {
        return res.status(400).json({ message: `Subject name must be ${LIMITS.categoryName} characters or fewer.` });
      }
      const subject = await Subject.create({ name: cleanedName });
      res.json(subject);
    } catch (error) {
      console.error('Error creating subject:', error);
      sendError(res, 500, 'Error creating subject');
    }
  });

  app.put('/api/subjects/:id', isAdmin, async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    try {
      const cleanedName = cleanText(name);
      if (!cleanedName) {
        return res.status(400).json({ message: 'Subject name is required.' });
      }
      if (cleanedName.length > LIMITS.categoryName) {
        return res.status(400).json({ message: `Subject name must be ${LIMITS.categoryName} characters or fewer.` });
      }
      const subject = await Subject.findByPk(id);
      if (subject) {
        subject.name = cleanedName;
        await subject.save();
        res.json(subject);
      } else {
        sendError(res, 404, 'Subject not found');
      }
    } catch (error) {
      console.error('Error updating subject:', error);
      sendError(res, 500, 'Error updating subject');
    }
  });

  app.delete('/api/subjects/:id', isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
      const subject = await Subject.findByPk(id);
      if (subject) {
        await subject.destroy();
        res.sendStatus(204);
      } else {
        sendError(res, 404, 'Subject not found');
      }
    } catch (error) {
      console.error('Error deleting subject:', error);
      sendError(res, 500, 'Error deleting subject');
    }
  });

  app.get('/api/subjects', async (req, res) => {
    try {
      const subjects = await Subject.findAll();
      res.json(subjects);
    } catch (error) {
      console.error('Error fetching subjects:', error);
      sendError(res, 500, 'Error fetching subjects');
    }
  });

  app.post('/api/year-groups', isAdmin, async (req, res) => {
    const { name } = req.body;
    try {
      const cleanedName = cleanText(name);
      if (!cleanedName) {
        return res.status(400).json({ message: 'Year group name is required.' });
      }
      if (cleanedName.length > LIMITS.categoryName) {
        return res.status(400).json({ message: `Year group name must be ${LIMITS.categoryName} characters or fewer.` });
      }
      const yearGroup = await YearGroup.create({ name: cleanedName });
      res.json(yearGroup);
    } catch (error) {
      console.error('Error creating year group:', error);
      sendError(res, 500, 'Error creating year group');
    }
  });

  app.put('/api/year-groups/:id', isAdmin, async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    try {
      const cleanedName = cleanText(name);
      if (!cleanedName) {
        return res.status(400).json({ message: 'Year group name is required.' });
      }
      if (cleanedName.length > LIMITS.categoryName) {
        return res.status(400).json({ message: `Year group name must be ${LIMITS.categoryName} characters or fewer.` });
      }
      const yearGroup = await YearGroup.findByPk(id);
      if (yearGroup) {
        yearGroup.name = cleanedName;
        await yearGroup.save();
        res.json(yearGroup);
      } else {
        sendError(res, 404, 'Year group not found');
      }
    } catch (error) {
      console.error('Error updating year group:', error);
      sendError(res, 500, 'Error updating year group');
    }
  });

  app.delete('/api/year-groups/:id', isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
      const yearGroup = await YearGroup.findByPk(id);
      if (yearGroup) {
        await yearGroup.destroy();
        res.sendStatus(204);
      } else {
        sendError(res, 404, 'Year group not found');
      }
    } catch (error) {
      console.error('Error deleting year group:', error);
      sendError(res, 500, 'Error deleting year group');
    }
  });

  app.get('/api/year-groups', async (req, res) => {
    try {
      const yearGroups = await YearGroup.findAll();
      res.json(yearGroups);
    } catch (error) {
      console.error('Error fetching year groups:', error);
      sendError(res, 500, 'Error fetching year groups');
    }
  });

  app.post('/api/categories', async (req, res) => {
    const { name, subjectId, yearGroupId } = req.body;
    const userId = req.session.user.id;
    try {
      const cleanedName = cleanText(name);
      if (!cleanedName) {
        return res.status(400).json({ message: 'Category name is required.' });
      }
      if (cleanedName.length > LIMITS.categoryName) {
        return res.status(400).json({ message: `Category name must be ${LIMITS.categoryName} characters or fewer.` });
      }
      const category = await Category.create({ name: cleanedName, subjectId, yearGroupId, userId });
      res.json(category);
    } catch (error) {
      console.error('Error creating category:', error);
      sendError(res, 500, 'Error creating category');
    }
  });

  app.put('/api/categories/:id', async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    const userId = req.session.user.id;
    try {
      const cleanedName = cleanText(name);
      if (!cleanedName) {
        return res.status(400).json({ message: 'Category name is required.' });
      }
      if (cleanedName.length > LIMITS.categoryName) {
        return res.status(400).json({ message: `Category name must be ${LIMITS.categoryName} characters or fewer.` });
      }
      const category = await findOwnedCategory(id, userId);
      if (category) {
        category.name = cleanedName;
        await category.save();
        res.json(category);
      } else {
        sendError(res, 404, 'Category not found');
      }
    } catch (error) {
      console.error('Error updating category:', error);
      sendError(res, 500, 'Error updating category');
    }
  });

  app.delete('/api/categories/:id', async (req, res) => {
    const { id } = req.params;
    const userId = req.session.user.id;
    try {
      const category = await findOwnedCategory(id, userId);
      if (category) {
        await category.destroy();
        res.sendStatus(204);
      } else {
        sendError(res, 404, 'Category not found');
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      sendError(res, 500, 'Error deleting category');
    }
  });

  app.get('/api/categories-comments', async (req, res) => {
    const { subjectId, yearGroupId } = req.query;
    const userId = req.session.user.id;
    try {
      const categories = await Category.findAll({
        where: { subjectId, yearGroupId, userId },
        include: [Comment]
      });
      res.json(categories);
    } catch (error) {
      console.error('Error fetching categories and comments:', error);
      sendError(res, 500, 'Error fetching categories and comments');
    }
  });

  app.get('/api/categories/:id', async (req, res) => {
    const { id } = req.params;
    const userId = req.session.user.id;
    try {
      const category = await findOwnedCategory(id, userId, { include: [Comment] });
      if (category) {
        res.json(category);
      } else {
        sendError(res, 404, 'Category not found');
      }
    } catch (error) {
      console.error('Error fetching category:', error);
      sendError(res, 500, 'Error fetching category');
    }
  });

  app.post('/api/comments', async (req, res) => {
    const { text, categoryId } = req.body;
    const userId = req.session.user.id;
    try {
      const cleanedText = cleanText(text);
      if (!cleanedText) {
        return res.status(400).json({ message: 'Comment text is required.' });
      }
      if (cleanedText.length > LIMITS.commentText) {
        return res.status(400).json({ message: `Comment must be ${LIMITS.commentText} characters or fewer.` });
      }
      const category = await findOwnedCategory(categoryId, userId);
      if (!category) {
        return sendError(res, 404, 'Category not found');
      }
      const comment = await Comment.create({ text: cleanedText, categoryId });
      res.json(comment);
    } catch (error) {
      console.error('Error creating comment:', error);
      sendError(res, 500, 'Error creating comment');
    }
  });

  app.put('/api/comments/:id', async (req, res) => {
    const { id } = req.params;
    const { text } = req.body;
    const userId = req.session.user.id;
    try {
      const cleanedText = cleanText(text);
      if (!cleanedText) {
        return res.status(400).json({ message: 'Comment text is required.' });
      }
      if (cleanedText.length > LIMITS.commentText) {
        return res.status(400).json({ message: `Comment must be ${LIMITS.commentText} characters or fewer.` });
      }
      const comment = await findOwnedComment(id, userId);
      if (comment) {
        comment.text = cleanedText;
        await comment.save();
        res.json(comment);
      } else {
        sendError(res, 404, 'Comment not found');
      }
    } catch (error) {
      console.error('Error updating comment:', error);
      sendError(res, 500, 'Error updating comment');
    }
  });

  app.delete('/api/comments/:id', async (req, res) => {
    const { id } = req.params;
    const userId = req.session.user.id;
    try {
      const comment = await findOwnedComment(id, userId);
      if (comment) {
        await comment.destroy();
        res.sendStatus(204);
      } else {
        sendError(res, 404, 'Comment not found');
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      sendError(res, 500, 'Error deleting comment');
    }
  });

  app.get('/api/comments', async (req, res) => {
    const { categoryId } = req.query;
    const userId = req.session.user.id;
    try {
      const category = await findOwnedCategory(categoryId, userId);
      if (!category) {
        return sendError(res, 404, 'Category not found');
      }
      const comments = await Comment.findAll({
        where: { categoryId }
      });
      res.json(comments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      sendError(res, 500, 'Error fetching comments');
    }
  });

  app.get('/api/comments/:id', async (req, res) => {
    const { id } = req.params;
    const userId = req.session.user.id;
    try {
      const comment = await findOwnedComment(id, userId);
      if (comment) {
        res.json(comment);
      } else {
        sendError(res, 404, 'Comment not found');
      }
    } catch (error) {
      console.error('Error fetching comment:', error);
      sendError(res, 500, 'Error fetching comment');
    }
  });

  app.post('/api/move-comment', async (req, res) => {
    const { commentId, newCategoryId } = req.body;
    const userId = req.session.user.id;
    try {
      const [comment, newCategory] = await Promise.all([
        findOwnedComment(commentId, userId),
        findOwnedCategory(newCategoryId, userId)
      ]);
      if (!comment || !newCategory) {
        sendError(res, 404, 'Comment not found');
        return;
      }
      comment.categoryId = newCategoryId;
      await comment.save();
      res.json(comment);
    } catch (error) {
      console.error('Error moving comment:', error);
      sendError(res, 500, 'Error moving comment');
    }
  });

  app.post('/generate-report', async (req, res) => {
    const {
      name,
      pronouns,
      subjectId,
      yearGroupId,
      additionalComments,
      wordLimit,
      overrideIrrelevant,
      strengthFocus,
      ...categories
    } = req.body;
    const userId = req.session.user.id;
    const safeName = cleanText(name);
    const safePronouns = cleanText(pronouns);
    const cleanedAdditionalComments = cleanText(additionalComments);
    const allowIrrelevant = overrideIrrelevant === true || overrideIrrelevant === 'true';
    const strengthFocusItems = Array.isArray(strengthFocus) ? strengthFocus : [];

    if (!safeName || !safePronouns) {
      return res.status(400).json({ message: 'Name and pronouns are required.' });
    }
    if (safeName.length > LIMITS.name) {
      return res.status(400).json({ message: `Name must be ${LIMITS.name} characters or fewer.` });
    }
    if (safePronouns.length > LIMITS.pronouns) {
      return res.status(400).json({ message: `Pronouns must be ${LIMITS.pronouns} characters or fewer.` });
    }
    if (cleanedAdditionalComments && cleanedAdditionalComments.length > LIMITS.additionalComments) {
      return res.status(400).json({ message: `Additional comments must be ${LIMITS.additionalComments} characters or fewer.` });
    }
    if (strengthFocusItems.length > LIMITS.strengthFocusMax) {
      return res.status(400).json({ message: `You can add up to ${LIMITS.strengthFocusMax} strength focus items.` });
    }

    try {
      const [promptPart, subjectContext] = await Promise.all([
        Prompt.findOne({
          where: {
            subjectId: subjectId,
            yearGroupId: yearGroupId,
            userId: userId
          }
        }),
        SubjectContext.findOne({
          where: {
            subjectId: subjectId,
            yearGroupId: yearGroupId,
            userId: userId
          }
        })
      ]);

      const subjectDescription = subjectContext?.subjectDescription
        ? subjectContext.subjectDescription.trim()
        : '';
      const effectiveWordLimit = parseWordLimit(wordLimit) ?? subjectContext?.wordLimit ?? null;

      let prompt = promptPart
        ? promptPart.promptPart
        : 'Write a friendly, formal school report for a pupil using the selected comments as evidence.';
      const placeholder = 'PUPIL_NAME';
      prompt += `\nI am using the following placeholder for a name: ${placeholder} the pronouns for this pupil are (${safePronouns}).\n`;

      if (subjectDescription) {
        prompt += 'Subject description (context only; do not repeat in the report). This description will be printed immediately before the report:\n';
        prompt += `${subjectDescription}\n`;
      }

      prompt += `Report requirements:\n- Exactly 4 paragraphs.\n- Paragraph 1: Topics / areas studied so far. Key knowledge and skills acquired (do not repeat the subject description).\n- Paragraph 2: Effort / motivation / attendance to lesson.\n- Paragraph 3: Strengths and particular achievements. Include at least one subject-specific strength tied to a topic or aspect of the subject.\n- Paragraph 4: Areas of development to bolster the pupil's progress and achieve end of year Teacher Target.\n- No headings or bullet points.\n`;

      if (effectiveWordLimit) {
        prompt += `Target length: about ${effectiveWordLimit} words total.\n`;
      } else {
        prompt += 'Keep it concise and avoid repetition.\n';
      }

      const selectedItems = [];
      for (const [category, comment] of Object.entries(categories)) {
        const categoryName = String(category);
        const categoryLabel = cleanText(categoryName) || categoryName;
        const selectedComments = Array.isArray(comment) ? comment : [comment];
        const cleanedSelections = selectedComments
          .map((item) => cleanText(item))
          .filter(Boolean);
        if (cleanedSelections.length > LIMITS.maxSelectedComments) {
          return res.status(400).json({ message: `Too many comments selected for ${category}.` });
        }
        for (const selection of cleanedSelections) {
          if (selection.length > LIMITS.selectedComment) {
            return res.status(400).json({ message: 'Selected comments are too long.' });
          }
          if (!isTargetPlaceholderComment(selection)) {
            selectedItems.push({ category: categoryName, comment: selection });
          }
        }
        if (cleanedSelections.length > 0) {
          prompt += `${categoryLabel}: ${cleanedSelections.join('; ')}\n`;
        }
      }

      const cleanedStrengthFocus = strengthFocusItems
        .map((item) => {
          if (!item) {
            return null;
          }
          if (typeof item === 'string') {
            const topic = cleanAndLimit(item, LIMITS.strengthFocusTopic);
            return topic ? { topic, level: 'strong' } : null;
          }
          const topic = cleanAndLimit(item.topic, LIMITS.strengthFocusTopic);
          const level = cleanAndLimit(item.level, LIMITS.strengthFocusLevel);
          if (!topic || !level) {
            return null;
          }
          return { topic, level };
        })
        .filter(Boolean);

      if (cleanedStrengthFocus.length > 0) {
        const focusSummary = cleanedStrengthFocus
          .map((item) => `${item.topic} (${item.level})`)
          .join('; ');
        prompt += `Subject strength focus for paragraph 3 (include at least one): ${focusSummary}\n`;
        cleanedStrengthFocus.forEach((item) => {
          selectedItems.push({ category: 'Strength focus', comment: `${item.topic} (${item.level})` });
        });
      }

      if (cleanedAdditionalComments) {
        prompt += `The following additional comments should be woven into the whole report: ${cleanedAdditionalComments}\n`;
      }

      if (subjectDescription && selectedItems.length > 0 && !allowIrrelevant) {
        const relevanceResponse = await openai.responses.parse({
          ...buildOpenAIParams(req),
          input: [{ role: 'user', content: buildRelevancePrompt(subjectDescription, selectedItems) }],
          text: {
            format: {
              type: 'json_schema',
              name: 'comment_relevance',
              schema: relevanceSchema,
              strict: true
            }
          },
          max_output_tokens: 800,
          temperature: 0.2
        });
        logRequestId(relevanceResponse, 'comment-relevance');

        const relevance = relevanceResponse.output_parsed || {};
        const flagged = Array.isArray(relevance.flagged) ? relevance.flagged : [];
        const filteredFlagged = flagged.filter((item) => !isTargetPlaceholderComment(item.comment));

        if (filteredFlagged.length > 0) {
          return res.status(422).json({
            message: 'Some selected comments may be out of scope for the subject description.',
            flagged: filteredFlagged
          });
        }
      }

      prompt += 'Write the report in a natural, human voice as if written by the class teacher. Use specific detail from the selected comments, avoid generic filler, and keep it personal to the pupil. Paragraph 3 must include at least one subject-specific strength tied to a topic or aspect of the subject. Do not introduce topics that are not supported by the subject description or selected comments. Weave any additional comments across the whole report rather than in a single paragraph.\n';

      const response = await openai.responses.parse({
        ...buildOpenAIParams(req),
        input: [{ role: 'user', content: prompt }],
        text: {
          format: {
            type: 'json_schema',
            name: 'report_paragraphs',
            schema: reportSchema,
            strict: true
          }
        },
        max_output_tokens: 700,
        temperature: 0.7
      });
      logRequestId(response, 'generate-report');

      const paragraphs = extractGeneratedParagraphs(response);
      if (paragraphs.length !== EXPECTED_REPORT_PARAGRAPHS) {
        return res.status(502).json({ message: INCOMPLETE_REPORT_MESSAGE });
      }

      const finalParagraphs = paragraphs.map((paragraph) =>
        paragraph.replace(new RegExp(placeholder, 'g'), safeName)
      );
      const report = finalParagraphs.join('\n\n');

      res.json({ report, paragraphs: finalParagraphs });
    } catch (error) {
      console.error('Error generating report:', error);
      res.status(500).json({ message: 'Error generating report' });
    }
  });

  app.post('/api/import-reports', async (req, res) => {
    const { subjectId, yearGroupId, pupilNames, reports } = req.body;
    const userId = req.session.user.id;

    try {
      const subjectContext = await SubjectContext.findOne({
        where: { subjectId, yearGroupId, userId }
      });
      const subjectDescription = subjectContext?.subjectDescription
        ? subjectContext.subjectDescription.trim()
        : '';

      const result = await importReportsToCommentBank({
        models,
        openai,
        sequelize,
        openAIParams: buildOpenAIParams(req),
        logRequestId,
        ownerUserId: userId,
        actorUserId: userId,
        subjectId,
        yearGroupId,
        pupilNames,
        reports,
        mode: 'merge',
        subjectDescription
      });

      res.json(result);
    } catch (error) {
      if (error instanceof ReportImportValidationError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error('Error importing reports:', error);
      sendError(res, 500, 'Error importing reports');
    }
  });

  app.get('/api/subject-context', async (req, res) => {
    const { subjectId, yearGroupId } = req.query;
    const userId = req.session.user.id;

    if (!subjectId || !yearGroupId) {
      return res.status(400).json({ message: 'Missing subjectId or yearGroupId' });
    }

    try {
      const context = await SubjectContext.findOne({
        where: { subjectId, yearGroupId, userId }
      });
      res.json({
        subjectDescription: context?.subjectDescription || '',
        wordLimit: context?.wordLimit ?? null
      });
    } catch (error) {
      console.error('Error fetching subject context:', error);
      sendError(res, 500, 'Error fetching subject context');
    }
  });

  app.post('/api/subject-context', async (req, res) => {
    const { subjectId, yearGroupId, subjectDescription, wordLimit } = req.body;
    const userId = req.session.user.id;

    if (!subjectId || !yearGroupId) {
      return res.status(400).json({ message: 'Missing subjectId or yearGroupId' });
    }

    const cleanedDescription = typeof subjectDescription === 'string' ? subjectDescription.trim() : '';
    if (cleanedDescription.length > LIMITS.subjectDescription) {
      return res.status(400).json({ message: `Subject description must be ${LIMITS.subjectDescription} characters or fewer.` });
    }
    const parsedWordLimit = parseWordLimit(wordLimit);

    try {
      const [context, created] = await SubjectContext.findOrCreate({
        where: { subjectId, yearGroupId, userId },
        defaults: {
          subjectDescription: cleanedDescription || null,
          wordLimit: parsedWordLimit
        }
      });

      if (!created) {
        context.subjectDescription = cleanedDescription || null;
        context.wordLimit = parsedWordLimit;
        await context.save();
      }

      res.json(context);
    } catch (error) {
      console.error('Error saving subject context:', error);
      sendError(res, 500, 'Error saving subject context');
    }
  });

  app.get('/api/admin/staff/:userId/comment-bank', async (req, res) => {
    const { userId } = req.params;
    const { subjectId, yearGroupId } = req.query;

    if (!subjectId || !yearGroupId) {
      return res.status(400).json({ message: 'Missing subjectId or yearGroupId' });
    }

    try {
      const targetUser = await findTargetUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: 'Target user not found' });
      }

      const categories = await Category.findAll({
        where: { subjectId, yearGroupId, userId: targetUser.id },
        include: [Comment]
      });
      res.json(categories);
    } catch (error) {
      console.error('Error fetching target comment bank:', error);
      sendError(res, 500, 'Error fetching target comment bank');
    }
  });

  app.post('/api/admin/staff/:userId/import-reports', openAiLimiter, async (req, res) => {
    const { userId } = req.params;
    const {
      subjectId,
      yearGroupId,
      pupilNames,
      reports,
      mode = 'merge',
      confirmReplace
    } = req.body;
    const normalizedMode = mode === 'replace' ? 'replace' : 'merge';

    if (normalizedMode === 'replace' && !isTruthy(confirmReplace)) {
      return res.status(400).json({ message: 'Replace mode requires confirmation.' });
    }

    try {
      const targetUser = await findTargetUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: 'Target user not found' });
      }

      const subjectContext = await SubjectContext.findOne({
        where: { subjectId, yearGroupId, userId: targetUser.id }
      });
      const subjectDescription = subjectContext?.subjectDescription
        ? subjectContext.subjectDescription.trim()
        : '';

      const result = await importReportsToCommentBank({
        models,
        openai,
        sequelize,
        openAIParams: buildOpenAIParams(req),
        logRequestId,
        ownerUserId: targetUser.id,
        actorUserId: req.session.user.id,
        subjectId,
        yearGroupId,
        pupilNames,
        reports,
        mode: normalizedMode,
        subjectDescription
      });
      const visibility = await ensureUserVisibility({
        userId: targetUser.id,
        subjectId,
        yearGroupId
      });

      res.json({
        ...result,
        targetUser: {
          id: targetUser.id,
          username: targetUser.username
        },
        visibility
      });
    } catch (error) {
      if (error instanceof ReportImportValidationError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error('Error importing reports for target user:', error);
      sendError(res, 500, 'Error importing reports for target user');
    }
  });

  app.get('/api/admin/staff/:userId/export-categories-comments', async (req, res) => {
    const { userId } = req.params;
    const { subjectId, yearGroupId } = req.query;

    if (!subjectId || !yearGroupId) {
      return res.status(400).json({ message: 'Missing subjectId or yearGroupId' });
    }

    try {
      const targetUser = await findTargetUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: 'Target user not found' });
      }

      const categories = await Category.findAll({
        where: { subjectId, yearGroupId, userId: targetUser.id },
        include: [Comment]
      });

      const data = categories.flatMap(category => {
        return category.Comments.map(comment => ({
          categoryName: category.name,
          commentText: comment.text ? comment.text.replace(/\s+/g, ' ').trim() : ''
        }));
      });

      const json2csvParser = new Parser({ fields: ['categoryName', 'commentText'] });
      const csvText = json2csvParser.parse(data);

      res.header('Content-Type', 'text/csv');
      res.attachment(`categories-comments-user-${targetUser.id}-${subjectId}-${yearGroupId}.csv`);
      res.send(csvText);
    } catch (error) {
      console.error('Error exporting target categories and comments:', error);
      sendError(res, 500, 'Error exporting target categories and comments');
    }
  });

  app.post('/api/admin/staff/:userId/import-categories-comments', upload.single('file'), async (req, res) => {
    const { userId } = req.params;
    const { subjectId, yearGroupId, confirmReplace } = req.body;
    const filePath = req.file?.path;

    if (!subjectId || !yearGroupId) {
      return sendError(res, 400, 'Missing subjectId or yearGroupId');
    }

    if (!isTruthy(confirmReplace)) {
      return res.status(400).json({ message: 'CSV import replaces the target comment bank and requires confirmation.' });
    }

    if (!req.file) {
      return sendError(res, 400, 'No file uploaded');
    }

    try {
      const targetUser = await findTargetUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: 'Target user not found' });
      }

      const { categories, skippedRows } = await parseCategoryCsvFile(filePath);
      const totals = await replaceCategoryBankFromArrays({
        categories,
        subjectId,
        yearGroupId,
        userId: targetUser.id
      });
      const visibility = await ensureUserVisibility({
        userId: targetUser.id,
        subjectId,
        yearGroupId
      });

      res.json({
        message: 'Categories and comments imported successfully for target staff user.',
        ...totals,
        skippedRows,
        targetUser: {
          id: targetUser.id,
          username: targetUser.username
        },
        visibility
      });
    } catch (error) {
      console.error('Error importing target categories and comments:', error);
      sendError(res, 500, 'Error importing target categories and comments');
    } finally {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  });

  app.get('/api/admin/staff/:userId/subject-context', async (req, res) => {
    const { userId } = req.params;
    const { subjectId, yearGroupId } = req.query;

    if (!subjectId || !yearGroupId) {
      return res.status(400).json({ message: 'Missing subjectId or yearGroupId' });
    }

    try {
      const targetUser = await findTargetUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: 'Target user not found' });
      }

      const context = await SubjectContext.findOne({
        where: { subjectId, yearGroupId, userId: targetUser.id }
      });
      res.json({
        subjectDescription: context?.subjectDescription || '',
        wordLimit: context?.wordLimit ?? null
      });
    } catch (error) {
      console.error('Error fetching target subject context:', error);
      sendError(res, 500, 'Error fetching target subject context');
    }
  });

  app.post('/api/admin/staff/:userId/subject-context', async (req, res) => {
    const { userId } = req.params;
    const { subjectId, yearGroupId, subjectDescription, wordLimit } = req.body;

    if (!subjectId || !yearGroupId) {
      return res.status(400).json({ message: 'Missing subjectId or yearGroupId' });
    }

    const cleanedDescription = typeof subjectDescription === 'string' ? subjectDescription.trim() : '';
    if (cleanedDescription.length > LIMITS.subjectDescription) {
      return res.status(400).json({ message: `Subject description must be ${LIMITS.subjectDescription} characters or fewer.` });
    }
    const parsedWordLimit = parseWordLimit(wordLimit);

    try {
      const targetUser = await findTargetUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: 'Target user not found' });
      }

      const [context, created] = await SubjectContext.findOrCreate({
        where: { subjectId, yearGroupId, userId: targetUser.id },
        defaults: {
          subjectDescription: cleanedDescription || null,
          wordLimit: parsedWordLimit
        }
      });

      if (!created) {
        context.subjectDescription = cleanedDescription || null;
        context.wordLimit = parsedWordLimit;
        await context.save();
      }

      const visibility = await ensureUserVisibility({
        userId: targetUser.id,
        subjectId,
        yearGroupId
      });

      res.json({ context, visibility });
    } catch (error) {
      console.error('Error saving target subject context:', error);
      sendError(res, 500, 'Error saving target subject context');
    }
  });

  app.get('/api/admin/staff/:userId/prompts/:subjectId/:yearGroupId', async (req, res) => {
    const { userId, subjectId, yearGroupId } = req.params;

    try {
      const targetUser = await findTargetUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: 'Target user not found' });
      }

      const prompt = await Prompt.findOne({
        where: { subjectId, yearGroupId, userId: targetUser.id }
      });
      res.json({ promptPart: prompt?.promptPart || '' });
    } catch (error) {
      console.error('Error fetching target prompt:', error);
      sendError(res, 500, 'Error fetching target prompt');
    }
  });

  app.post('/api/admin/staff/:userId/prompts', async (req, res) => {
    const { userId } = req.params;
    const { subjectId, yearGroupId, promptPart } = req.body;

    if (!subjectId || !yearGroupId) {
      return res.status(400).json({ message: 'Missing subjectId or yearGroupId' });
    }

    try {
      const targetUser = await findTargetUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: 'Target user not found' });
      }

      const trimmedPrompt = typeof promptPart === 'string' ? promptPart.trim() : '';
      if (trimmedPrompt.length > LIMITS.promptPart) {
        return res.status(400).json({ message: `Prompt text must be ${LIMITS.promptPart} characters or fewer.` });
      }

      const [prompt, created] = await Prompt.findOrCreate({
        where: { subjectId, yearGroupId, userId: targetUser.id },
        defaults: { promptPart: trimmedPrompt }
      });

      if (!created) {
        prompt.promptPart = trimmedPrompt;
        await prompt.save();
      }

      const visibility = await ensureUserVisibility({
        userId: targetUser.id,
        subjectId,
        yearGroupId
      });

      res.json({ prompt, visibility });
    } catch (error) {
      console.error('Error saving target prompt:', error);
      sendError(res, 500, 'Error saving target prompt');
    }
  });

  app.post('/api/prompts', async (req, res) => {
    const { subjectId, yearGroupId, promptPart } = req.body;
    const userId = req.session.user.id;
    try {
      const trimmedPrompt = typeof promptPart === 'string' ? promptPart.trim() : '';
      if (trimmedPrompt.length > LIMITS.promptPart) {
        return res.status(400).json({ message: `Prompt text must be ${LIMITS.promptPart} characters or fewer.` });
      }
      const [prompt, created] = await Prompt.findOrCreate({
        where: {
          subjectId: subjectId,
          yearGroupId: yearGroupId,
          userId: userId
        },
        defaults: {
          promptPart: trimmedPrompt
        }
      });

      if (!created) {
        prompt.promptPart = trimmedPrompt;
        await prompt.save();
      }

      res.json(prompt);
    } catch (error) {
      console.error('Error creating or updating prompt:', error);
      sendError(res, 500, 'Error creating or updating prompt');
    }
  });

  app.put('/api/prompts/:subjectId/:yearGroupId', async (req, res) => {
    const { subjectId, yearGroupId } = req.params;
    const userId = req.session.user.id;
    const { promptPart } = req.body;
    try {
      const trimmedPrompt = typeof promptPart === 'string' ? promptPart.trim() : '';
      if (trimmedPrompt.length > LIMITS.promptPart) {
        return res.status(400).json({ message: `Prompt text must be ${LIMITS.promptPart} characters or fewer.` });
      }
      const prompt = await Prompt.findOne({
        where: {
          subjectId: subjectId,
          yearGroupId: yearGroupId,
          userId: userId
        }
      });
      if (prompt) {
        prompt.promptPart = trimmedPrompt;
        await prompt.save();
        res.json(prompt);
      } else {
        sendError(res, 404, 'Prompt not found');
      }
    } catch (error) {
      console.error('Error updating prompt:', error);
      sendError(res, 500, 'Error updating prompt');
    }
  });

  app.put('/api/prompts/:id', async (req, res) => {
    const { id } = req.params;
    const { promptPart } = req.body;
    const userId = req.session.user.id;
    try {
      const trimmedPrompt = typeof promptPart === 'string' ? promptPart.trim() : '';
      if (trimmedPrompt.length > LIMITS.promptPart) {
        return res.status(400).json({ message: `Prompt text must be ${LIMITS.promptPart} characters or fewer.` });
      }
      const prompt = await findOwnedPrompt(id, userId);
      if (prompt) {
        prompt.promptPart = trimmedPrompt;
        await prompt.save();
        res.json(prompt);
      } else {
        sendError(res, 404, 'Prompt not found');
      }
    } catch (error) {
      console.error('Error updating prompt:', error);
      sendError(res, 500, 'Error updating prompt');
    }
  });

  app.delete('/api/prompts/:id', async (req, res) => {
    const { id } = req.params;
    const userId = req.session.user.id;
    try {
      const prompt = await findOwnedPrompt(id, userId);
      if (prompt) {
        await prompt.destroy();
        res.sendStatus(204);
      } else {
        sendError(res, 404, 'Prompt not found');
      }
    } catch (error) {
      console.error('Error deleting prompt:', error);
      sendError(res, 500, 'Error deleting prompt');
    }
  });

  app.delete('/api/prompts/:subjectId/:yearGroupId', async (req, res) => {
    const { subjectId, yearGroupId } = req.params;
    const userId = req.session.user.id;
    try {
      const prompt = await Prompt.findOne({
        where: {
          subjectId: subjectId,
          yearGroupId: yearGroupId,
          userId: userId
        }
      });
      if (prompt) {
        await prompt.destroy();
        res.sendStatus(204);
      } else {
        sendError(res, 404, 'Prompt not found');
      }
    } catch (error) {
      console.error('Error deleting prompt:', error);
      sendError(res, 500, 'Error deleting prompt');
    }
  });

  app.get('/api/prompts', async (req, res) => {
    const { subjectId, yearGroupId } = req.query;
    const userId = req.session.user?.id;
    try {
      if (subjectId && yearGroupId && userId) {
        const prompt = await Prompt.findOne({
          where: {
            subjectId: subjectId,
            yearGroupId: yearGroupId,
            userId: userId
          }
        });
        res.type('text/plain');
        res.send(prompt ? prompt.promptPart : '');
        return;
      }

      const prompts = await Prompt.findAll();
      res.json(prompts);
    } catch (error) {
      console.error('Error fetching prompts:', error);
      sendError(res, 500, 'Error fetching prompts');
    }
  });

  app.get('/api/prompts/:subjectId/:yearGroupId', async (req, res) => {
    const { subjectId, yearGroupId } = req.params;
    const userId = req.session.user.id;
    try {
      const prompt = await Prompt.findOne({
        where: {
          subjectId: subjectId,
          yearGroupId: yearGroupId,
          userId: userId
        }
      });
      res.json(prompt ? prompt.promptPart : '');
    } catch (error) {
      console.error('Error fetching prompt:', error);
      sendError(res, 500, 'Error fetching prompt');
    }
  });

  app.get('/api/export-categories-comments', async (req, res) => {
    const { subjectId, yearGroupId } = req.query;
    const userId = req.session.user.id;
    try {
      const categories = await Category.findAll({
        where: {
          subjectId,
          yearGroupId,
          userId
        },
        include: [Comment]
      });

      const data = categories.flatMap(category => {
        return category.Comments.map(comment => ({
          categoryName: category.name,
          commentText: comment.text ? comment.text.replace(/\s+/g, ' ').trim() : ''
        }));
      });

      const json2csvParser = new Parser({ fields: ['categoryName', 'commentText'] });
      const csvText = json2csvParser.parse(data);

      res.header('Content-Type', 'text/csv');
      res.attachment(`categories-comments-${subjectId}-${yearGroupId}.csv`);
      res.send(csvText);
    } catch (error) {
      console.error('Error exporting categories and comments:', error);
      sendError(res, 500, 'Error exporting categories and comments');
    }
  });

  app.get('/api/users', isAdmin, async (req, res) => {
    try {
      const users = await User.findAll({
        attributes: ['id', 'username', 'isAdmin']
      });
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      sendError(res, 500, 'Error fetching users');
    }
  });

  app.post('/api/users', isAdmin, async (req, res) => {
    await createManagedUser(req, res, 'User added successfully');
  });

  app.delete('/api/users/:username', isAdmin, async (req, res) => {
    const { username } = req.params;
    try {
      const user = await User.findOne({ where: { username } });
      if (user) {
        await user.destroy();
        res.sendStatus(204);
      } else {
        sendError(res, 404, 'User not found');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      sendError(res, 500, 'Error deleting user');
    }
  });

  app.get('/api/export-database', isAdmin, async (req, res) => {
    if (!config.backup.enabled) {
      return sendError(res, 403, 'Database export disabled');
    }
    try {
      const filePath = await exportDatabase();
      res.download(filePath, 'database-backup.sql');
    } catch (error) {
      console.error('Error exporting database:', error);
      sendError(res, 500, 'Error exporting database');
    }
  });

  app.post('/api/backup-database', isAdmin, async (req, res) => {
    if (!config.backup.enabled) {
      return res.status(403).json({ message: 'Database backup disabled' });
    }
    try {
      await backupDatabase();
      res.json({ message: 'Database backup created successfully' });
    } catch (error) {
      console.error('Error creating database backup:', error);
      sendError(res, 500, 'Error creating database backup');
    }
  });

  app.put('/api/admin/user/:username/password', isAdmin, async (req, res) => {
    const { username } = req.params;
    const { newPassword } = req.body;
    if (typeof newPassword !== 'string' || !newPassword.trim()) {
      return res.status(400).json({ message: 'New password is required.' });
    }

    try {
      const user = await User.findOne({ where: { username } });
      if (user) {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();
        res.json({ message: 'Password updated successfully' });
      } else {
        sendError(res, 404, 'User not found');
      }
    } catch (error) {
      console.error('Error updating password:', error);
      sendError(res, 500, 'Error updating password');
    }
  });

  app.post('/api/import-categories-comments', upload.single('file'), async (req, res) => {
    const { subjectId, yearGroupId } = req.body;
    const userId = req.session.user.id;
    const filePath = req.file?.path;

    if (!subjectId || !yearGroupId) {
      return sendError(res, 400, 'Missing subjectId or yearGroupId');
    }

    if (!req.file) {
      return sendError(res, 400, 'No file uploaded');
    }

    try {
      const { categories, skippedRows } = await parseCategoryCsvFile(filePath);
      const totals = await replaceCategoryBankFromArrays({
        categories,
        subjectId,
        yearGroupId,
        userId
      });

      res.json({
        message: 'Categories and comments imported successfully.',
        ...totals,
        skippedRows
      });
    } catch (error) {
      console.error('Error importing categories and comments:', error);
      sendError(res, 500, 'Error importing categories and comments');
    } finally {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  });

  app.post('/api/user-subjects', isAuthenticated, async (req, res) => {
    const { subjectId, selected } = req.body;
    const userId = req.session.user.id;
    try {
      if (selected) {
        await UserSubject.findOrCreate({ where: { userId, subjectId } });
      } else {
        await UserSubject.destroy({ where: { userId, subjectId } });
      }
      res.json({ message: 'User subject updated successfully' });
    } catch (error) {
      console.error('Error updating user subject:', error);
      sendError(res, 500, 'Error updating user subject');
    }
  });

  app.post('/api/user-year-groups', isAuthenticated, async (req, res) => {
    const { yearGroupId, selected } = req.body;
    const userId = req.session.user.id;
    try {
      if (selected) {
        await UserYearGroup.findOrCreate({ where: { userId, yearGroupId } });
      } else {
        await UserYearGroup.destroy({ where: { userId, yearGroupId } });
      }
      res.json({ message: 'User year group updated successfully' });
    } catch (error) {
      console.error('Error updating user year group:', error);
      sendError(res, 500, 'Error updating user year group');
    }
  });

  app.get('/api/user-settings', isAuthenticated, async (req, res) => {
    const userId = req.session.user.id;
    try {
      const userSubjects = await UserSubject.findAll({ where: { userId } });
      const userYearGroups = await UserYearGroup.findAll({ where: { userId } });
      res.json({ userSubjects, userYearGroups });
    } catch (error) {
      console.error('Error fetching user settings:', error);
      sendError(res, 500, 'Error fetching user settings');
    }
  });

  app.get('/api/user-selected-settings', isAuthenticated, async (req, res) => {
    const userId = req.session.user.id;
    try {
      const userSubjects = await UserSubject.findAll({
        where: { userId },
        include: [{ model: Subject }]
      });

      const userYearGroups = await UserYearGroup.findAll({
        where: { userId },
        include: [{ model: YearGroup }]
      });

      res.json({ userSubjects, userYearGroups });
    } catch (error) {
      console.error('Error fetching user settings:', error);
      sendError(res, 500, 'Error fetching user settings');
    }
  });

  app.post('/api/change-password', isAuthenticated, async (req, res) => {
    const { oldPassword, currentPassword, newPassword } = req.body;
    const userId = req.session.user.id;
    try {
      const suppliedOldPassword = oldPassword ?? currentPassword;
      const user = await User.findByPk(userId);
      if (user && await bcrypt.compare(suppliedOldPassword, user.password)) {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();
        res.json({ message: 'Password changed successfully' });
      } else {
        res.status(401).json({ message: 'Incorrect old password' });
      }
    } catch (error) {
      console.error('Error changing password:', error);
      sendError(res, 500, 'Error changing password');
    }
  });
}
