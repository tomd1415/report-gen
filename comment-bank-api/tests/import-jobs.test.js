import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/db/sequelize.js', () => ({
  sequelize: { transaction: async (callback) => callback({}) }
}));

import { registerRoutes } from '../src/routes/index.js';

// Admins can import into — or REPLACE — any staff member's comment bank, and
// until now nothing recorded that it happened (docs/PROJECT_STATE.md §6.6).
// `ImportJobs` is that record, and the owner's answer folded decision 2(B) into
// it: the same row carries whether the confirm-before-send step was reported.
//
// The constraint that shapes every assertion here: **this table must be readable
// by someone with no right to see pupil data.** No report text, no extracted
// comments, no free text, no names. The last test in this file is the one that
// matters most, and it is written to fail loudly if any of that leaks in.

const createTestApp = ({ models, openai, session }) => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = { user: session };
    next();
  });
  registerRoutes(app, { models, openai });
  return app;
};

describe('import jobs are recorded', () => {
  let openai;
  let models;
  let jobs;

  beforeEach(() => {
    jobs = [];
    openai = { responses: { parse: vi.fn() } };
    models = {
      User: { findByPk: vi.fn().mockResolvedValue({ id: 2, username: 'teacher' }) },
      Subject: {}, YearGroup: {},
      // The admin path calls ensureUserVisibility after importing; without these
      // the handler 500s and the test would be measuring the harness, not the code.
      UserSubject: { findOrCreate: vi.fn().mockResolvedValue([{}, true]) },
      UserYearGroup: { findOrCreate: vi.fn().mockResolvedValue([{}, true]) },
      Prompt: { findOne: vi.fn() },
      SubjectContext: { findOne: vi.fn().mockResolvedValue(null) },
      Category: { findAll: vi.fn().mockResolvedValue([]), destroy: vi.fn(), create: vi.fn().mockResolvedValue({ id: 10 }) },
      Comment: { destroy: vi.fn(), create: vi.fn().mockResolvedValue({}) },
      ImportJob: { create: vi.fn(async (row) => { jobs.push(row); return { id: jobs.length, ...row }; }) }
    };
    openai.responses.parse.mockResolvedValue({
      output_parsed: { categories: [{ name: 'Effort / motivation / attendance', comments: ['Works hard'] }] }
    });
  });

  const teacherApp = () => createTestApp({ models, openai, session: { id: 1, username: 'teacher', isAdmin: false } });
  const adminApp = () => createTestApp({ models, openai, session: { id: 9, username: 'admin', isAdmin: true } });

  it('records a successful teacher import against the teacher', async () => {
    const response = await request(teacherApp())
      .post('/api/import-reports')
      .send({ subjectId: 1, yearGroupId: 2, reports: 'A steady term.', confirmed: true });

    expect(response.status).toBe(200);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      actorUserId: 1,
      ownerUserId: 1,
      subjectId: 1,
      yearGroupId: 2,
      source: 'reports',
      status: 'success',
      confirmed: true
    });
  });

  it('records who the admin acted FOR, not just who acted', async () => {
    // The case §6.6 exists for. actor and owner differing is the whole point:
    // "an admin replaced someone else's bank" is the question the table answers.
    const response = await request(adminApp())
      .post('/api/admin/staff/2/import-reports')
      .send({ subjectId: 1, yearGroupId: 2, reports: 'A steady term.', mode: 'merge' });

    expect(response.status).toBe(200);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ actorUserId: 9, ownerUserId: 2, source: 'reports' });
    expect(jobs[0].actorUserId).not.toBe(jobs[0].ownerUserId);
  });

  it('records a FAILED import, not only successful ones', async () => {
    // Failures matter more than successes here. An import that aborted because
    // the model returned nothing usable (§6.3.3) should leave a trace that it was
    // attempted — otherwise the record shows a bank that simply stopped changing.
    openai.responses.parse.mockResolvedValue({ output_parsed: { categories: [] } });

    const response = await request(teacherApp())
      .post('/api/import-reports')
      .send({ subjectId: 1, yearGroupId: 2, reports: 'A steady term.' });

    expect(response.status).toBe(502);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ status: 'failed' });
    expect(jobs[0].errorMessage).toBeTruthy();
  });

  it('records confirmed:null when the client does not say, distinct from false', async () => {
    // A stale client sends nothing. That is not the same as a client that
    // reported the confirm was skipped, and the column must keep them apart.
    await request(teacherApp())
      .post('/api/import-reports')
      .send({ subjectId: 1, yearGroupId: 2, reports: 'A steady term.' });

    expect(jobs[0].confirmed).toBeNull();
  });

  it('never lets a failed record block the import itself', async () => {
    // The audit trail is not worth losing a teacher's import over. If the write
    // fails the import must still succeed, loudly in the log rather than to the
    // user.
    models.ImportJob.create.mockRejectedValue(new Error('table is missing'));
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await request(teacherApp())
      .post('/api/import-reports')
      .send({ subjectId: 1, yearGroupId: 2, reports: 'A steady term.' });

    expect(response.status).toBe(200);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('stores NO report text, comments, free text or names', async () => {
    // The assertion this table lives or dies by. Written as a sweep over the
    // whole recorded row rather than a list of fields, so a column added later
    // cannot quietly carry content past it.
    const secret = 'Alex Brightwater worked hard on quadratics this term';
    openai.responses.parse.mockResolvedValue({
      output_parsed: { categories: [{ name: 'Effort / motivation / attendance', comments: [secret] }] }
    });

    await request(teacherApp())
      .post('/api/import-reports')
      .send({ subjectId: 1, yearGroupId: 2, reports: secret, confirmed: true });

    const recorded = JSON.stringify(jobs);
    expect(recorded).not.toMatch(/Alex/);
    expect(recorded).not.toMatch(/Brightwater/);
    expect(recorded).not.toMatch(/quadratics/);
    expect(recorded).not.toMatch(/worked hard/i);
  });
});
