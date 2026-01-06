import crypto from 'crypto';
import bcrypt from 'bcrypt';
import csv from 'csv-parser';
import fs from 'fs';
import multer from 'multer';
import { Parser } from 'json2csv';
import { isAuthenticated, isAdmin } from '../middleware/auth.js';
import { exportDatabase, backupDatabase } from '../services/dbBackup.js';
import { config } from '../config/env.js';
import { sequelize } from '../db/sequelize.js';

const upload = multer({ dest: 'uploads/' });

const cleanText = (text) => (text ? text.replace(/\s+/g, ' ').trim() : '');
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
    UserSubject,
    UserYearGroup
  } = models;

  app.use('/api/subjects', isAuthenticated);
  app.use('/api/year-groups', isAuthenticated);
  app.use('/api/categories-comments', isAuthenticated);
  app.use('/generate-report', isAuthenticated);
  app.use('/api/comments', isAuthenticated);
  app.use('/api/move-comment', isAuthenticated);
  app.use('/api/prompts', isAuthenticated);
  app.use('/api/export-categories-comments', isAuthenticated);
  app.use('/api/import-categories-comments', isAuthenticated);
  app.use('/api/import-reports', isAuthenticated);

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
      const yearGroup = await YearGroup.create({ name });
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
      const subject = await Subject.create({ name });
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
      const subject = await Subject.create({ name });
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
      const subject = await Subject.findByPk(id);
      if (subject) {
        subject.name = name;
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
      const yearGroup = await YearGroup.create({ name });
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
      const yearGroup = await YearGroup.findByPk(id);
      if (yearGroup) {
        yearGroup.name = name;
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
      const category = await Category.create({ name, subjectId, yearGroupId, userId });
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
      const category = await Category.findByPk(id);
      if (category) {
        category.name = name;
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
      const comment = await Comment.create({ text, categoryId });
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
      const comment = await Comment.findByPk(id);
      if (comment) {
        comment.text = text;
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
    const { name, pronouns, subjectId, yearGroupId, additionalComments, ...categories } = req.body;
    const userId = req.session.user.id;

    try {
      const promptPart = await Prompt.findOne({
        where: {
          subjectId: subjectId,
          yearGroupId: yearGroupId,
          userId: userId
        }
      });

      let prompt = promptPart ? promptPart.promptPart : 'Generate a concise school report for a pupil. This is for school lessons and I would like it to be friendly and formal. I would like it to be between 100 and 170 words long and flow nicely with no repetition. Below are categories and comments to base the report on. There should be no headings on the report. It could have up to 3 paragraphs if necessary';
      const placeholder = 'PUPIL_NAME';
      prompt += `\nI am using the following placeholder for a name: ${placeholder} the pronouns for this pupil are (${pronouns})\n`;

      for (const [category, comment] of Object.entries(categories)) {
        if (comment) {
          prompt += `${category.replace(/-/g, ' ')}: ${comment}\n`;
        }
      }

      if (additionalComments) {
        prompt += `The following additional comments should be woven into the whole report: ${additionalComments}\n`;
      }

      const response = await openai.responses.create({
        ...buildOpenAIParams(req),
        input: [{ role: 'user', content: prompt }],
        max_output_tokens: 700,
        temperature: 0.7
      });
      logRequestId(response, 'generate-report');

      const reportText = response.output_text?.trim() || '';
      if (!reportText) {
        return res.status(500).send('Error generating report');
      }

      let report = reportText;
      report = report.replace(new RegExp(placeholder, 'g'), name);

      res.json({ report });
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
      const namesArray = (pupilNames || '')
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean);
      let reportsWithPlaceholder = reports || '';

      namesArray.forEach((name) => {
        const regex = new RegExp(`\\b${name}\\b`, 'g');
        reportsWithPlaceholder = reportsWithPlaceholder.replace(regex, placeholder);
      });

      const extractionPrompt = `
Please analyze the following school reports and extract relevant categories and comments that can be used to generate future student reports.
- No more than 8 categories; merge similar categories.
- No more than 8 comments per category; merge or remove similar comments.
- Include a 'Targets' category with specific, actionable targets; the final target must be "***Generate a target for this pupil and add to the report***".
- Order comments from least able to most able; cover a range of abilities/behaviors.

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

        const mergePrompt = `I have two sets of categories and comments for student reports. Merge them, ensuring no more than 8 categories and no more than 8 comments per category. If categories are similar, merge them. Prioritize clarity and conciseness. Keep the order of comments (ordered by ability/behaviour) and give priority to the New categories and comments.\n\nExisting categories and comments:\n${JSON.stringify(existingCategoryPayload, null, 2)}\n\nNew categories and comments:\n${JSON.stringify(serializeCategoryMap(newCategories), null, 2)}\n`;

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

  app.post('/api/prompts', async (req, res) => {
    const { subjectId, yearGroupId, promptPart } = req.body;
    const userId = req.session.user.id;
    try {
      const [prompt, created] = await Prompt.findOrCreate({
        where: {
          subjectId: subjectId,
          yearGroupId: yearGroupId,
          userId: userId
        },
        defaults: {
          promptPart: promptPart
        }
      });

      if (!created) {
        prompt.promptPart = promptPart;
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
      const prompt = await Prompt.findOne({
        where: {
          subjectId: subjectId,
          yearGroupId: yearGroupId,
          userId: userId
        }
      });
      if (prompt) {
        prompt.promptPart = promptPart;
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
      const prompt = await Prompt.findByPk(id);
      if (prompt) {
        prompt.promptPart = promptPart;
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

    try {
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => {
            const categoryName = data['categoryName'];
            const commentText = cleanText(data['commentText']);

            if (!categories[categoryName]) {
              categories[categoryName] = [];
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

      res.json({ message: 'Categories and comments imported successfully.' });
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
