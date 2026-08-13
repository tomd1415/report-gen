import path from 'path';
import { fileURLToPath } from 'url';
import { Umzug, SequelizeStorage } from 'umzug';
import { sequelize } from './sequelize.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Exported so `tests/migration-coverage.test.js` can resolve the *same* glob this
 * runner uses. It used to hard-code its own copy, which meant a change here was
 * invisible to the test written to guard it — proved on 2026-08-13 by a mutation
 * declared `expect_none_because` and confirmed uncaught
 * (`tests/mutations/unit-gates.json`). That is the two-lists-that-must-agree
 * shape the test exists to catch, and it was inside the test.
 */
export const migrationsGlob = path.join(__dirname, '..', '..', 'migrations', '*.mjs');

const umzug = new Umzug({
  migrations: { glob: migrationsGlob },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize, tableName: 'SequelizeMeta' }),
  logger: console
});

export const runMigrations = async () => {
  await sequelize.authenticate();
  await umzug.up();
};
