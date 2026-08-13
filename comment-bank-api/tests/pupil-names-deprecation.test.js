import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/db/sequelize.js', () => ({
  sequelize: { transaction: async (callback) => callback({}) }
}));

import { registerRoutes } from '../src/routes/index.js';

// The import page's possible-name warning is entirely browser-side, so a stale
// cached client — or a crafted request — bypasses it. The `pupilNames` field was
// removed on 2026-08-06, and until now the server dropped it in silence: nothing
// recorded that a client was still sending one, so the situation could persist
// indefinitely without anyone knowing.
//
// The generation path took the stronger line and REJECTS a transmitted name with
// a 400. **The owner chose differently for import: accept, but log a deprecation
// warning.** That is what these tests pin — not rejection.
//
// The rule that shapes the implementation, and the reason this file exists as
// much as the warning does: **the warning must not contain the names.** The whole
// point of removing the field was that no pupil-name list should be held
// server-side, and a log line is server-side storage — usually the most widely
// copied kind, since logs get shipped, tailed and pasted into tickets. A naive
// `console.warn('pupilNames:', pupilNames)` would recreate exactly the artefact
// the decision removed.

const createTestApp = ({ models, openai }) => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = { user: { id: 1, username: 'test', isAdmin: true } };
    next();
  });
  registerRoutes(app, { models, openai });
  return app;
};

describe('a stale client sending pupilNames', () => {
  let openai;
  let models;
  let app;
  let warn;

  beforeEach(() => {
    openai = { responses: { parse: vi.fn() } };
    models = {
      User: {}, Subject: {}, YearGroup: {}, UserSubject: {}, UserYearGroup: {},
      Prompt: { findOne: vi.fn() },
      SubjectContext: { findOne: vi.fn() },
      Category: { findAll: vi.fn(), destroy: vi.fn(), create: vi.fn() },
      Comment: { destroy: vi.fn(), create: vi.fn() }
    };
    app = createTestApp({ models, openai });
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    openai.responses.parse.mockResolvedValue({
      output_parsed: { categories: [{ name: 'Effort / motivation / attendance', comments: ['Works hard'] }] }
    });
    models.Category.findAll.mockResolvedValue([]);
    models.Category.create.mockResolvedValue({ id: 10 });
    models.Comment.create.mockResolvedValue({});
    models.SubjectContext.findOne.mockResolvedValue(null);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  const postWithNames = (path) => request(app)
    .post(path)
    .send({ subjectId: 1, yearGroupId: 2, reports: 'Worked hard.', pupilNames: 'Alex Brightwater, Sam Threlfall' });

  it('is still served — the owner chose to accept rather than reject', async () => {
    // Deliberately NOT a 400. The generation path rejects; import does not. If
    // this ever becomes a rejection it is a decision to take again, not a
    // consistency tidy-up.
    const response = await postWithNames('/api/import-reports');
    expect(response.status).toBe(200);
  });

  it('logs a deprecation warning naming the field and the endpoint', async () => {
    await postWithNames('/api/import-reports');

    const logged = warn.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(logged).toMatch(/pupilNames/);
    expect(logged).toMatch(/import-reports/);
    // It has to be actionable: someone reading a log needs to know the client is
    // stale, not merely that a field was unexpected.
    expect(logged).toMatch(/stale|deprecat|no longer/i);
  });

  it('NEVER writes the names themselves into the log', async () => {
    // The assertion this file exists for. A log line is server-side storage, and
    // the decision that removed this field was that no pupil-name list should be
    // held server-side at all.
    await postWithNames('/api/import-reports');

    const logged = warn.mock.calls.map((call) => JSON.stringify(call)).join('\n');
    expect(logged).not.toMatch(/Alex/);
    expect(logged).not.toMatch(/Brightwater/);
    expect(logged).not.toMatch(/Sam/);
    expect(logged).not.toMatch(/Threlfall/);
  });

  it('warns on the admin staff import path too', async () => {
    // Two endpoints accept report text; a warning on only one of them would go
    // quiet exactly when an admin is importing on someone else's behalf.
    models.User = { findByPk: vi.fn().mockResolvedValue({ id: 2, username: 'teacher' }) };
    app = createTestApp({ models, openai });
    warn.mockClear();

    await postWithNames('/api/admin/staff/2/import-reports');

    const logged = warn.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(logged).toMatch(/pupilNames/);
  });

  it('says nothing when no pupilNames field is sent', async () => {
    // The control. Without it, a warning printed unconditionally would satisfy
    // every assertion above while telling an operator nothing.
    await request(app)
      .post('/api/import-reports')
      .send({ subjectId: 1, yearGroupId: 2, reports: 'Worked hard.' });

    const logged = warn.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(logged).not.toMatch(/pupilNames/);
  });
});
