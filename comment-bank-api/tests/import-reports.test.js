import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/db/sequelize.js', () => ({
  sequelize: {
    transaction: async (callback) => callback({})
  }
}));

import { registerRoutes } from '../src/routes/index.js';

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

describe('import-reports', () => {
  let openai;
  let models;
  let app;

  beforeEach(() => {
    openai = {
      responses: {
        parse: vi.fn()
      }
    };
    models = {
      User: {},
      Subject: {},
      YearGroup: {},
      UserSubject: {},
      UserYearGroup: {},
      Prompt: { findOne: vi.fn() },
      SubjectContext: { findOne: vi.fn() },
      Category: {
        findAll: vi.fn(),
        destroy: vi.fn(),
        create: vi.fn()
      },
      Comment: {
        destroy: vi.fn(),
        create: vi.fn()
      }
    };
    app = createTestApp({ models, openai });
  });

  // The pupil-name list was REMOVED on 2026-08-06 (owner decision). Teachers are
  // told on the import page not to paste names; the app holds no roster, so there
  // is nothing to redact against and the pasted text is sent as-is.
  //
  // These tests pin that contract in both directions: the payload no longer
  // carries names, and nothing silently mangles the reports on the way through.
  const promptFor = () => openai.responses.parse.mock.calls[0][0].input[0].content;

  const importReports = async ({ reports }) => {
    openai.responses.parse.mockResolvedValue({
      output_parsed: { categories: [{ name: 'Effort / motivation / attendance', comments: ['Works hard'] }] }
    });
    models.Category.findAll.mockResolvedValue([]);
    models.Category.create.mockResolvedValue({ id: 10 });
    models.Comment.create.mockResolvedValue({});
    const response = await request(app)
      .post('/api/import-reports')
      .send({ subjectId: 1, yearGroupId: 2, reports });
    expect(response.status).toBe(200);
    return promptFor();
  };

  it('sends the pasted reports through unmodified', async () => {
    // No redaction pass means no corruption either: text a teacher pastes must
    // reach the prompt exactly as typed, so what they proof-read is what is sent.
    const reports = 'Confident with fractions. Will improve next term. 3D modelling covered.';
    expect(await importReports({ reports })).toContain(reports);
  });

  it('preserves a PUPIL_NAME placeholder a teacher typed themselves', async () => {
    // The guidance tells teachers to write PUPIL_NAME in place of a name, so the
    // placeholder must survive to the prompt.
    expect(await importReports({ reports: 'PUPIL_NAME has worked hard.' }))
      .toContain('PUPIL_NAME has worked hard.');
  });

  it('ignores a pupilNames field if a stale client still sends one', async () => {
    // The field is gone from both import pages, but a cached page could still
    // post it. It must be dropped, not stored, and not echoed into the prompt.
    //
    // Ignored is not the whole contract as of 2026-08-13: the server also logs a
    // deprecation warning, so a stale client is visible rather than invisible.
    // That half lives in tests/pupil-names-deprecation.test.js, including the
    // assertion that the warning must NOT contain the names. Cross-referenced
    // deliberately — two tests describing one endpoint differently is how a
    // contract quietly ends up with two versions.
    openai.responses.parse.mockResolvedValue({
      output_parsed: { categories: [{ name: 'Effort / motivation / attendance', comments: ['Works hard'] }] }
    });
    models.Category.findAll.mockResolvedValue([]);
    models.Category.create.mockResolvedValue({ id: 10 });
    models.Comment.create.mockResolvedValue({});

    const response = await request(app)
      .post('/api/import-reports')
      .send({ subjectId: 1, yearGroupId: 2, reports: 'Worked hard.', pupilNames: 'Alex, Sam' });

    expect(response.status).toBe(200);
    const prompt = promptFor();
    expect(prompt).not.toContain('Alex');
    expect(prompt).not.toContain('Sam');
  });

  it('returns 502 and leaves the bank alone when the AI returns nothing usable', async () => {
    // The service throws ReportImportEmptyResultError; this asserts the route
    // actually surfaces it as a 502 with a message a teacher can act on, rather
    // than collapsing it into a generic 500.
    models.Category.findAll.mockResolvedValue([]);
    openai.responses.parse
      .mockResolvedValueOnce({ output_parsed: { categories: [] } })
      .mockResolvedValueOnce({ output_parsed: { flagged: [] } });

    const response = await request(app)
      .post('/api/import-reports')
      .send({ subjectId: 1, yearGroupId: 2, reports: 'Nothing useful here.' });

    expect(response.status).toBe(502);
    expect(response.body.message).toMatch(/comment bank is unchanged/i);
    expect(models.Category.destroy).not.toHaveBeenCalled();
    expect(models.Comment.create).not.toHaveBeenCalled();
  });

  it('rejects overly long report imports', async () => {
    const response = await request(app)
      .post('/api/import-reports')
      .send({
        subjectId: 1,
        yearGroupId: 2,
        reports: 'a'.repeat(60001)
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/Reports must be/i);
    expect(openai.responses.parse).not.toHaveBeenCalled();
  });

  it('filters out-of-scope comments during import using the subject description', async () => {
    models.SubjectContext.findOne.mockResolvedValue({
      subjectDescription: 'Mathematics covering number, fractions, and basic geometry.'
    });
    models.Category.findAll.mockResolvedValue([]);
    models.Category.create.mockResolvedValue({ id: 10 });
    models.Comment.create.mockResolvedValue({});

    openai.responses.parse
      .mockResolvedValueOnce({
        output_parsed: {
          categories: [
            {
              name: 'Topics studied / knowledge / skills acquired',
              comments: ['3D modelling', 'Fractions']
            },
            {
              name: 'Effort / motivation / attendance',
              comments: ['Works hard']
            }
          ]
        }
      })
      .mockResolvedValueOnce({
        output_parsed: {
          flagged: [
            {
              category: 'Topics studied / knowledge / skills acquired',
              comment: '3D modelling',
              reason: 'Out of scope'
            }
          ]
        }
      });

    const response = await request(app)
      .post('/api/import-reports')
      .send({
        subjectId: 1,
        yearGroupId: 2,
        reports: 'Alex is confident in fractions. Alex models 3D shapes.'
      });

    expect(response.status).toBe(200);
    const createdComments = models.Comment.create.mock.calls.map((call) => call[0].text);
    expect(createdComments).toContain('Fractions');
    expect(createdComments).toContain('Works hard');
    expect(createdComments).not.toContain('3D modelling');
  });
});
