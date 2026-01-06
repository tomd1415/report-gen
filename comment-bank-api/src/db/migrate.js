import path from 'path';
import { fileURLToPath } from 'url';
import { Umzug, SequelizeStorage } from 'umzug';
import { sequelize } from './sequelize.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsGlob = path.join(__dirname, '..', '..', 'migrations', '*.mjs');

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
