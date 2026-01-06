import { DataTypes } from 'sequelize';

export async function up({ context: queryInterface }) {
  let table;
  try {
    table = await queryInterface.describeTable('Sessions');
  } catch (error) {
    return;
  }

  if (!table.createdAt) {
    await queryInterface.addColumn('Sessions', 'createdAt', {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    });
  }

  if (!table.updatedAt) {
    await queryInterface.addColumn('Sessions', 'updatedAt', {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    });
  }
}

export async function down({ context: queryInterface }) {
  let table;
  try {
    table = await queryInterface.describeTable('Sessions');
  } catch (error) {
    return;
  }

  if (table.updatedAt) {
    await queryInterface.removeColumn('Sessions', 'updatedAt');
  }

  if (table.createdAt) {
    await queryInterface.removeColumn('Sessions', 'createdAt');
  }
}
