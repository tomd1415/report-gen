import path from 'path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Why this exists
// ---------------
// `src/services/dbBackup.js` had NO tests, and it is what `docs/restore_drill.md`
// and the release checklist both rest on.
//
// It also carried the data-loss defect in docs/PROJECT_STATE.md §6.10: mysqldump
// writes its header to --result-file *before* it does any work, so a failed dump
// leaves a well-formed ~871-byte file with a correct `-- MariaDB dump` banner and
// no data. Nothing unlinked it, and the export path named files by date alone, so
// a failed afternoon export replaced a good morning backup with that stub — which
// restores into an empty database with no error at all.
//
// **Fixed 2026-08-12** (owner approved). These tests were written against the old
// behaviour first, watched to fail when the fix landed, and then rewritten as the
// positive assertions below. That order matters: it is the difference between a
// test that describes the fix and one that was seen to distinguish it from the
// bug.
//
// The case that decides it is `an incomplete dump is refused even though
// mysqldump exited 0` — a size or `CREATE TABLE` check would pass a dump that
// died between the schema and the data. Only the trailer says the process
// reached the end.

const execFileMock = vi.hoisted(() => vi.fn());
const mkdirMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const unlinkMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const renameMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
/** path → file contents, standing in for the disk. */
const files = vi.hoisted(() => new Map());

// promisify(execFile) is captured when dbBackup.js loads, so the mock has to be
// a callback-style function for promisify to wrap — not an async one.
vi.mock('child_process', () => ({
  execFile: (file, args, options, callback) => execFileMock(file, args, options, callback)
}));

vi.mock('fs/promises', () => {
  const statMock = async (filePath) => {
    if (!files.has(filePath)) {
      const error = new Error(`ENOENT: no such file, stat '${filePath}'`);
      error.code = 'ENOENT';
      throw error;
    }
    return { size: Buffer.byteLength(files.get(filePath), 'utf8') };
  };
  const openMock = async (filePath) => {
    const contents = Buffer.from(files.get(filePath) ?? '', 'utf8');
    return {
      read: async (buffer, offset, length, position) => {
        contents.copy(buffer, offset, position, position + length);
        return { bytesRead: length };
      },
      close: async () => {}
    };
  };
  const api = {
    mkdir: mkdirMock,
    unlink: unlinkMock,
    rename: renameMock,
    stat: statMock,
    open: openMock
  };
  return { default: api, ...api };
});

const { exportDatabase, backupDatabase } = await import('../src/services/dbBackup.js');
const { config } = await import('../src/config/env.js');

const COMPLETE_DUMP = [
  '-- MariaDB dump 10.19',
  'CREATE TABLE `Users` (id int);',
  "INSERT INTO `Users` VALUES (1,'someone');",
  '-- Dump completed on 2026-08-12 10:00:00',
  ''
].join('\n');

/** What mysqldump leaves behind when it dies after writing its header. */
const HEADER_ONLY_STUB = [
  '-- MariaDB dump 10.19',
  '--',
  '-- Host: 127.0.0.1    Database: comment_bank',
  ''
].join('\n');

const resultFileFrom = (args) => args[args.indexOf('--result-file') + 1];

/** mysqldump succeeds and writes `contents` to whatever --result-file names. */
const dumpWriting = (contents) => execFileMock.mockImplementation(
  (_file, args, _options, callback) => {
    files.set(resultFileFrom(args), contents);
    callback(null, { stdout: '', stderr: '' });
  }
);

/** mysqldump writes its header, then fails — the measured real-world case. */
const dumpFailingAfterHeader = () => execFileMock.mockImplementation(
  (_file, args, _options, callback) => {
    files.set(resultFileFrom(args), HEADER_ONLY_STUB);
    const error = new Error('mysqldump: Got error: 1044: Access denied');
    error.code = 2;
    callback(error);
  }
);

const argsOf = (call) => call[1];

beforeEach(() => {
  execFileMock.mockReset();
  mkdirMock.mockClear();
  unlinkMock.mockClear();
  renameMock.mockClear();
  files.clear();
  dumpWriting(COMPLETE_DUMP);
});

describe('dbBackup passes credentials safely', () => {
  // Note on strength, because it varies by environment: the assertions that
  // compare against `config.db.password` only bite when one is configured, and
  // `config` is read when the module loads so a test cannot inject one. A
  // password was present in `.env` when this was written, so the strong branch
  // did run — checked, not assumed. The flag assertion is the part that holds
  // unconditionally, which is all that remains on a checkout with no `.env`.
  //
  // (The value itself is only ever compared in memory. Nothing here writes a
  // credential to disk or to output, and nothing should.)

  it('never puts the database password in argv', async () => {
    await exportDatabase();

    const args = argsOf(execFileMock.mock.calls[0]);
    expect(args.length).toBeGreaterThan(0);

    if (config.db.password) {
      expect(args).not.toContain(config.db.password);
      expect(args.join(' ')).not.toContain(config.db.password);
    }
    expect(args.some((arg) => /^-p/.test(arg) || /^--password/.test(arg))).toBe(false);
  });

  it('passes the password through MYSQL_PWD instead', async () => {
    await exportDatabase();

    const options = execFileMock.mock.calls[0][2];
    if (config.db.password) {
      expect(options.env.MYSQL_PWD).toBe(config.db.password);
    } else {
      expect(options.env.MYSQL_PWD).toBeUndefined();
    }
  });

  it('writes through --result-file rather than capturing a dump on stdout', async () => {
    // A large dump on stdout would be buffered in memory by execFile and can
    // exceed maxBuffer, which fails *after* the work is done.
    await backupDatabase();
    expect(argsOf(execFileMock.mock.calls[0])).toContain('--result-file');
  });
});

describe('backup file naming', () => {
  it('timestamps both entry points, so two runs cannot target one file', async () => {
    // The §6.10 collision: `exportDatabase` used to name files by date alone, so
    // the afternoon export wrote to the morning backup's path.
    const exported = await exportDatabase();
    const backed = await backupDatabase();

    for (const file of [exported, backed]) {
      expect(path.basename(file)).toMatch(/^database-backup-\d{4}-\d{2}-\d{2}T[\d-]+Z\.sql$/);
    }
  });

  it('dumps to a temporary file beside the target, not into /tmp', async () => {
    // Not incidental: `rename` is atomic only within one filesystem, and only an
    // atomic rename guarantees a reader sees the old file or the new one and
    // never a half-written one.
    const finalPath = await exportDatabase();
    const dumpedTo = resultFileFrom(argsOf(execFileMock.mock.calls[0]));

    expect(dumpedTo).not.toBe(finalPath);
    expect(path.dirname(dumpedTo)).toBe(path.dirname(finalPath));
    expect(renameMock).toHaveBeenCalledWith(dumpedTo, finalPath);
  });
});

describe('a failed or incomplete dump cannot replace a good backup', () => {
  it('refuses a dump that failed after writing its header', async () => {
    dumpFailingAfterHeader();

    await expect(exportDatabase()).rejects.toThrow(/Access denied/);

    // The two halves together are the fix. Asserting only the rejection would
    // pass even if the stub had already been moved into place, which was the bug.
    expect(renameMock).not.toHaveBeenCalled();
    expect(unlinkMock).toHaveBeenCalledTimes(1);
  });

  it('refuses an incomplete dump even though mysqldump exited 0', async () => {
    // The case a size or `CREATE TABLE` check would miss, and the reason the
    // trailer is what gets checked: mysqldump reported success, the file looks
    // like a dump, and it holds no data.
    dumpWriting(HEADER_ONLY_STUB);

    await expect(exportDatabase()).rejects.toThrow(/does not end with "-- Dump completed"/);

    expect(renameMock).not.toHaveBeenCalled();
    expect(unlinkMock).toHaveBeenCalledTimes(1);
  });

  it('refuses an empty file', async () => {
    dumpWriting('');

    await expect(exportDatabase()).rejects.toThrow(/empty file/);
    expect(renameMock).not.toHaveBeenCalled();
  });

  it('moves a complete dump into place', async () => {
    // The control. Without it, every assertion above would still pass if the
    // service simply refused everything.
    const filePath = await exportDatabase();

    expect(renameMock).toHaveBeenCalledTimes(1);
    expect(unlinkMock).not.toHaveBeenCalled();
    expect(filePath).toMatch(/database-backup-.*\.sql$/);
  });
});
