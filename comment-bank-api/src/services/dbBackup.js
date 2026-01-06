import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/env.js';

const execFileAsync = promisify(execFile);

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
  const env = { ...process.env };
  if (config.db.password) {
    env.MYSQL_PWD = config.db.password;
  }

  await execFileAsync('mysqldump', buildDumpArgs(filePath), { env });
};

export const exportDatabase = async () => {
  const backupDir = await ensureBackupDir();
  const fileName = `database-backup-${new Date().toISOString().split('T')[0]}.sql`;
  const sqlFilePath = path.join(backupDir, fileName);

  await runDump(sqlFilePath);
  return sqlFilePath;
};

export const backupDatabase = async () => {
  const backupDir = await ensureBackupDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `database-backup-${timestamp}.sql`;
  const filePath = path.join(backupDir, fileName);

  await runDump(filePath);
  return filePath;
};
