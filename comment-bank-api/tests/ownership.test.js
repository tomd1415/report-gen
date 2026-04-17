import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('comment bank ownership checks', () => {
  let models;
  let app;

  beforeEach(() => {
    models = {
      User: {},
      Subject: {},
      YearGroup: {},
      UserSubject: {},
      UserYearGroup: {},
      Prompt: {
        findOne: vi.fn()
      },
      SubjectContext: {},
      Category: {
        findOne: vi.fn()
      },
      Comment: {
        findOne: vi.fn(),
        create: vi.fn()
      }
    };
    app = createTestApp({ models });
  });

  it('rejects adding a comment to a category not owned by the current user', async () => {
    models.Category.findOne.mockResolvedValue(null);

    const response = await request(app)
      .post('/api/comments')
      .send({
        categoryId: 99,
        text: 'Works carefully'
      });

    expect(response.status).toBe(404);
    expect(models.Category.findOne).toHaveBeenCalledWith({
      where: { id: 99, userId: 1 }
    });
    expect(models.Comment.create).not.toHaveBeenCalled();
  });

  it('loads comments through the comment category owner', async () => {
    models.Comment.findOne.mockResolvedValue(null);

    const response = await request(app)
      .put('/api/comments/77')
      .send({ text: 'Updated comment' });

    expect(response.status).toBe(404);
    expect(models.Comment.findOne).toHaveBeenCalledWith({
      where: { id: '77' },
      include: [{
        model: models.Category,
        where: { userId: 1 }
      }]
    });
  });

  it('rejects prompt updates when the prompt is not owned by the current user', async () => {
    models.Prompt.findOne.mockResolvedValue(null);

    const response = await request(app)
      .put('/api/prompts/5')
      .send({ promptPart: 'New prompt text' });

    expect(response.status).toBe(404);
    expect(models.Prompt.findOne).toHaveBeenCalledWith({
      where: { id: '5', userId: 1 }
    });
  });
});
