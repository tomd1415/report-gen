import fs from 'fs';
import path from 'path';
import os from 'os';
import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/db/sequelize.js', () => ({
  sequelize: {
    transaction: async (callback) => callback()
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

describe('import-categories-comments', () => {
  let app;
  let tempFile;
  let models;

  beforeEach(() => {
    fs.mkdirSync('uploads', { recursive: true });
    models = {
      Category: {
        destroy: vi.fn(),
        create: vi.fn().mockResolvedValue({ id: 1 })
      },
      Comment: {
        create: vi.fn()
      },
      Prompt: { findOne: vi.fn() },
      SubjectContext: { findOne: vi.fn() }
    };
    const openai = { responses: { parse: vi.fn() } };
    app = createTestApp({ models, openai });
  });

  afterEach(() => {
    if (tempFile && fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  });

  it('caps comments per category and reports skipped rows', async () => {
    const rows = ['categoryName,commentText'];
    for (let i = 1; i <= 52; i += 1) {
      rows.push(`Strengths,Comment ${i}`);
    }

    tempFile = path.join(os.tmpdir(), `comment-bank-${Date.now()}.csv`);
    fs.writeFileSync(tempFile, rows.join('\n'));

    const response = await request(app)
      .post('/api/import-categories-comments')
      .field('subjectId', '1')
      .field('yearGroupId', '2')
      .attach('file', tempFile);

    expect(response.status).toBe(200);
    expect(response.body.totalCategories).toBe(1);
    expect(response.body.totalComments).toBe(50);
    expect(response.body.skippedRows).toBe(2);
    expect(models.Category.create).toHaveBeenCalledTimes(1);
    expect(models.Comment.create).toHaveBeenCalledTimes(50);
  });
});
