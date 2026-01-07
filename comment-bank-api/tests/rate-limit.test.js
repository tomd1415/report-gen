import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi } from 'vitest';

const buildApp = async ({ max, windowMs }) => {
  const originalMax = process.env.RATE_LIMIT_MAX;
  const originalWindow = process.env.RATE_LIMIT_WINDOW_MS;

  process.env.RATE_LIMIT_MAX = String(max);
  process.env.RATE_LIMIT_WINDOW_MS = String(windowMs);

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
    Prompt: { findOne: vi.fn() },
    SubjectContext: { findOne: vi.fn() }
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
    restoreEnv: () => {
      if (originalMax === undefined) {
        delete process.env.RATE_LIMIT_MAX;
      } else {
        process.env.RATE_LIMIT_MAX = originalMax;
      }
      if (originalWindow === undefined) {
        delete process.env.RATE_LIMIT_WINDOW_MS;
      } else {
        process.env.RATE_LIMIT_WINDOW_MS = originalWindow;
      }
    }
  };
};

describe('rate limiting', () => {
  it('limits generate-report after the configured max', async () => {
    const { app, restoreEnv } = await buildApp({ max: 2, windowMs: 60000 });

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
    restoreEnv();
  });
});
