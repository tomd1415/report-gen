import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { Sequelize } from 'sequelize';

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
  dialect: 'mysql'
});

const Category = sequelize.define('Category', {
  name: {
    type: Sequelize.STRING,
    allowNull: false
  }
}, {
  timestamps: false
});

const Subject = sequelize.define('Subject', {
  name: {
    type: Sequelize.STRING,
    allowNull: false
  }
}, {
  timestamps: false
});

const YearGroup = sequelize.define('YearGroup', {
  name: {
    type: Sequelize.STRING,
    allowNull: false
  }
}, {
  timestamps: false
});

const Comment = sequelize.define('Comment', {
  text: {
    type: Sequelize.TEXT,
    allowNull: false
  },
  categoryId: {
    type: Sequelize.INTEGER,
    references: {
      model: Category,
      key: 'id'
    }
  }
}, {
  timestamps: false
});

const CommentSubject = sequelize.define('CommentSubject', {
  commentId: {
    type: Sequelize.INTEGER,
    references: {
      model: Comment,
      key: 'id'
    }
  },
  subjectId: {
    type: Sequelize.INTEGER,
    references: {
      model: Subject,
      key: 'id'
    }
  }
}, {
  timestamps: false
});

const CommentYearGroup = sequelize.define('CommentYearGroup', {
  commentId: {
    type: Sequelize.INTEGER,
    references: {
      model: Comment,
      key: 'id'
    }
  },
  yearGroupId: {
    type: Sequelize.INTEGER,
    references: {
      model: YearGroup,
      key: 'id'
    }
  }
}, {
  timestamps: false
});

const CategorySubjectYearGroup = sequelize.define('CategorySubjectYearGroup', {
  categoryId: {
    type: Sequelize.INTEGER,
    references: {
      model: Category,
      key: 'id'
    }
  },
  subjectId: {
    type: Sequelize.INTEGER,
    references: {
      model: Subject,
      key: 'id'
    }
  },
  yearGroupId: {
    type: Sequelize.INTEGER,
    references: {
      model: YearGroup,
      key: 'id'
    }
  }
}, {
  timestamps: false
});

// Adjust associations
Category.belongsToMany(Subject, { through: CategorySubjectYearGroup, foreignKey: 'categoryId' });
Category.belongsToMany(YearGroup, { through: CategorySubjectYearGroup, foreignKey: 'categoryId' });
Subject.belongsToMany(Category, { through: CategorySubjectYearGroup, foreignKey: 'subjectId' });
YearGroup.belongsToMany(Category, { through: CategorySubjectYearGroup, foreignKey: 'yearGroupId' });

Category.hasMany(Comment, { foreignKey: 'categoryId' });
Comment.belongsTo(Category, { foreignKey: 'categoryId' });
Comment.belongsToMany(Subject, { through: CommentSubject, foreignKey: 'commentId' });
Comment.belongsToMany(YearGroup, { through: CommentYearGroup, foreignKey: 'commentId' });
Subject.belongsToMany(Comment, { through: CommentSubject, foreignKey: 'subjectId' });
YearGroup.belongsToMany(Comment, { through: CommentYearGroup, foreignKey: 'yearGroupId' });

sequelize.sync().then(() => {
  console.log('Database & tables created!');
});

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

//year groups
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

// Create a new category
app.post('/api/categories', async (req, res) => {
  const { name, subjectId, yearGroupId } = req.body;
  try {
      const category = await Category.create({ name });
      await CategorySubjectYearGroup.create({ categoryId: category.id, subjectId, yearGroupId });
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

// Fetch all categories and their associated comments based on subject and year group
app.get('/api/categories-comments', async (req, res) => {
  const { subjectId, yearGroupId } = req.query;
  try {
      const categories = await Category.findAll({
          include: {
              model: Comment,
              include: [
                  {
                      model: Subject,
                      where: { id: subjectId },
                      through: { attributes: [] }
                  },
                  {
                      model: YearGroup,
                      where: { id: yearGroupId },
                      through: { attributes: [] }
                  }
              ]
          },
          where: {
              '$CategorySubjectYearGroup.subjectId$': subjectId,
              '$CategorySubjectYearGroup.yearGroupId$': yearGroupId
          },
          include: [{
              model: CategorySubjectYearGroup,
              where: { subjectId, yearGroupId }
          }]
      });
      res.json(categories);
  } catch (error) {
      console.error('Error fetching categories and comments:', error);
      res.status(500).send('Error fetching categories and comments');
  }
});

// Create a new comment
app.post('/api/comments', async (req, res) => {
  const { text, categoryId, subjectId, yearGroupId } = req.body;
  try {
      const comment = await Comment.create({ text, categoryId });
      await CommentSubject.create({ commentId: comment.id, subjectId });
      await CommentYearGroup.create({ commentId: comment.id, yearGroupId });
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



// CRUD operations for Subjects
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

// CRUD operations for YearGroups
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

// CRUD operations for Categories
app.post('/api/categories', async (req, res) => {
  const { name, subjectId, yearGroupId } = req.body;
  try {
      const category = await Category.create({ name });
      await CategorySubjectYearGroup.create({ categoryId: category.id, subjectId, yearGroupId });
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

// CRUD operations for Comments
app.post('/api/comments', async (req, res) => {
    const { text, categoryId, subjectId, yearGroupId } = req.body;
    try {
        const comment = await Comment.create({ text, categoryId });
        await CommentSubject.create({ commentId: comment.id, subjectId });
        await CommentYearGroup.create({ commentId: comment.id, yearGroupId });
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

// Endpoint to fetch categories and their associated comments based on subject and year group
app.get('/api/categories-comments', async (req, res) => {
    const { subjectId, yearGroupId } = req.query;
    try {
        const categories = await Category.findAll({
            include: {
                model: Comment,
                include: [
                    {
                        model: Subject,
                        where: { id: subjectId },
                        through: { attributes: [] }
                    },
                    {
                        model: YearGroup,
                        where: { id: yearGroupId },
                        through: { attributes: [] }
                    }
                ]
            },
            include: [{
                model: CategorySubjectYearGroup,
                where: { subjectId, yearGroupId }
            }]
        });
        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories and comments:', error);
        res.status(500).send('Error fetching categories and comments');
    }
});

// Endpoint to fetch the prompt part based on subject and year group
app.get('/api/prompt-part', async (req, res) => {
    const { subjectId, yearGroupId } = req.query;
    try {
        const promptPart = await SubjectYearGroupPrompt.findOne({
            where: {
                subjectId: subjectId,
                yearGroupId: yearGroupId
            }
        });
        res.json(promptPart ? promptPart.promptPart : 'Generate a comprehensive report for a student.');
    } catch (error) {
        console.error('Error fetching prompt part:', error);
        res.status(500).send('Error fetching prompt part');
    }
});

// Endpoint to generate report
app.post('/generate-report', async (req, res) => {
    const { name, pronouns, subjectId, yearGroupId, additionalComments, ...categories } = req.body;

    try {
        const promptPart = await SubjectYearGroupPrompt.findOne({
            where: {
                subjectId: subjectId,
                yearGroupId: yearGroupId
            }
        });

        let prompt = promptPart ? promptPart.promptPart : 'Generate a comprehensive report for a student.';
        prompt += `\nName: ${name} (${pronouns})\n`;

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

        const report = response.choices[0].message.content.trim();
        res.json({ report });
    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).send('Error generating report');
    }
});

// Endpoint to fetch all subjects
app.get('/api/subjects', async (req, res) => {
  try {
      const subjects = await Subject.findAll();
      res.json(subjects);
  } catch (error) {
      console.error('Error fetching subjects:', error);
      res.status(500).send('Error fetching subjects');
  }
});

// Endpoint to fetch all year groups
app.get('/api/year-groups', async (req, res) => {
  try {
      const yearGroups = await YearGroup.findAll();
      res.json(yearGroups);
  } catch (error) {
      console.error('Error fetching year groups:', error);
      res.status(500).send('Error fetching year groups');
  }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
