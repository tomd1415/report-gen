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

/**
 * `ImportJobs` — who imported what, for whom, and how it ended.
 *
 * Admins can import or replace any staff member's comment bank, and until now
 * nothing recorded that it happened (`docs/PROJECT_STATE.md` §6.6). This is the
 * metadata record the backlog proposed, and the same table answers decision 2(B)
 * in `docs/REDACTION-DECISIONS.md`: it carries the `confirmed` flag for the
 * import confirm interaction.
 *
 * **What it deliberately does NOT hold**, because the whole design rests on it:
 * no raw report text, no free text, no extracted comments, no pupil names. Only
 * who, for whom, which subject/year group, how many rows resulted, and whether it
 * succeeded. Every column below should be readable by someone with no right to
 * see pupil data.
 */
export async function up({ context: queryInterface }) {
  const tables = await queryInterface.showAllTables();

  if (!tableExists(tables, 'ImportJobs')) {
    await queryInterface.createTable('ImportJobs', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      // Who clicked. For a teacher importing their own bank this equals ownerUserId.
      actorUserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' }
      },
      // Whose comment bank was written. Differs from the actor on the admin path,
      // which is the case §6.6 exists for.
      ownerUserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' }
      },
      subjectId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'Subjects', key: 'id' }
      },
      yearGroupId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'YearGroups', key: 'id' }
      },
      // 'reports' (AI extraction from pasted reports) or 'csv'.
      source: { type: DataTypes.STRING, allowNull: false },
      // 'merge' or 'replace'. Replace is the destructive one.
      mode: { type: DataTypes.STRING, allowNull: false },
      // 'success' | 'failed'. Failures matter more than successes here: an empty
      // import that aborted (§6.3.3) should leave a trace that it was attempted.
      status: { type: DataTypes.STRING, allowNull: false },
      categoryCount: { type: DataTypes.INTEGER, allowNull: true },
      commentCount: { type: DataTypes.INTEGER, allowNull: true },
      // The message already shown to the user. Never a stack trace, never the
      // payload — see the note on this table above.
      errorMessage: { type: DataTypes.STRING(500), allowNull: true },
      // Decision 2(B): did the client report that the confirm-before-send step
      // was completed? Null means the client did not say, which is what a stale
      // client looks like — distinguishable from an explicit false.
      confirmed: { type: DataTypes.BOOLEAN, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    // The two questions this table gets asked: "what happened to this staff
    // member's bank?" and "what did this admin do?".
    await queryInterface.addIndex('ImportJobs', ['ownerUserId', 'createdAt'], {
      name: 'import_jobs_owner_created'
    });
    await queryInterface.addIndex('ImportJobs', ['actorUserId', 'createdAt'], {
      name: 'import_jobs_actor_created'
    });
  }
}

export async function down({ context: queryInterface }) {
  const tables = await queryInterface.showAllTables();
  if (tableExists(tables, 'ImportJobs')) {
    await queryInterface.dropTable('ImportJobs');
  }
}
