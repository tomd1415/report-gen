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

  // The four /api/categories routes have no auth-guard middleware (see
  // docs/PROJECT_STATE.md §6.9). That makes it worth proving separately that a
  // *logged-in* user still cannot reach another user's category — because the
  // "it throws before any query" argument that makes the logged-OUT case
  // harmless gives no protection at all once a session exists. If any of these
  // took its scoping id from the request instead of the session, the missing
  // guard would be a disclosure between teachers rather than a wrong status
  // code. These assert that the id comes from req.session.user.id.
  it('scopes GET /api/categories/:id to the session user, not the request', async () => {
    models.Category.findOne.mockResolvedValue(null);

    const response = await request(app).get('/api/categories/42?userId=2');

    expect(response.status).toBe(404);
    expect(models.Category.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: '42', userId: 1 } })
    );
  });

  it('scopes PUT /api/categories/:id to the session user, not the request body', async () => {
    models.Category.findOne.mockResolvedValue(null);

    const response = await request(app)
      .put('/api/categories/42')
      .send({ name: 'Renamed', userId: 2 });

    expect(response.status).toBe(404);
    expect(models.Category.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: '42', userId: 1 } })
    );
  });

  it('scopes DELETE /api/categories/:id to the session user', async () => {
    models.Category.findOne.mockResolvedValue(null);

    const response = await request(app).delete('/api/categories/42');

    expect(response.status).toBe(404);
    expect(models.Category.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: '42', userId: 1 } })
    );
  });

  it('creates a category owned by the session user even if the body claims another', async () => {
    models.Category.create = vi.fn().mockResolvedValue({ id: 5 });

    await request(app)
      .post('/api/categories')
      .send({ name: 'New category', subjectId: 1, yearGroupId: 2, userId: 2 });

    expect(models.Category.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 1 })
    );
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
