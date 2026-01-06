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

describe('subject-context', () => {
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
      SubjectContext: { findOrCreate: vi.fn(), findOne: vi.fn() },
      Category: {},
      Comment: {}
    };
    app = createTestApp({ models, openai });
  });

  it('rejects overly long subject descriptions', async () => {
    const response = await request(app)
      .post('/api/subject-context')
      .send({
        subjectId: 1,
        yearGroupId: 2,
        subjectDescription: 'a'.repeat(2001)
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/Subject description must be/i);
    expect(models.SubjectContext.findOrCreate).not.toHaveBeenCalled();
  });
});
