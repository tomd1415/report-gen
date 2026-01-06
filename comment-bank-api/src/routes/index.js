import crypto from 'crypto';
import bcrypt from 'bcrypt';
import csv from 'csv-parser';
import fs from 'fs';
import multer from 'multer';
import { Parser } from 'json2csv';
import rateLimit from 'express-rate-limit';
import { isAuthenticated, isAdmin } from '../middleware/auth.js';
import { exportDatabase, backupDatabase } from '../services/dbBackup.js';
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
  maxCommentsPerCategory: 50
};

const UPLOAD_LIMIT_BYTES = 5 * 1024 * 1024;
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: UPLOAD_LIMIT_BYTES }
});

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

const buildOpenAIParams = (req) => ({
  model: config.openai.model,
  reasoning: { effort: config.openai.reasoningEffort },
  store: false,
  safety_identifier: getSafetyIdentifier(req)
});

export function registerRoutes(app, { models, openai }) {
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

  app.use('/api/subjects', isAuthenticated);
  app.use('/api/year-groups', isAuthenticated);
  app.use('/api/categories-comments', isAuthenticated);
  app.use('/generate-report', isAuthenticated, openAiLimiter);
  app.use('/api/comments', isAuthenticated);
  app.use('/api/move-comment', isAuthenticated);
  app.use('/api/prompts', isAuthenticated);
  app.use('/api/subject-context', isAuthenticated);
  app.use('/api/export-categories-comments', isAuthenticated);
  app.use('/api/import-categories-comments', isAuthenticated);
  app.use('/api/import-reports', isAuthenticated, openAiLimiter);

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
      res.status(500).send('Error fetching user info');
    }
  });

  app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.create({ username, password: hashedPassword });
      res.json({ message: 'User registered successfully', user });
    } catch (error) {
      console.error('Error registering user:', error);
      res.status(500).send('Error registering user');
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
      res.status(500).send('Error logging in');
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
      res.status(500).send('Error logging in');
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
      res.status(500).send('Error creating year group');
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
        res.status(404).send('Year group not found');
      }
    } catch (error) {
      console.error('Error deleting year group:', error);
      res.status(500).send('Error deleting year group');
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
      res.status(500).send('Error creating subject');
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
        res.status(404).send('Subject not found');
      }
    } catch (error) {
      console.error('Error deleting subject:', error);
      res.status(500).send('Error deleting subject');
    }
  });

  app.post('/api/admin/user', isAdmin, async (req, res) => {
    const { username, password, isAdmin: newAdmin } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.create({ username, password: hashedPassword, isAdmin: newAdmin });
      res.json(user);
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).send('Error creating user');
    }
  });

  app.delete('/api/admin/user/:username', isAdmin, async (req, res) => {
    const { username } = req.params;
    try {
      const user = await User.findOne({ where: { username } });
      if (user) {
        await user.destroy();
        res.sendStatus(204);
      } else {
        res.status(404).send('User not found');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).send('Error deleting user');
    }
  });

  app.get('/api/admin/export', isAdmin, async (req, res) => {
    if (!config.backup.enabled) {
      return res.status(403).send('Database export disabled');
    }
    try {
      const filePath = await exportDatabase();
      res.download(filePath);
    } catch (error) {
      console.error('Error exporting database:', error);
      res.status(500).send('Error exporting database');
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
      res.status(500).send('Error backing up database');
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
      res.status(500).send('Error creating subject');
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
        res.status(404).send('Subject not found');
      }
    } catch (error) {
      console.error('Error updating subject:', error);
      res.status(500).send('Error updating subject');
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
        res.status(404).send('Subject not found');
      }
    } catch (error) {
      console.error('Error deleting subject:', error);
      res.status(500).send('Error deleting subject');
    }
  });

  app.get('/api/subjects', async (req, res) => {
    try {
      const subjects = await Subject.findAll();
      res.json(subjects);
    } catch (error) {
      console.error('Error fetching subjects:', error);
      res.status(500).send('Error fetching subjects');
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
      res.status(500).send('Error creating year group');
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
        res.status(404).send('Year group not found');
      }
    } catch (error) {
      console.error('Error updating year group:', error);
      res.status(500).send('Error updating year group');
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
        res.status(404).send('Year group not found');
      }
    } catch (error) {
      console.error('Error deleting year group:', error);
      res.status(500).send('Error deleting year group');
    }
  });

  app.get('/api/year-groups', async (req, res) => {
    try {
      const yearGroups = await YearGroup.findAll();
      res.json(yearGroups);
    } catch (error) {
      console.error('Error fetching year groups:', error);
      res.status(500).send('Error fetching year groups');
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
      res.status(500).send('Error creating category');
    }
  });

  app.put('/api/categories/:id', async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    try {
      const cleanedName = cleanText(name);
      if (!cleanedName) {
        return res.status(400).json({ message: 'Category name is required.' });
      }
      if (cleanedName.length > LIMITS.categoryName) {
        return res.status(400).json({ message: `Category name must be ${LIMITS.categoryName} characters or fewer.` });
      }
      const category = await Category.findByPk(id);
      if (category) {
        category.name = cleanedName;
        await category.save();
        res.json(category);
      } else {
        res.status(404).send('Category not found');
      }
    } catch (error) {
      console.error('Error updating category:', error);
      res.status(500).send('Error updating category');
    }
  });

  app.delete('/api/categories/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const category = await Category.findByPk(id);
      if (category) {
        await category.destroy();
        res.sendStatus(204);
      } else {
        res.status(404).send('Category not found');
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      res.status(500).send('Error deleting category');
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
      res.status(500).send('Error fetching categories and comments');
    }
  });

  app.get('/api/categories/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const category = await Category.findByPk(id, { include: [Comment] });
      if (category) {
        res.json(category);
      } else {
        res.status(404).send('Category not found');
      }
    } catch (error) {
      console.error('Error fetching category:', error);
      res.status(500).send('Error fetching category');
    }
  });

  app.post('/api/comments', async (req, res) => {
    const { text, categoryId } = req.body;
    try {
      const cleanedText = cleanText(text);
      if (!cleanedText) {
        return res.status(400).json({ message: 'Comment text is required.' });
      }
      if (cleanedText.length > LIMITS.commentText) {
        return res.status(400).json({ message: `Comment must be ${LIMITS.commentText} characters or fewer.` });
      }
      const comment = await Comment.create({ text: cleanedText, categoryId });
      res.json(comment);
    } catch (error) {
      console.error('Error creating comment:', error);
      res.status(500).send('Error creating comment');
    }
  });

  app.put('/api/comments/:id', async (req, res) => {
    const { id } = req.params;
    const { text } = req.body;
    try {
      const cleanedText = cleanText(text);
      if (!cleanedText) {
        return res.status(400).json({ message: 'Comment text is required.' });
      }
      if (cleanedText.length > LIMITS.commentText) {
        return res.status(400).json({ message: `Comment must be ${LIMITS.commentText} characters or fewer.` });
      }
      const comment = await Comment.findByPk(id);
      if (comment) {
        comment.text = cleanedText;
        await comment.save();
        res.json(comment);
      } else {
        res.status(404).send('Comment not found');
      }
    } catch (error) {
      console.error('Error updating comment:', error);
      res.status(500).send('Error updating comment');
    }
  });

  app.delete('/api/comments/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const comment = await Comment.findByPk(id);
      if (comment) {
        await comment.destroy();
        res.sendStatus(204);
      } else {
        res.status(404).send('Comment not found');
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      res.status(500).send('Error deleting comment');
    }
  });

  app.get('/api/comments', async (req, res) => {
    const { categoryId } = req.query;
    try {
      const comments = await Comment.findAll({
        where: { categoryId }
      });
      res.json(comments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      res.status(500).send('Error fetching comments');
    }
  });

  app.get('/api/comments/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const comment = await Comment.findByPk(id);
      if (comment) {
        res.json(comment);
      } else {
        res.status(404).send('Comment not found');
      }
    } catch (error) {
      console.error('Error fetching comment:', error);
      res.status(500).send('Error fetching comment');
    }
  });

  app.post('/api/move-comment', async (req, res) => {
    const { commentId, newCategoryId } = req.body;
    try {
      const comment = await Comment.findByPk(commentId);
      if (comment) {
        comment.categoryId = newCategoryId;
        await comment.save();
        res.json(comment);
      } else {
        res.status(404).send('Comment not found');
      }
    } catch (error) {
      console.error('Error moving comment:', error);
      res.status(500).send('Error moving comment');
    }
  });

  app.post('/generate-report', async (req, res) => {
    const { name, pronouns, subjectId, yearGroupId, additionalComments, wordLimit, ...categories } = req.body;
    const userId = req.session.user.id;
    const safeName = cleanText(name);
    const safePronouns = cleanText(pronouns);
    const cleanedAdditionalComments = cleanText(additionalComments);

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
        prompt += `Subject description (context only; do not repeat in the report): ${subjectDescription}\n`;
      }

      prompt += `Report requirements:\n- Exactly 4 paragraphs.\n- Paragraph 1: Topics / areas studied so far. Key knowledge and skills acquired (do not repeat the subject description).\n- Paragraph 2: Effort / motivation / attendance to lesson.\n- Paragraph 3: Strengths and particular achievements.\n- Paragraph 4: Areas of development to bolster the pupil's progress and achieve end of year Teacher Target.\n- No headings or bullet points.\n`;

      if (effectiveWordLimit) {
        prompt += `Target length: about ${effectiveWordLimit} words total.\n`;
      } else {
        prompt += 'Keep it concise and avoid repetition.\n';
      }

      for (const [category, comment] of Object.entries(categories)) {
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
        }
        if (cleanedSelections.length > 0) {
          prompt += `${category.replace(/-/g, ' ')}: ${cleanedSelections.join('; ')}\n`;
        }
      }

      if (cleanedAdditionalComments) {
        prompt += `The following additional comments should be woven into the whole report: ${cleanedAdditionalComments}\n`;
      }

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

      const parsed = response.output_parsed || {};
      let paragraphs = Array.isArray(parsed.paragraphs) ? parsed.paragraphs : [];

      if (paragraphs.length !== 4) {
        const fallbackText = response.output_text?.trim() || '';
        if (fallbackText) {
          paragraphs = fallbackText.split(/\n\s*\n/).map((text) => cleanText(text)).filter(Boolean);
        }
      }

      if (paragraphs.length === 0) {
        return res.status(500).send('Error generating report');
      }

      const finalParagraphs = paragraphs.map((paragraph) =>
        paragraph.replace(new RegExp(placeholder, 'g'), safeName)
      );
      const report = finalParagraphs.join('\n\n');

      res.json({ report, paragraphs: finalParagraphs });
    } catch (error) {
      console.error('Error generating report:', error);
      res.status(500).send('Error generating report');
    }
  });

  app.post('/api/import-reports', async (req, res) => {
    const { subjectId, yearGroupId, pupilNames, reports } = req.body;
    const userId = req.session.user.id;

    try {
      const placeholder = 'PUPIL_NAME';
      const safePupilNames = typeof pupilNames === 'string' ? pupilNames.trim() : '';
      const safeReports = typeof reports === 'string' ? reports.trim() : '';

      if (!safeReports) {
        return res.status(400).json({ message: 'Reports are required.' });
      }
      if (safePupilNames.length > LIMITS.pupilNames) {
        return res.status(400).json({ message: `Pupil names must be ${LIMITS.pupilNames} characters or fewer.` });
      }
      if (safeReports.length > LIMITS.reports) {
        return res.status(400).json({ message: `Reports must be ${LIMITS.reports} characters or fewer.` });
      }

      const namesArray = safePupilNames
        .split(',')
        .map((name) => cleanText(name))
        .filter((name) => name && name.length <= LIMITS.name);
      let reportsWithPlaceholder = safeReports;

      namesArray.forEach((name) => {
        const regex = new RegExp(`\\b${escapeRegex(name)}\\b`, 'g');
        reportsWithPlaceholder = reportsWithPlaceholder.replace(regex, placeholder);
      });

      const extractionPrompt = `
Please analyze the following school reports and extract relevant categories and comments that can be used to generate future student reports.
Rules:
- Use no more than 5 categories aligned to the report structure:
  1) Topics studied / knowledge / skills acquired
  2) Effort / motivation / attendance
  3) Strengths / achievements
  4) Areas for development / targets toward end-of-year Teacher Target
  5) General / Other (only for comments that do not fit above)
- Use the category names above (shorten slightly if needed but keep clear alignment).
- No more than 8 comments per category; merge or remove similar comments.
- Keep each comment concise and standalone (aim for 12 words or fewer).
- Order comments from least able to most able; cover a range of abilities/behaviours.
- Include a comment in the "Areas for development / targets toward end-of-year Teacher Target" category that is exactly: "***Generate a target for this pupil and add to the report***".

Reports:
${reportsWithPlaceholder}
`;

      const extractResponse = await openai.responses.parse({
        ...buildOpenAIParams(req),
        input: [{ role: 'user', content: extractionPrompt }],
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
      const newCategories = normalizeCategories(extracted.categories || []);

      const existingCategories = await Category.findAll({
        where: { subjectId, yearGroupId, userId },
        include: [Comment]
      });

      if (existingCategories.length > 0) {
        const existingCategoryPayload = existingCategories.map((category) => ({
          name: category.name,
          comments: category.Comments.map((comment) => cleanText(comment.text)).filter(Boolean)
        }));

        const mergePrompt = `I have two sets of categories and comments for student reports. Merge them into a single set aligned to the report structure.
Rules:
- Use no more than 5 categories aligned to:
  1) Topics studied / knowledge / skills acquired
  2) Effort / motivation / attendance
  3) Strengths / achievements
  4) Areas for development / targets toward end-of-year Teacher Target
  5) General / Other (only for comments that do not fit above)
- If categories are similar, merge them. Use the category names above (shorten slightly if needed but keep clear alignment).
- No more than 8 comments per category; merge or remove similar comments.
- Keep each comment concise and standalone (aim for 12 words or fewer).
- Keep comments ordered from least able to most able.
- Include a comment in the "Areas for development / targets toward end-of-year Teacher Target" category that is exactly: "***Generate a target for this pupil and add to the report***".
- Give priority to the New categories and comments.

Existing categories and comments:
${JSON.stringify(existingCategoryPayload, null, 2)}

New categories and comments:
${JSON.stringify(serializeCategoryMap(newCategories), null, 2)}
`;

        const mergeResponse = await openai.responses.parse({
          ...buildOpenAIParams(req),
          input: [{ role: 'user', content: mergePrompt }],
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
        const mergedCategories = normalizeCategories(mergedParsed.categories || []);

        await Category.destroy({ where: { subjectId, yearGroupId, userId } });

        for (const [categoryName, comments] of Object.entries(mergedCategories)) {
          const category = await Category.create({ name: categoryName, subjectId, yearGroupId, userId });
          for (const comment of comments) {
            await Comment.create({ text: comment, categoryId: category.id });
          }
        }
      } else {
        for (const [categoryName, comments] of Object.entries(newCategories)) {
          const category = await Category.create({ name: categoryName, subjectId, yearGroupId, userId });
          for (const comment of comments) {
            await Comment.create({ text: comment, categoryId: category.id });
          }
        }
      }

      res.json({ message: 'Reports imported successfully and categories/comments generated.' });
    } catch (error) {
      console.error('Error importing reports:', error);
      res.status(500).send('Error importing reports');
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
      res.status(500).send('Error fetching subject context');
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
      res.status(500).send('Error saving subject context');
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
      res.status(500).send('Error creating or updating prompt');
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
        res.status(404).send('Prompt not found');
      }
    } catch (error) {
      console.error('Error updating prompt:', error);
      res.status(500).send('Error updating prompt');
    }
  });

  app.put('/api/prompts/:id', async (req, res) => {
    const { id } = req.params;
    const { promptPart } = req.body;
    try {
      const trimmedPrompt = typeof promptPart === 'string' ? promptPart.trim() : '';
      if (trimmedPrompt.length > LIMITS.promptPart) {
        return res.status(400).json({ message: `Prompt text must be ${LIMITS.promptPart} characters or fewer.` });
      }
      const prompt = await Prompt.findByPk(id);
      if (prompt) {
        prompt.promptPart = trimmedPrompt;
        await prompt.save();
        res.json(prompt);
      } else {
        res.status(404).send('Prompt not found');
      }
    } catch (error) {
      console.error('Error updating prompt:', error);
      res.status(500).send('Error updating prompt');
    }
  });

  app.delete('/api/prompts/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const prompt = await Prompt.findByPk(id);
      if (prompt) {
        await prompt.destroy();
        res.sendStatus(204);
      } else {
        res.status(404).send('Prompt not found');
      }
    } catch (error) {
      console.error('Error deleting prompt:', error);
      res.status(500).send('Error deleting prompt');
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
        res.status(404).send('Prompt not found');
      }
    } catch (error) {
      console.error('Error deleting prompt:', error);
      res.status(500).send('Error deleting prompt');
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
      res.status(500).send('Error fetching prompts');
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
      res.status(500).send('Error fetching prompt');
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
      res.status(500).send('Error exporting categories and comments');
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
      res.status(500).send('Error fetching users');
    }
  });

  app.post('/api/users', isAdmin, async (req, res) => {
    const { username, password, isAdmin: newAdmin } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.create({ username, password: hashedPassword, isAdmin: newAdmin });
      res.json({ message: 'User added successfully', user });
    } catch (error) {
      console.error('Error adding user:', error);
      res.status(500).send('Error adding user');
    }
  });

  app.delete('/api/users/:username', isAdmin, async (req, res) => {
    const { username } = req.params;
    try {
      const user = await User.findOne({ where: { username } });
      if (user) {
        await user.destroy();
        res.sendStatus(204);
      } else {
        res.status(404).send('User not found');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).send('Error deleting user');
    }
  });

  app.get('/api/export-database', isAdmin, async (req, res) => {
    if (!config.backup.enabled) {
      return res.status(403).send('Database export disabled');
    }
    try {
      const filePath = await exportDatabase();
      res.download(filePath, 'database-backup.sql');
    } catch (error) {
      console.error('Error exporting database:', error);
      res.status(500).send('Error exporting database');
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
      res.status(500).send('Error creating database backup');
    }
  });

  app.put('/api/admin/user/:username/password', isAdmin, async (req, res) => {
    const { username } = req.params;
    const { newPassword } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const user = await User.findOne({ where: { username } });
      if (user) {
        user.password = hashedPassword;
        await user.save();
        res.json({ message: 'Password updated successfully' });
      } else {
        res.status(404).send('User not found');
      }
    } catch (error) {
      console.error('Error updating password:', error);
      res.status(500).send('Error updating password');
    }
  });

  app.post('/api/import-categories-comments', upload.single('file'), async (req, res) => {
    const { subjectId, yearGroupId } = req.body;
    const userId = req.session.user.id;
    const filePath = req.file?.path;

    if (!subjectId || !yearGroupId) {
      return res.status(400).send('Missing subjectId or yearGroupId');
    }

    if (!req.file) {
      return res.status(400).send('No file uploaded');
    }

    const categories = {};
    let skippedRows = 0;

    try {
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

      await sequelize.transaction(async (transaction) => {
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

      const totalCategories = Object.keys(categories).length;
      const totalComments = Object.values(categories).reduce((sum, comments) => sum + comments.length, 0);
      res.json({
        message: 'Categories and comments imported successfully.',
        totalCategories,
        totalComments,
        skippedRows
      });
    } catch (error) {
      console.error('Error importing categories and comments:', error);
      res.status(500).send('Error importing categories and comments');
    } finally {
      fs.unlinkSync(filePath);
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
      res.status(500).send('Error updating user subject');
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
      res.status(500).send('Error updating user year group');
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
      res.status(500).send('Error fetching user settings');
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
      res.status(500).send('Error fetching user settings');
    }
  });

  app.post('/api/change-password', isAuthenticated, async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const userId = req.session.user.id;
    try {
      const user = await User.findByPk(userId);
      if (user && await bcrypt.compare(oldPassword, user.password)) {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();
        res.json({ message: 'Password changed successfully' });
      } else {
        res.status(401).json({ message: 'Incorrect old password' });
      }
    } catch (error) {
      console.error('Error changing password:', error);
      res.status(500).send('Error changing password');
    }
  });
}
