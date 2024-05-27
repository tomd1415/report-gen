import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { Sequelize, DataTypes } from 'sequelize';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'public')));

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize Sequelize with IPv4 address
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: process.env.DB_DIALECT,
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

// Fetch a single category by ID
app.get('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const category = await Category.findByPk(id);
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
// Endpoint to fetch comments based on category
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

// Fetch a single comment by ID
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

      let prompt = promptPart ? promptPart.promptPart : 'Generate a concision school report for a pupil. This is for Computing lessons and I would like it to be friendly and formal. I would like it to be between 100 and 170 words long and flow nicely with no repetition. Below are categories and comments to base the report on. There should be no headings on the report. It could have up to 3 paragraphs if necessary';
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

      const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 500,
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
  const { subjectId, yearGroupId, pupilNames, reports } = req.body;

  try {
      const placeholder = 'PUPIL_NAME';
      const namesArray = pupilNames.split(',').map(name => name.trim());
      let reportsWithPlaceholder = reports;

      // Replace pupil names with placeholder
      namesArray.forEach(name => {
          const regex = new RegExp(`\\b${name}\\b`, 'g');
          reportsWithPlaceholder = reportsWithPlaceholder.replace(regex, placeholder);
      });

      // Call OpenAI to process the reports
      const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{
              role: 'user',
              content: `
              Please analyze the following school reports and extract relevant categories and comments that can be used to generate future student reports. There should be no more than 8 categories and similar categories should be merged. Ensure that the comments are concise, clear, and avoid any redundancy. Each category should have no more than 8 comments, and similar comments should be merged or removed. The final category should be 'Targets', containing specific and actionable targets for students, with the last target being "***Generate a target for this pupil and add to the report***". 
              
              Please try to make each category have the comments cover a variety of abilities and behaviors. Please order the comments from least able to most able. 
  
              Format the output as follows:
              Category: [Category Name]
              [Comment 1]
              [Comment 2]
              ...
      
              Here is an example of the desired output:
              Category: Interest and Engagement
              Shows good attitude initially but sometimes struggles to maintain focus.
              Brings a quiet confidence to all computing lessons but can sometimes lose focus.
      
              Category: Independent Study
              Keen to learn quickly but sometimes rushes and misses mistakes.
              Prefers independence and self-study, often completing work outside of school.
      
              The reports start here:
      
              ${reportsWithPlaceholder}
              `
            }],
          max_tokens: 3500,
          temperature: 0.6
      });

      const newExtractedText = response.choices[0].message.content.trim();

      // Example response parsing (assumes categories and comments are structured in the response)
      const newCategories = {};
      const lines = newExtractedText.split('\n');
      let currentCategory = null;

      lines.forEach(line => {
          const categoryMatch = line.match(/^Category: (.+)$/);
          if (categoryMatch) {
              currentCategory = categoryMatch[1];
              newCategories[currentCategory] = new Set();
          } else if (currentCategory && line.trim()) {
              newCategories[currentCategory].add(line.trim());
          }
      });

      // Fetch existing categories and comments from the database
      const existingCategories = await Category.findAll({
          where: { subjectId, yearGroupId },
          include: [Comment]
      });

      if (existingCategories.length > 0) {
          // Format existing categories and comments
          const existingFormattedCategories = existingCategories.reduce((acc, category) => {
              acc[category.name] = category.Comments.map(comment => comment.text);
              return acc;
          }, {});

          // Create a prompt to merge existing and new categories and comments
          const mergePrompt = `I have two sets of categories and comments for student reports. Please merge them, ensuring no more than 8 categories and no more than 8 comments per category. If categories are similar, please merge them. Prioritize clarity and conciseness. Please try and keep the order of the comments (ordered by ability and behaviour) and give priority to the New categories and comments.\n\nExisting categories and comments:\n\n${JSON.stringify(existingFormattedCategories, null, 2)}\n\nNew categories and comments:\n\n${JSON.stringify(newCategories, null, 2)}\n\nFormat the output as follows:\nCategory: [Category Name]\n[Comment 1]\n[Comment 2]\n...\n`;

          // Call OpenAI to merge the existing and new categories and comments
          const mergeResponse = await openai.chat.completions.create({
              model: 'gpt-4o',
              messages: [{ role: 'user', content: mergePrompt }],
              max_tokens: 3500,
              temperature: 0.6
          });

          const mergedText = mergeResponse.choices[0].message.content.trim();

          // Parse the merged categories and comments
          const mergedCategories = {};
          const mergedLines = mergedText.split('\n');
          let mergedCurrentCategory = null;

          mergedLines.forEach(line => {
              const categoryMatch = line.match(/^Category: (.+)$/);
              if (categoryMatch) {
                  mergedCurrentCategory = categoryMatch[1];
                  mergedCategories[mergedCurrentCategory] = [];
              } else if (mergedCurrentCategory && line.trim()) {
                  mergedCategories[mergedCurrentCategory].push(line.trim());
              }
          });

          // Replace the existing categories and comments with the merged ones
          await Category.destroy({ where: { subjectId, yearGroupId } });

          for (const [categoryName, comments] of Object.entries(mergedCategories)) {
              const category = await Category.create({ name: categoryName, subjectId, yearGroupId });
              for (const comment of comments) {
                  await Comment.create({ text: comment, categoryId: category.id });
              }
          }
      } else {
          // Insert new categories and comments if there are no existing ones
          for (const [categoryName, comments] of Object.entries(newCategories)) {
              const category = await Category.create({ name: categoryName, subjectId, yearGroupId });
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



//PROMPT PART
// Create or update a prompt by subjectId and yearGroupId
app.post('/api/prompts', async (req, res) => {
  const { subjectId, yearGroupId, promptPart } = req.body;
  try {
    const [prompt, created] = await Prompt.findOrCreate({
      where: {
        subjectId: subjectId,
        yearGroupId: yearGroupId
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

// Update a prompt by subjectId and yearGroupId
app.put('/api/prompts/:subjectId/:yearGroupId', async (req, res) => {
  const { subjectId, yearGroupId } = req.params;
  const { promptPart } = req.body;
  try {
    const prompt = await Prompt.findOne({
      where: {
        subjectId: subjectId,
        yearGroupId: yearGroupId
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

// Delete a prompt by subjectId and yearGroupId
app.delete('/api/prompts/:subjectId/:yearGroupId', async (req, res) => {
  const { subjectId, yearGroupId } = req.params;
  try {
    const prompt = await Prompt.findOne({
      where: {
        subjectId: subjectId,
        yearGroupId: yearGroupId
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
  try {
    const prompts = await Prompt.findAll();
    res.json(prompts);
  } catch (error) {
    console.error('Error fetching prompts:', error);
    res.status(500).send('Error fetching prompts');
  }
});

// Fetch a prompt by subjectId and yearGroupId
app.get('/api/prompts/:subjectId/:yearGroupId', async (req, res) => {
  const { subjectId, yearGroupId } = req.params;
  try {
    const prompt = await Prompt.findOne({
      where: {
        subjectId: subjectId,
        yearGroupId: yearGroupId
      }
    });
    res.json(prompt ? prompt.promptPart : '');
  } catch (error) {
    console.error('Error fetching prompt:', error);
    res.status(500).send('Error fetching prompt');
  }
});

     
