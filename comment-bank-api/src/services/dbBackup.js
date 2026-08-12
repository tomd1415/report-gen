import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/env.js';

const execFileAsync = promisify(execFile);

/**
 * A completed mysqldump ends with this line. Verified 2026-08-12 against the
 * three real dumps in dbbackup_web/, all of which end
 * `-- Dump completed on <date>`.
 *
 * This is what distinguishes a backup from the wreckage of one. mysqldump writes
 * its *header* to --result-file before it does any work, so a dump that fails
 * leaves a well-formed ~871-byte file with a correct `-- MariaDB dump` banner and
 * no data — which restores into an empty database without an error
 * (docs/PROJECT_STATE.md §6.10). Checking size, or counting `CREATE TABLE`, is a
 * weaker version of the same idea: a dump that died between the schema and the
 * data would pass both. Only the trailer says "this process reached the end".
 */
const DUMP_TRAILER = '-- Dump completed';

/** Enough of the tail to hold the trailer without reading a large dump in. */
const TRAILER_WINDOW_BYTES = 512;

const ensureBackupDir = async () => {
  const resolved = path.resolve(process.cwd(), config.backup.dir);
  await fs.mkdir(resolved, { recursive: true });
  return resolved;
};

const buildDumpArgs = (filePath) => {
  const args = [
    '-u', config.db.user,
    '-h', config.db.host,
    '-P', String(config.db.port),
    '--result-file', filePath,
    config.db.name
  ];
  return args;
};

const runDump = async (filePath) => {
  // The password goes through the environment, never argv: anything in argv is
  // readable by every user on the box via `ps`.
  const env = { ...process.env };
  if (config.db.password) {
    env.MYSQL_PWD = config.db.password;
  }

  await execFileAsync('mysqldump', buildDumpArgs(filePath), { env });
};

/**
 * Throws unless the file looks like a dump that ran to completion. Loud on
 * purpose — the whole danger of this defect is that the failure is quiet.
 */
const assertCompleteDump = async (filePath) => {
  const { size } = await fs.stat(filePath);
  if (size === 0) {
    throw new Error(`Backup aborted: mysqldump produced an empty file at ${filePath}.`);
  }

  const length = Math.min(size, TRAILER_WINDOW_BYTES);
  const buffer = Buffer.alloc(length);
  const handle = await fs.open(filePath, 'r');
  try {
    await handle.read(buffer, 0, length, size - length);
  } finally {
    await handle.close();
  }

  if (!buffer.toString('utf8').includes(DUMP_TRAILER)) {
    throw new Error(
      `Backup aborted: ${filePath} does not end with "${DUMP_TRAILER}", so mysqldump did not `
      + 'finish. The file has been discarded and any existing backup is untouched.'
    );
  }
};

/**
 * Dump to a temporary file, prove it, and only then move it into place.
 *
 * The temporary file lives in the **same directory** as its target, which is not
 * incidental: `rename` is atomic only within one filesystem, and only an atomic
 * rename guarantees a concurrent reader sees either the old backup or the new
 * one and never a half-written file. On a full disk the dump fails at the
 * temporary path and the existing backup survives — the opposite of what this
 * code used to do.
 */
const dumpToVerifiedFile = async (finalPath) => {
  const partialPath = `${finalPath}.partial`;

  try {
    await runDump(partialPath);
    await assertCompleteDump(partialPath);
  } catch (error) {
    // Leaving the partial behind is how a failed dump used to replace a good
    // backup. Failure to clean up must not mask the real error.
    await fs.unlink(partialPath).catch(() => {});
    throw error;
  }

  await fs.rename(partialPath, finalPath);
  return finalPath;
};

/** Timestamped to the millisecond, so no two runs can target the same file. */
const timestampedName = () => `database-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;

/**
 * Produces a file for the admin to download. Named with a full timestamp rather
 * than the date alone: two exports on one day used to write to the same path, so
 * a failed afternoon export overwrote a good morning backup.
 */
export const exportDatabase = async () => {
  const backupDir = await ensureBackupDir();
  return dumpToVerifiedFile(path.join(backupDir, timestampedName()));
};

export const backupDatabase = async () => {
  const backupDir = await ensureBackupDir();
  return dumpToVerifiedFile(path.join(backupDir, timestampedName()));
};
