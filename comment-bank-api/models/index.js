import { Sequelize } from 'sequelize';
import { config } from 'dotenv';
config();

const sequelize = new Sequelize('comment_bank', 'root', 'exhall2024', {
  host: 'localhost',
  dialect: 'mysql'
});

const Category = sequelize.define('Category', {
  name: {
    type: Sequelize.STRING,
    allowNull: false
  }
});

const Subject = sequelize.define('Subject', {
  name: {
    type: Sequelize.STRING,
    allowNull: false
  }
});

const YearGroup = sequelize.define('YearGroup', {
  name: {
    type: Sequelize.STRING,
    allowNull: false
  }
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
});

// Define relationships
Comment.belongsTo(Category, { foreignKey: 'categoryId' });
Comment.belongsToMany(Subject, { through: CommentSubject });
Comment.belongsToMany(YearGroup, { through: CommentYearGroup });
Subject.belongsToMany(Comment, { through: CommentSubject });
YearGroup.belongsToMany(Comment, { through: CommentYearGroup });

export { sequelize, Category, Subject, YearGroup, Comment, CommentSubject, CommentYearGroup };
