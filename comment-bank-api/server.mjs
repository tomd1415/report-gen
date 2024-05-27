import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { Sequelize, DataTypes } from 'sequelize';

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'public')));

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: 'sk-proj-NRXojKZoTDvNsFuhUH8WT3BlbkFJCbb0Gup2YMFD3iq8lRVS'
});

// Initialize Sequelize with IPv4 address
const sequelize = new Sequelize('comment_bank', 'root', 'exhall2024', {
  host: '127.0.0.1',
  dialect: 'mariadb',
  logging: console.log
});

const Subject = sequelize.define('Subject', {
  name: {
      type: DataTypes.STRING,
      allowNull: false
  }
}, {
  timestamps: false
});

const YearGroup = sequelize.define('YearGroup', {
  name: {
      type: DataTypes.STRING,
      allowNull: false
  }
}, {
  timestamps: false
});

const Category = sequelize.define('Category', {
  name: {
      type: DataTypes.STRING,
      allowNull: false
  },
  subjectId: {
      type: DataTypes.INTEGER,
      references: {
          model: Subject,
          key: 'id'
      }
  },
  yearGroupId: {
      type: DataTypes.INTEGER,
      references: {
          model: YearGroup,
          key: 'id'
      }
  }
}, {
  timestamps: false
});

const Comment = sequelize.define('Comment', {
  text: {
      type: DataTypes.TEXT,
      allowNull: false
  },
  categoryId: {
      type: DataTypes.INTEGER,
      references: {
          model: Category,
          key: 'id'
      }
  }
}, {
  timestamps: false
});

const Prompt = sequelize.define('Prompt', {
  subjectId: {
      type: DataTypes.INTEGER,
      references: {
          model: Subject,
          key: 'id'
      }
  },
  yearGroupId: {
      type: DataTypes.INTEGER,
      references: {
          model: YearGroup,
          key: 'id'
      }
  },
  promptPart: {
      type: DataTypes.TEXT,
      allowNull: false
  }
}, {
  timestamps: false
});

// Define associations
Subject.hasMany(Category, { foreignKey: 'subjectId' });
YearGroup.hasMany(Category, { foreignKey: 'yearGroupId' });
Category.belongsTo(Subject, { foreignKey: 'subjectId' });
Category.belongsTo(YearGroup, { foreignKey: 'yearGroupId' });

Category.hasMany(Comment, { foreignKey: 'categoryId' });
Comment.belongsTo(Category, { foreignKey: 'categoryId' });

Subject.hasMany(Prompt, { foreignKey: 'subjectId' });
YearGroup.hasMany(Prompt, { foreignKey: 'yearGroupId' });
Prompt.belongsTo(Subject, { foreignKey: 'subjectId' });
Prompt.belongsTo(YearGroup, { foreignKey: 'yearGroupId' });


sequelize.sync({ force: false }).then(() => {
  console.log('Database & tables created!');

  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}).catch(err => {
  console.error('Error syncing database:', err);
});

// CRUD operations for Subjects
// Create a new subject
app.post('/api/subjects', async (req, res) => {
  const { name } = req.body;
  try {
      const subject = await Subject.create({ name });
      res.json(subject);
  } catch (error) {
      console.error('Error creating subject:', error);
      res.status(500).send('Error creating subject');
  }
});

// Update an existing subject
app.put('/api/subjects/:id', async (req, res) => {
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

// Delete a subject
app.delete('/api/subjects/:id', async (req, res) => {
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

// Fetch all subjects
app.get('/api/subjects', async (req, res) => {
  try {
      const subjects = await Subject.findAll();
      res.json(subjects);
  } catch (error) {
      console.error('Error fetching subjects:', error);
      res.status(500).send('Error fetching subjects');
  }
});


// CRUD operations for YearGroups
// Create a new year group
app.post('/api/year-groups', async (req, res) => {
  const { name } = req.body;
  try {
      const yearGroup = await YearGroup.create({ name });
      res.json(yearGroup);
  } catch (error) {
      console.error('Error creating year group:', error);
      res.status(500).send('Error creating year group');
  }
});

// Update an existing year group
app.put('/api/year-groups/:id', async (req, res) => {
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

// Delete a year group
app.delete('/api/year-groups/:id', async (req, res) => {
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

// Fetch all year groups
app.get('/api/year-groups', async (req, res) => {
  try {
      const yearGroups = await YearGroup.findAll();
      res.json(yearGroups);
  } catch (error) {
      console.error('Error fetching year groups:', error);
      res.status(500).send('Error fetching year groups');
  }
});


// CRUD operations for Categories
// Create a new category
app.post('/api/categories', async (req, res) => {
  const { name, subjectId, yearGroupId } = req.body;
  try {
      const category = await Category.create({ name, subjectId, yearGroupId });
      res.json(category);
  } catch (error) {
      console.error('Error creating category:', error);
      res.status(500).send('Error creating category');
  }
});

// Update an existing category
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

// Delete a category
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

// Fetch categories and their associated comments based on subject and year group
app.get('/api/categories-comments', async (req, res) => {
  const { subjectId, yearGroupId } = req.query;
  try {
      const categories = await Category.findAll({
          where: {
              subjectId,
              yearGroupId
          },
          include: [Comment]
      });
      res.json(categories);
  } catch (error) {
      console.error('Error fetching categories and comments:', error);
      res.status(500).send('Error fetching categories and comments');
  }
});


// CRUD operations for Comments
// Create a new comment
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

// Update an existing comment
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

// Delete a comment
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

// Move a comment to a different category
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

//---------------added-----------------------------///

// Endpoint to fetch categories and their associated comments based on subject and year group


//-------------added-------------------------------//

// Endpoint to fetch categories and their associated comments based on subject and year group
// Endpoint to generate report
app.post('/generate-report', async (req, res) => {
  const { name, pronouns, subjectId, yearGroupId, additionalComments, ...categories } = req.body;

  try {
      const promptPart = await Prompt.findOne({
          where: {
              subjectId: subjectId,
              yearGroupId: yearGroupId
          }
      });

      let prompt = promptPart ? promptPart.promptPart : 'Generate a consise school report for a pupil. This is for Computing lessons and I would like it to be friendly and formal. I would like it to be between 100 and 170 words long and flow nicley with no repetition. Below are categories and comments to base the report on. There should be no headings on the report. It could have up to 3 paragraphs in necessary';
      const placeholder = 'PUPIL_NAME';
      prompt += `\nName: ${placeholder} (${pronouns})\n`;

      for (const [category, comment] of Object.entries(categories)) {
          if (comment) {
              prompt += `${category.replace(/-/g, ' ')}: ${comment}\n`;
          }
      }

      if (additionalComments) {
          prompt += `The following additional comments should be woven into the whole report: ${additionalComments}\n`;
      }

      const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 400,
          temperature: 0.7
      });

      let report = response.choices[0].message.content.trim();

      // Replace the placeholder with the actual pupil's name
      report = report.replace(new RegExp(placeholder, 'g'), name);
      
      res.json({ report });
  } catch (error) {
      console.error('Error generating report:', error);
      res.status(500).send('Error generating report');
  }
});

// Endpoint to import reports and generate categories/comments
app.post('/api/import-reports', async (req, res) => {
  const { subjectId, yearGroupId, reports } = req.body;

  try {
      // Call OpenAI to process the reports
      const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: `Extract categories and comments from the following reports. These categories and comments are to be used in a comment bank to help write future reports and so should not contain names and be reasonably short. There should be no more than 8 comments per category. Please remove similar comments. The final category should be 'Targets' and have some relevant and reasonable possibel targets for these pupils reports. They should be in the format of Category: and then the category name followed by a new line and then the comment. Each comment should have a new line after it. Here is an example of the output I would like: Category: Interest and Engagement\nShows good attitude initially but sometimes struggles to maintain focus.\nBrings a quiet confidence to all computing lessons but can sometimes lose focus.\n\nCategory: Independent Study\nKeen to learn quickly but sometimes rushes and misses mistakes.\nPrefers independence and self-study, often completing work outside of school.\nThe reports start here:\n\n${reports}` }],
          max_tokens: 2000,
          temperature: 0.7
      });

      const extractedText = response.choices[0].message.content.trim();

      // Example response parsing (assumes categories and comments are structured in the response)
      const categories = {};
      const lines = extractedText.split('\n');
      let currentCategory = null;

      lines.forEach(line => {
          const categoryMatch = line.match(/^Category: (.+)$/);
          if (categoryMatch) {
              currentCategory = categoryMatch[1];
              categories[currentCategory] = new Set();
          } else if (currentCategory && line.trim()) {
              categories[currentCategory].add(line.trim());
          }
      });

      // Insert categories and comments into the database
      for (const [categoryName, comments] of Object.entries(categories)) {
          let category = await Category.findOne({ where: { name: categoryName, subjectId, yearGroupId } });
          if (!category) {
              category = await Category.create({ name: categoryName, subjectId, yearGroupId });
          }
          for (const comment of comments) {
              await Comment.create({ text: comment, categoryId: category.id });
          }
      }

      res.json({ message: 'Reports imported successfully and categories/comments generated.' });
  } catch (error) {
      console.error('Error importing reports:', error);
      res.status(500).send('Error importing reports');
  }
});


//app.listen(port, () => {
//  console.log(`Server running at http://localhost:${port}`);
//});

     
