import express from 'express';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { describe, expect, it, vi } from 'vitest';
import { registerRoutes } from '../src/routes/index.js';

const createModels = (userOverrides = {}) => ({
  User: {
    findAll: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    ...userOverrides
  },
  Subject: {},
  YearGroup: {},
  UserSubject: {},
  UserYearGroup: {},
  Prompt: {},
  SubjectContext: {},
  Category: {},
  Comment: {}
});

const createTestApp = ({ models = createModels(), sessionUser = { id: 1, username: 'admin', isAdmin: true } } = {}) => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    if (sessionUser) {
      req.session = { user: sessionUser };
    }
    next();
  });
  const openai = { responses: { parse: vi.fn() } };
  registerRoutes(app, { models, openai });
  return app;
};

describe('health endpoint', () => {
  it('responds without requiring a session', async () => {
    const app = createTestApp({ sessionUser: null });

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, status: 'ok' });
  });
});

describe('admin user management', () => {
  it('creates users with a hashed password and without returning the hash', async () => {
    const models = createModels({
      create: vi.fn().mockResolvedValue({ id: 2, username: 'teacher', isAdmin: false })
    });
    const app = createTestApp({ models });

    const response = await request(app)
      .post('/api/users')
      .send({ username: ' teacher ', password: 'secret', isAdmin: false });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: 'User added successfully',
      user: { id: 2, username: 'teacher', isAdmin: false }
    });
    expect(response.body.user.password).toBeUndefined();
    const createdPayload = models.User.create.mock.calls[0][0];
    expect(createdPayload.username).toBe('teacher');
    await expect(bcrypt.compare('secret', createdPayload.password)).resolves.toBe(true);
  });

  it('rejects blank passwords before creating a user', async () => {
    const models = createModels();
    const app = createTestApp({ models });

    const response = await request(app)
      .post('/api/users')
      .send({ username: 'teacher', password: '   ' });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/password is required/i);
    expect(models.User.create).not.toHaveBeenCalled();
  });

  it('returns a clear duplicate-user error', async () => {
    const duplicateError = new Error('duplicate');
    duplicateError.name = 'SequelizeUniqueConstraintError';
    const models = createModels({
      create: vi.fn().mockRejectedValue(duplicateError)
    });
    const app = createTestApp({ models });

    const response = await request(app)
      .post('/api/users')
      .send({ username: 'teacher', password: 'secret' });

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/already exists/i);
  });

  it('blocks non-admin users from creating users', async () => {
    const models = createModels();
    const app = createTestApp({
      models,
      sessionUser: { id: 2, username: 'teacher', isAdmin: false }
    });

    const response = await request(app)
      .post('/api/users')
      .send({ username: 'another', password: 'secret' });

    expect(response.status).toBe(403);
    expect(models.User.create).not.toHaveBeenCalled();
  });

  it('deletes an existing user by username', async () => {
    const user = { destroy: vi.fn().mockResolvedValue() };
    const models = createModels({
      findOne: vi.fn().mockResolvedValue(user)
    });
    const app = createTestApp({ models });

    const response = await request(app).delete('/api/users/teacher');

    expect(response.status).toBe(204);
    expect(models.User.findOne).toHaveBeenCalledWith({ where: { username: 'teacher' } });
    expect(user.destroy).toHaveBeenCalled();
  });

  it('resets a user password with a hash', async () => {
    const user = { password: 'old-hash', save: vi.fn().mockResolvedValue() };
    const models = createModels({
      findOne: vi.fn().mockResolvedValue(user)
    });
    const app = createTestApp({ models });

    const response = await request(app)
      .put('/api/admin/user/teacher/password')
      .send({ newPassword: 'new-secret' });

    expect(response.status).toBe(200);
    await expect(bcrypt.compare('new-secret', user.password)).resolves.toBe(true);
    expect(user.save).toHaveBeenCalled();
  });

  it('rejects blank password resets before loading the user', async () => {
    const models = createModels();
    const app = createTestApp({ models });

    const response = await request(app)
      .put('/api/admin/user/teacher/password')
      .send({ newPassword: '' });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/new password is required/i);
    expect(models.User.findOne).not.toHaveBeenCalled();
  });
});
