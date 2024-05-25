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

Category.hasMany(Comment, { foreignKey: 'categoryId' });
Comment.belongsTo(Category, { foreignKey: 'categoryId' });
Comment.belongsToMany(Subject, { through: CommentSubject });
Comment.belongsToMany(YearGroup, { through: CommentYearGroup });
Subject.belongsToMany(Comment, { through: CommentSubject });
YearGroup.belongsToMany(Comment, { through: CommentYearGroup });

sequelize.sync().then(() => {
  console.log('Database & tables created!');
});

// Endpoint to generate report
app.post('/generate-report', async (req, res) => {
  const { name, pronouns, additionalComments, ...categories } = req.body;

  let prompt = `
  Generate a concise school report for a Computer Science GCSE student. This report should avoid repitition, be porfessional and friendly and flow well. This text will appear in a preformatted text box and so should not have any titles or heading. There should be no sub headings. This report should be around 150 words.
  Name: ${name} (${pronouns})
  `;

  for (const [category, comment] of Object.entries(categories)) {
    if (comment) {
      prompt += `${category.replace(/-/g, ' ')}: ${comment}\n`;
    }
  }

  if (additionalComments) {
    prompt += `The following additional comments shold be weaved into the whole report: ${additionalComments}\n`;
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.7
    });

    const report = response.choices[0].message.content.trim();
    res.json({ report });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating report');
  }
});

// Endpoint to fetch subjects
app.get('/api/subjects', async (req, res) => {
  try {
    const subjects = await Subject.findAll();
    res.json(subjects);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching subjects');
  }
});

// Endpoint to fetch year groups
app.get('/api/year-groups', async (req, res) => {
  try {
    const yearGroups = await YearGroup.findAll();
    res.json(yearGroups);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching year groups');
  }
});

// Endpoint to fetch categories and their associated comments based on subject and year group
app.get('/api/categories-comments', async (req, res) => {
  const { subjectId, yearGroupId } = req.query;
  try {
    console.log(`Fetching categories and comments for subjectId: ${subjectId}, yearGroupId: ${yearGroupId}`);
    
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
      }
    });
    console.log('Fetched categories:', JSON.stringify(categories, null, 2));
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories and comments:', error);
    res.status(500).send('Error fetching categories and comments');
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
