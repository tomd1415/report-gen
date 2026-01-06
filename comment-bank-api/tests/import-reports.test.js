import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
        create: vi.fn()
      }
    };
    app = createTestApp({ models, openai });
  });

  it('replaces pupil names with placeholder in import prompt', async () => {
    openai.responses.parse.mockResolvedValue({
      output_parsed: {
        categories: [
          {
            name: 'Strengths / achievements',
            comments: ['Works hard']
          }
        ]
      }
    });
    models.Category.findAll.mockResolvedValue([]);
    models.Category.create.mockResolvedValue({ id: 10 });
    models.Comment.create.mockResolvedValue({});

    const response = await request(app)
      .post('/api/import-reports')
      .send({
        subjectId: 1,
        yearGroupId: 2,
        pupilNames: 'A.B., Jane*',
        reports: 'A.B. is a joy. Jane* works hard in class.'
      });

    expect(response.status).toBe(200);
    const prompt = openai.responses.parse.mock.calls[0][0].input[0].content;
    expect(prompt).toContain('PUPIL_NAME');
    expect(prompt).not.toContain('A.B.');
    expect(prompt).not.toContain('Jane*');
  });

  it('rejects overly long report imports', async () => {
    const response = await request(app)
      .post('/api/import-reports')
      .send({
        subjectId: 1,
        yearGroupId: 2,
        pupilNames: 'Alex',
        reports: 'a'.repeat(60001)
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/Reports must be/i);
    expect(openai.responses.parse).not.toHaveBeenCalled();
  });
});
