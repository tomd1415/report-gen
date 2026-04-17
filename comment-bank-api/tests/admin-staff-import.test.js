import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/db/sequelize.js', () => ({
  sequelize: {
    transaction: async (callback) => callback({})
  }
}));

import { registerRoutes } from '../src/routes/index.js';

const createTestApp = ({ models, openai, isAdmin = true }) => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = { user: { id: 1, username: 'admin', isAdmin } };
    next();
  });
  registerRoutes(app, { models, openai });
  return app;
};

describe('admin staff report imports', () => {
  let openai;
  let models;

  beforeEach(() => {
    openai = {
      responses: {
        parse: vi.fn().mockResolvedValue({
          output_parsed: {
            categories: [
              {
                name: 'Strengths / achievements',
                comments: ['Works independently']
              }
            ]
          }
        })
      }
    };
    models = {
      User: {
        findByPk: vi.fn().mockResolvedValue({ id: 2, username: 'teacher' })
      },
      Subject: {},
      YearGroup: {},
      UserSubject: {
        findOrCreate: vi.fn().mockResolvedValue([{}, true])
      },
      UserYearGroup: {
        findOrCreate: vi.fn().mockResolvedValue([{}, true])
      },
      Prompt: { findOne: vi.fn(), findOrCreate: vi.fn() },
      SubjectContext: { findOne: vi.fn().mockResolvedValue(null), findOrCreate: vi.fn() },
      Category: {
        findAll: vi.fn().mockResolvedValue([]),
        destroy: vi.fn(),
        create: vi.fn().mockResolvedValue({ id: 10 })
      },
      Comment: {
        destroy: vi.fn(),
        create: vi.fn()
      }
    };
  });

  it('lets an admin import reports into a target staff comment bank', async () => {
    const app = createTestApp({ models, openai });

    const response = await request(app)
      .post('/api/admin/staff/2/import-reports')
      .send({
        subjectId: 3,
        yearGroupId: 4,
        pupilNames: 'Alex',
        reports: 'Alex works independently in lessons.'
      });

    expect(response.status).toBe(200);
    expect(models.User.findByPk).toHaveBeenCalledWith(2);
    expect(models.Category.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 2, subjectId: 3, yearGroupId: 4 }),
      expect.any(Object)
    );
    expect(models.UserSubject.findOrCreate).toHaveBeenCalledWith({
      where: { userId: 2, subjectId: 3 }
    });
    expect(models.UserYearGroup.findOrCreate).toHaveBeenCalledWith({
      where: { userId: 2, yearGroupId: 4 }
    });
    expect(response.body.targetUser.username).toBe('teacher');
    expect(response.body.totalComments).toBe(1);
  });

  it('blocks non-admin users from target staff imports', async () => {
    const app = createTestApp({ models, openai, isAdmin: false });

    const response = await request(app)
      .post('/api/admin/staff/2/import-reports')
      .send({
        subjectId: 3,
        yearGroupId: 4,
        pupilNames: 'Alex',
        reports: 'Alex works independently in lessons.'
      });

    expect(response.status).toBe(403);
    expect(models.User.findByPk).not.toHaveBeenCalled();
    expect(openai.responses.parse).not.toHaveBeenCalled();
  });

  it('requires explicit confirmation for replace mode', async () => {
    const app = createTestApp({ models, openai });

    const response = await request(app)
      .post('/api/admin/staff/2/import-reports')
      .send({
        subjectId: 3,
        yearGroupId: 4,
        pupilNames: 'Alex',
        reports: 'Alex works independently in lessons.',
        mode: 'replace'
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/requires confirmation/i);
    expect(openai.responses.parse).not.toHaveBeenCalled();
  });
});
