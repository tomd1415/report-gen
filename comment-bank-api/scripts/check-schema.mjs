#!/usr/bin/env node
/**
 * Does the database the app is about to use actually have the columns the models
 * expect?
 *
 * Why this cannot be a unit test
 * ------------------------------
 * The Vitest suite mocks the models entirely and needs no database — that is its
 * single most important property (`docs/TESTING.md`), and it is why a green run
 * says nothing about the schema. This check is the other half, and it needs a
 * real connection, so it belongs with the deploy steps rather than in the suite.
 *
 * What it is really for
 * ---------------------
 * `PROJECT_STATE.md` §6.13: umzug's `up()` resolves happily when its glob matches
 * nothing — measured, `pending: 0, ran: 0`, no error. `server.mjs` awaits that at
 * the top level, so **migrations can silently not run** and the app starts anyway.
 * On an existing database the symptom is not a crash: it is one feature failing
 * later, with nothing connecting it to the deploy.
 *
 * This is the outside check for that. It compares what the models declare against
 * what the server actually has, so a migration that did not run is a loud failure
 * at deploy time instead of a quiet one in a fortnight.
 *
 * Usage:  node scripts/check-schema.mjs
 * Exit:   0 if every model attribute exists as a column; 1 otherwise.
 *
 * Read-only. It issues `SHOW TABLES` and `DESCRIBE` and nothing else.
 */
import { models } from '../src/models/index.js';
import { sequelize } from '../src/db/sequelize.js';

const problems = [];

try {
  await sequelize.authenticate();
} catch (error) {
  console.error(`Cannot reach the database: ${error.message}`);
  console.error('This check needs a real connection — it is a deploy step, not a unit test.');
  process.exit(1);
}

const queryInterface = sequelize.getQueryInterface();
const tables = (await queryInterface.showAllTables()).map((t) => (typeof t === 'string' ? t : t.tableName));

for (const [name, model] of Object.entries(models)) {
  const table = model.getTableName();

  if (!tables.includes(table)) {
    problems.push(
      `${name}: table \`${table}\` does not exist. A migration has not run — see PROJECT_STATE.md §6.13 `
      + 'for why that can happen without any error.'
    );
    continue;
  }

  const columns = new Set(Object.keys(await queryInterface.describeTable(table)));
  const missing = Object.values(model.getAttributes())
    .map((attribute) => attribute.field || attribute.fieldName)
    .filter((column) => !columns.has(column));

  if (missing.length > 0) {
    problems.push(`${name} (\`${table}\`): the model writes columns the table does not have — ${missing.join(', ')}`);
  }
}

await sequelize.close();

// A floor. If the model registry were ever empty this would report success
// having compared nothing, which is the failure mode half this project's gates
// exist to prevent.
const checked = Object.keys(models).length;
if (checked === 0) {
  console.error('No models found — refusing to report success without checking anything.');
  process.exit(1);
}

if (problems.length > 0) {
  console.error(`Schema does not match the models (${checked} models checked):\n`);
  for (const problem of problems) console.error(`  * ${problem}`);
  console.error('\nRun the migrations, then check again.');
  process.exit(1);
}

console.log(`Schema matches: ${checked} models, every declared attribute present as a column.`);
