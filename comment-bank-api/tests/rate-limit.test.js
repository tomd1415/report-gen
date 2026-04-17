import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi } from 'vitest';

const withTemporaryEnv = (values) => {
  const originals = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]])
  );

  Object.entries(values).forEach(([key, value]) => {
    process.env[key] = String(value);
  });

  return () => {
    Object.entries(originals).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  };
};

const buildApp = async ({ max, windowMs, authMax, authWindowMs, models: modelOverrides = {} }) => {
  const restoreEnv = withTemporaryEnv({
    RATE_LIMIT_MAX: max,
    RATE_LIMIT_WINDOW_MS: windowMs,
    AUTH_RATE_LIMIT_MAX: authMax ?? 20,
    AUTH_RATE_LIMIT_WINDOW_MS: authWindowMs ?? 60000
  });

  vi.resetModules();
  const { registerRoutes } = await import('../src/routes/index.js');

  const openai = {
    responses: {
      parse: vi.fn().mockResolvedValue({
        output_parsed: { paragraphs: ['p1', 'p2', 'p3', 'p4'] }
      })
    }
  };

  const models = {
    User: { findOne: vi.fn() },
    Prompt: { findOne: vi.fn() },
    SubjectContext: { findOne: vi.fn() },
    ...modelOverrides
  };

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = { user: { id: 1, username: 'test', isAdmin: true } };
    next();
  });
  registerRoutes(app, { models, openai });

  return {
    app,
    restoreEnv
  };
};

describe('rate limiting', () => {
  it('limits generate-report after the configured max', async () => {
    const { app, restoreEnv } = await buildApp({ max: 2, windowMs: 60000 });

    try {
      const payload = {
        name: 'Alex',
        pronouns: 'they/them',
        subjectId: 1,
        yearGroupId: 2
      };

      const first = await request(app).post('/generate-report').send(payload);
      const second = await request(app).post('/generate-report').send(payload);
      const third = await request(app).post('/generate-report').send(payload);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(third.status).toBe(429);
    } finally {
      restoreEnv();
    }
  });

  it('limits repeated login attempts after the configured auth max', async () => {
    const { app, restoreEnv } = await buildApp({
      max: 30,
      windowMs: 60000,
      authMax: 2,
      authWindowMs: 60000
    });

    try {
      const payload = { username: 'teacher', password: 'wrong-password' };

      const first = await request(app).post('/api/login').send(payload);
      const second = await request(app).post('/api/login').send(payload);
      const third = await request(app).post('/api/login').send(payload);

      expect(first.status).toBe(401);
      expect(second.status).toBe(401);
      expect(third.status).toBe(429);
      expect(third.body.message).toMatch(/too many authentication attempts/i);
    } finally {
      restoreEnv();
    }
  });
});
