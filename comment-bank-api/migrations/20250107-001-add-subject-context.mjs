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

  if (!tableExists(tables, 'SubjectContexts')) {
    await queryInterface.createTable('SubjectContexts', {
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
      },
      yearGroupId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'YearGroups', key: 'id' }
      },
      subjectDescription: { type: DataTypes.TEXT },
      wordLimit: { type: DataTypes.INTEGER },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });
  }

  await queryInterface.addIndex('SubjectContexts', ['userId', 'subjectId', 'yearGroupId'], {
    unique: true,
    name: 'subject_context_unique'
  });
}

export async function down({ context: queryInterface }) {
  const tables = await queryInterface.showAllTables();
  if (tableExists(tables, 'SubjectContexts')) {
    await queryInterface.dropTable('SubjectContexts');
  }
}
