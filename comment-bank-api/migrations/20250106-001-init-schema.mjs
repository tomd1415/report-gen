import { DataTypes } from 'sequelize';

const tableExists = (tables, name) => {
  return tables.some((table) => {
    if (typeof table === 'string') {
      return table === name;
    }
    if (table && typeof table === 'object') {
      return table.tableName === name || table.name === name;
    }
    return false;
  });
};

export async function up({ context: queryInterface }) {
  const tables = await queryInterface.showAllTables();

  if (!tableExists(tables, 'Users')) {
    await queryInterface.createTable('Users', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      username: { type: DataTypes.STRING, allowNull: false, unique: true },
      password: { type: DataTypes.STRING, allowNull: false },
      isAdmin: { type: DataTypes.BOOLEAN, defaultValue: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
  }

  if (!tableExists(tables, 'Subjects')) {
    await queryInterface.createTable('Subjects', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false, unique: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
  }

  if (!tableExists(tables, 'YearGroups')) {
    await queryInterface.createTable('YearGroups', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false, unique: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
  }

  if (!tableExists(tables, 'Categories')) {
    await queryInterface.createTable('Categories', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false },
      subjectId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Subjects', key: 'id' }
      },
      yearGroupId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'YearGroups', key: 'id' }
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' }
      },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
  }

  if (!tableExists(tables, 'Comments')) {
    await queryInterface.createTable('Comments', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      text: { type: DataTypes.TEXT, allowNull: false },
      categoryId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Categories', key: 'id' }
      },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
  }

  if (!tableExists(tables, 'Prompts')) {
    await queryInterface.createTable('Prompts', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      subjectId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Subjects', key: 'id' }
      },
      yearGroupId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'YearGroups', key: 'id' }
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' }
      },
      promptPart: { type: DataTypes.TEXT, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
  }

  if (!tableExists(tables, 'UserSubjects')) {
    await queryInterface.createTable('UserSubjects', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' }
      },
      subjectId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Subjects', key: 'id' }
      }
    });
  }

  if (!tableExists(tables, 'UserYearGroups')) {
    await queryInterface.createTable('UserYearGroups', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' }
      },
      yearGroupId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'YearGroups', key: 'id' }
      }
    });
  }

  if (!tableExists(tables, 'Sessions')) {
    await queryInterface.createTable('Sessions', {
      sid: { type: DataTypes.STRING, primaryKey: true },
      expires: { type: DataTypes.DATE },
      data: { type: DataTypes.TEXT('long') },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    });
  }
}

export async function down({ context: queryInterface }) {
  const tables = await queryInterface.showAllTables();

  if (tableExists(tables, 'Sessions')) {
    await queryInterface.dropTable('Sessions');
  }
  if (tableExists(tables, 'UserYearGroups')) {
    await queryInterface.dropTable('UserYearGroups');
  }
  if (tableExists(tables, 'UserSubjects')) {
    await queryInterface.dropTable('UserSubjects');
  }
  if (tableExists(tables, 'Prompts')) {
    await queryInterface.dropTable('Prompts');
  }
  if (tableExists(tables, 'Comments')) {
    await queryInterface.dropTable('Comments');
  }
  if (tableExists(tables, 'Categories')) {
    await queryInterface.dropTable('Categories');
  }
  if (tableExists(tables, 'YearGroups')) {
    await queryInterface.dropTable('YearGroups');
  }
  if (tableExists(tables, 'Subjects')) {
    await queryInterface.dropTable('Subjects');
  }
  if (tableExists(tables, 'Users')) {
    await queryInterface.dropTable('Users');
  }
}
