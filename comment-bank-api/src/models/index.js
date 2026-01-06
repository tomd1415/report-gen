import { DataTypes } from 'sequelize';
import { sequelize } from '../db/sequelize.js';

export const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  isAdmin: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
});

export const Subject = sequelize.define('Subject', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  }
}, {
  timestamps: true
});

export const YearGroup = sequelize.define('YearGroup', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  }
}, {
  timestamps: true
});

export const Category = sequelize.define('Category', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  subjectId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Subject,
      key: 'id'
    }
  },
  yearGroupId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: YearGroup,
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  }
}, {
  timestamps: true
});

export const Comment = sequelize.define('Comment', {
  text: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  categoryId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Category,
      key: 'id'
    }
  }
}, {
  timestamps: true
});

export const Prompt = sequelize.define('Prompt', {
  subjectId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Subject,
      key: 'id'
    }
  },
  yearGroupId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: YearGroup,
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  promptPart: {
    type: DataTypes.TEXT,
    allowNull: false
  }
}, {
  timestamps: true
});

export const UserSubject = sequelize.define('UserSubject', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  subjectId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Subject,
      key: 'id'
    }
  }
}, { timestamps: false });

export const UserYearGroup = sequelize.define('UserYearGroup', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  yearGroupId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: YearGroup,
      key: 'id'
    }
  }
}, { timestamps: false });

Category.belongsTo(Subject, { foreignKey: 'subjectId' });
Category.belongsTo(YearGroup, { foreignKey: 'yearGroupId' });
Category.belongsTo(User, { foreignKey: 'userId' });
Category.hasMany(Comment, { foreignKey: 'categoryId' });

Comment.belongsTo(Category, { foreignKey: 'categoryId' });

User.hasMany(Category, { foreignKey: 'userId' });
Subject.hasMany(Category, { foreignKey: 'subjectId' });
YearGroup.hasMany(Category, { foreignKey: 'yearGroupId' });

User.hasMany(UserSubject, { foreignKey: 'userId' });
UserSubject.belongsTo(User, { foreignKey: 'userId' });
Subject.hasMany(UserSubject, { foreignKey: 'subjectId' });
UserSubject.belongsTo(Subject, { foreignKey: 'subjectId' });
User.belongsToMany(Subject, { through: UserSubject, foreignKey: 'userId' });
Subject.belongsToMany(User, { through: UserSubject, foreignKey: 'subjectId' });

User.hasMany(UserYearGroup, { foreignKey: 'userId' });
UserYearGroup.belongsTo(User, { foreignKey: 'userId' });
YearGroup.hasMany(UserYearGroup, { foreignKey: 'yearGroupId' });
UserYearGroup.belongsTo(YearGroup, { foreignKey: 'yearGroupId' });
User.belongsToMany(YearGroup, { through: UserYearGroup, foreignKey: 'userId' });
YearGroup.belongsToMany(User, { through: UserYearGroup, foreignKey: 'yearGroupId' });

Prompt.belongsTo(Subject, { foreignKey: 'subjectId' });
Prompt.belongsTo(YearGroup, { foreignKey: 'yearGroupId' });
Prompt.belongsTo(User, { foreignKey: 'userId' });

export const models = {
  User,
  Subject,
  YearGroup,
  Category,
  Comment,
  Prompt,
  UserSubject,
  UserYearGroup
};
