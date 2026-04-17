import express from 'express';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { describe, it, expect, vi } from 'vitest';
import { registerRoutes } from '../src/routes/index.js';

const createTestApp = ({ models }) => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = { user: { id: 1, username: 'teacher', isAdmin: false } };
    next();
  });
  const openai = { responses: { parse: vi.fn() } };
  registerRoutes(app, { models, openai });
  return app;
};

describe('change-password', () => {
  it('accepts the current password under the oldPassword field', async () => {
    const user = {
      id: 1,
      password: await bcrypt.hash('old-secret', 10),
      save: vi.fn()
    };
    const models = {
      User: {
        findByPk: vi.fn().mockResolvedValue(user)
      },
      Subject: {},
      YearGroup: {},
      UserSubject: {},
      UserYearGroup: {},
      Prompt: {},
      SubjectContext: {},
      Category: {},
      Comment: {}
    };
    const app = createTestApp({ models });

    const response = await request(app)
      .post('/api/change-password')
      .send({
        oldPassword: 'old-secret',
        newPassword: 'new-secret'
      });

    expect(response.status).toBe(200);
    expect(user.save).toHaveBeenCalled();
    await expect(bcrypt.compare('new-secret', user.password)).resolves.toBe(true);
  });
});
