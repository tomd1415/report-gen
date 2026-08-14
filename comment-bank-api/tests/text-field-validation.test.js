import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/db/sequelize.js', () => ({
  sequelize: { transaction: async (callback) => callback({}) }
}));

import { registerRoutes } from '../src/routes/index.js';

// Merging the two `cleanText` copies unified on `String(text)` — right for a
// text helper, because one should not throw on non-text (§6.23). At a request
// boundary it is wrong: it turns a bad request into **stored garbage**.
//
// Measured before this file existed: `POST /api/categories` with
// `{"name": {"a":1}}` answered **200** and stored a category called
// `"[object Object]"`. Before the merge it answered 500 — so the merge turned a
// loud failure into a quiet one, which is the shape this project keeps hunting.
// I introduced it, under a de-duplication item, having recorded the consequence
// rather than smuggling the validation change in alongside.
//
// The fix belongs at the boundary, not in `cleanText`. If these tests ever need
// `tests/lib-text.test.js` changed to pass, the coercion is being reverted
// instead — a different decision, and one to take deliberately.

const createTestApp = ({ models }) => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = { user: { id: 1, username: 'test', isAdmin: true } };
    next();
  });
  registerRoutes(app, { models, openai: { responses: { parse: vi.fn() } } });
  return app;
};

/** Every shape a JSON body can carry that is not a string. */
const NON_STRINGS = [
  ['an object', { a: 1 }],
  ['an array', ['x', 'y']],
  ['a number', 123],
  ['a boolean', true]
];

describe('a text field that is not text is refused, not coerced', () => {
  let models;
  let app;

  beforeEach(() => {
    models = {
      User: { findOne: vi.fn(), findByPk: vi.fn(), create: vi.fn() },
      Subject: { findOne: vi.fn(), findByPk: vi.fn(), create: vi.fn(), findAll: vi.fn().mockResolvedValue([]) },
      YearGroup: { findOne: vi.fn(), findByPk: vi.fn(), create: vi.fn(), findAll: vi.fn().mockResolvedValue([]) },
      UserSubject: {}, UserYearGroup: {},
      Prompt: { findOne: vi.fn() },
      SubjectContext: { findOne: vi.fn() },
      Category: { findAll: vi.fn().mockResolvedValue([]), findOne: vi.fn(), findByPk: vi.fn(), destroy: vi.fn(), create: vi.fn().mockResolvedValue({ id: 10 }) },
      Comment: { findOne: vi.fn(), findByPk: vi.fn(), destroy: vi.fn(), create: vi.fn().mockResolvedValue({ id: 5 }) },
      ImportJob: { create: vi.fn() }
    };
    app = createTestApp({ models });
  });

  it.each(NON_STRINGS)('refuses %s as a category name, and stores nothing', async (_label, value) => {
    const response = await request(app)
      .post('/api/categories')
      .send({ name: value, subjectId: 1, yearGroupId: 2 });

    expect(response.status).toBe(400);
    // Both halves together. Asserting only the status would pass even if the row
    // had been written first — the same pairing the empty-import tests use.
    expect(models.Category.create).not.toHaveBeenCalled();
  });

  it('says the field must be text, rather than that it is missing', async () => {
    // "Category name is required" would be a lie: one was sent. A teacher acting
    // on that message would retype the same thing (docs/TESTING.md rule 4c).
    const response = await request(app)
      .post('/api/categories')
      .send({ name: { a: 1 }, subjectId: 1, yearGroupId: 2 });

    expect(response.body.message).toMatch(/text/i);
  });

  it('refuses a non-string comment, and stores nothing', async () => {
    models.Category.findOne.mockResolvedValue({ id: 1, userId: 1 });

    const response = await request(app)
      .post('/api/comments')
      .send({ text: { a: 1 }, categoryId: 1 });

    expect(response.status).toBe(400);
    expect(models.Comment.create).not.toHaveBeenCalled();
  });

  it('still accepts a normal string', async () => {
    // The control. Without it every assertion above would pass if the routes
    // simply rejected everything.
    const response = await request(app)
      .post('/api/categories')
      .send({ name: 'Effort and attendance', subjectId: 1, yearGroupId: 2 });

    expect(response.status).toBe(200);
    expect(models.Category.create).toHaveBeenCalled();
  });

  it('still treats a missing field as missing, not as a type error', async () => {
    // Absent is not the same as wrong-typed, and the messages must differ or the
    // distinction is useless to whoever reads them.
    const response = await request(app)
      .post('/api/categories')
      .send({ subjectId: 1, yearGroupId: 2 });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/required/i);
  });
});
