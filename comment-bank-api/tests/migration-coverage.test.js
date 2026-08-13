import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Umzug, memoryStorage } from 'umzug';
import { describe, it, expect } from 'vitest';

import { models } from '../src/models/index.js';
import { migrationsGlob } from '../src/db/migrate.js';

// Why this exists
// ---------------
// Three things had nothing checking them, all of the "succeeds while doing
// nothing" shape:
//
// 1. `runMigrations()` finds migrations with a glob (src/db/migrate.js line 9).
//    Measured 2026-08-09: umzug's `up()` resolves happily when that glob matches
//    NOTHING — `pending: 0, ran: 0`, no error, exit 0. server.mjs awaits it at
//    the top level, so a renamed file or a deploy that misses migrations/ starts
//    the app against whatever schema is already there. On an empty database the
//    first query fails loudly; on an existing one it starts clean and only the
//    newest feature 500s.
//
// 2. Nothing compared the models against the migrations. Add a `sequelize.define`
//    and forget the migration and every test still passes — the models are never
//    synced (`sessionStore.sync()` is not called either), so the table simply is
//    not there in production.
//
// 3. docs/restore_drill.md §2 tells an operator to run
//    `grep -c 'CREATE TABLE' backup.sql` and expect a specific number, to tell a
//    real backup from the 871-byte stub a failed mysqldump leaves behind
//    (PROJECT_STATE §6.10). That number is a hand-written constant in a document.
//    The next migration that adds a table makes it wrong, and a wrong expected
//    count on that page is worse than none — it is the one check standing between
//    an operator and restoring an empty database.
//
// These do not run the migrations against a database. They run the real migration
// files through umzug's real resolver against a recording stub, so the table list
// is what the code does, not what a regex found in the source.

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.join(here, '..');
const migrationsDir = path.join(apiRoot, 'migrations');
const restoreDrillPath = path.join(apiRoot, '..', 'docs', 'restore_drill.md');

// Imported from the runner, not copied. This was a hard-coded literal until
// 2026-08-13, on the reasoning that importing migrate.js constructs a Sequelize
// instance — true, but it does not connect, and the models this file already
// imports construct one anyway. The cost of the copy was that breaking the real
// glob in src/db/migrate.js left every test here green, which a mutation run
// declared and then confirmed (tests/mutations/unit-gates.json).

const resolveMigrations = () => new Umzug({
  migrations: { glob: migrationsGlob },
  storage: memoryStorage(),
  logger: undefined
}).migrations();

// Runs every migration's `up` against a stub that records createTable calls.
// showAllTables reports what has been created so far, so each migration takes
// the same branch it would against a real empty database.
const tablesCreatedByMigrations = async () => {
  const created = [];
  const queryInterface = {
    showAllTables: async () => created.slice(),
    createTable: async (name) => { created.push(name); },
    describeTable: async (name) => {
      if (!created.includes(name)) throw new Error(`no such table: ${name}`);
      return {};
    },
    addColumn: async () => {},
    removeColumn: async () => {},
    dropTable: async () => {},
    addIndex: async () => {}
  };

  for (const migration of await resolveMigrations()) {
    await migration.up({ name: migration.name, context: queryInterface });
  }
  return created;
};

describe('the migration glob actually matches the migration files', () => {
  it('resolves at least one migration', async () => {
    // Floor. Without this the comparison below passes vacuously on an empty
    // list, which is the exact failure it is meant to catch.
    const resolved = await resolveMigrations();
    expect(resolved.length).toBeGreaterThan(0);
  });

  it('resolves every file in migrations/, whatever it is named', async () => {
    const onDisk = fs.readdirSync(migrationsDir).filter((name) => !name.startsWith('.')).sort();
    expect(onDisk.length).toBeGreaterThan(0);

    const resolved = (await resolveMigrations()).map((m) => m.name);

    // If this fails, a file is sitting in migrations/ that runMigrations() will
    // never run — almost certainly the extension: the glob is *.mjs.
    expect(
      onDisk.filter((name) => !resolved.includes(name)),
      'A file in migrations/ will never be run: runMigrations() globs *.mjs, so a differently '
      + 'named file is silently skipped and the app starts against a stale schema. Rename it.'
    ).toEqual([]);
  });
});

describe('every model has a table some migration creates', () => {
  it('creates a table for each defined model', async () => {
    const created = await tablesCreatedByMigrations();
    expect(created.length).toBeGreaterThan(0);

    const modelTables = Object.values(models).map((model) => model.getTableName());
    expect(modelTables.length).toBeGreaterThan(0);

    // If this fails, the named model has no table in a fresh deployment. The
    // models are never synced, so nothing else would tell you.
    expect(
      modelTables.filter((table) => !created.includes(table)),
      'A model has no table in a fresh deployment. The models are never synced, so nothing else '
      + 'would tell you — write the migration that creates it.'
    ).toEqual([]);
  });

  it('creates Sessions, which has no model to fall back on', async () => {
    // src/app.js builds a SequelizeStore on tableName 'Sessions' and never calls
    // sessionStore.sync(). The migration is the only thing that creates it, so
    // losing it means every login fails at the point the session is written.
    expect(await tablesCreatedByMigrations()).toContain('Sessions');
  });
});

describe('the table count in the restore drill matches the migrations', () => {
  it('agrees with what a real backup would contain', async () => {
    const drill = fs.readFileSync(restoreDrillPath, 'utf8');

    const match = drill.match(/CREATE TABLE'[^\n]*#\s*expect\s+(\d+)/);
    // Fail rather than skip: if the line has been reworded, this test has
    // stopped guarding the number and should say so.
    expect(match, `no "# expect N" comment found in ${restoreDrillPath}`).toBeTruthy();

    const created = await tablesCreatedByMigrations();
    // +1 for SequelizeMeta, which umzug creates to record what it has run and
    // which mysqldump includes like any other table.
    expect(Number(match[1])).toBe(created.length + 1);
  });
});
