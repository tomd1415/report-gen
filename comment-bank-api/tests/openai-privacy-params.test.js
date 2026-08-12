import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/db/sequelize.js', () => ({
  sequelize: {
    transaction: async (callback) => callback({})
  }
}));

import { registerRoutes } from '../src/routes/index.js';

// Why this exists
// ---------------
// Two privacy parameters ride on every OpenAI request, and both come from one
// helper, `buildOpenAIParams` in src/routes/index.js:
//
//   store: false          — do not retain this payload at OpenAI
//   safety_identifier     — a SHA-256 of the session user id, never the id itself
//
// Every call site spreads that helper today; that was verified by hand on
// 2026-08-09 and it was true. Nothing made it stay true. A sixth
// `openai.responses.parse` written without the spread gets `store` defaulting to
// **true** — the pasted report text is then retained by OpenAI — and sends no
// identifier, and not one existing test would go red. It is the same two-lists
// shape as the auth matrix (§6.9) and the migration glob (§6.13), guarding the
// most load-bearing privacy claim in the project.
//
// So this file works in two directions:
//
//   1. RUNTIME — drive every OpenAI-calling path with a recording stub and assert
//      what was actually sent. Not a grep for the spread: a source scan for
//      `store: false` is satisfied by a comment saying `store: false`, which is
//      exactly the trap in /claude-guidance/LESSONS.md §3.
//   2. CENSUS — count the call sites in the source and fail if a new one appears
//      that this file does not drive. Direction 1 alone cannot see a path it does
//      not exercise, so without this the gate would quietly stop covering the
//      thing it is named after.
//
// See docs/PROJECT_STATE.md §6.14 and docs/server_mjs.txt.

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(here, '..', 'src');

/**
 * The call sites this file drives. Exact, because a missed one retains data.
 *
 * Scope is `src/` only. That is deliberate rather than an oversight: the OpenAI
 * key never reaches the browser, so `public/` cannot call the API, and `scripts/`
 * is build tooling. If either of those ever gains an OpenAI call, widen
 * `srcDir` — the census will not notice on its own.
 */
const KNOWN_CALL_SITES = {
  'routes/index.js': 2,       // relevance filter, then report generation
  'services/reportImport.js': 3 // relevance, extraction, merge
};

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

const listSourceFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });

describe('every OpenAI request carries store:false and a hashed identifier', () => {
  let openai;
  let models;
  let app;

  beforeEach(() => {
    openai = { responses: { parse: vi.fn() } };
    models = {
      User: {},
      Subject: {},
      YearGroup: {},
      UserSubject: {},
      UserYearGroup: {},
      Prompt: { findOne: vi.fn() },
      SubjectContext: { findOne: vi.fn() },
      Category: { findAll: vi.fn(), destroy: vi.fn(), create: vi.fn() },
      Comment: { destroy: vi.fn(), create: vi.fn() }
    };
    app = createTestApp({ models, openai });
  });

  /**
   * Asserts on what was actually handed to the OpenAI client, not on how the
   * code was written. `store` is checked with `toBe(false)` rather than a
   * falsy check: an omitted `store` is `undefined`, which is falsy but means
   * "retain", the opposite of what is wanted.
   */
  const expectEveryCallIsPrivate = (minimumCalls) => {
    const calls = openai.responses.parse.mock.calls;

    // Floor. Without it a route that stopped calling OpenAI at all — or a
    // request that 400s before it gets there — would pass this test by
    // asserting nothing, which is the failure mode the file exists to prevent.
    expect(calls.length).toBeGreaterThanOrEqual(minimumCalls);

    calls.forEach(([params], index) => {
      expect(params.store, `call ${index} did not send store:false`).toBe(false);
      expect(
        params.safety_identifier,
        `call ${index} did not send a safety_identifier`
      ).toMatch(/^[0-9a-f]{64}$/);
      // The identifier must be a hash, never the id itself.
      expect(params.safety_identifier).not.toBe('1');
    });
  };

  it('on both /generate-report calls (relevance filter and report)', async () => {
    models.Prompt.findOne.mockResolvedValue({ promptPart: 'Base prompt.' });
    models.SubjectContext.findOne.mockResolvedValue({
      subjectDescription: 'Mathematics focusing on algebra.',
      wordLimit: 140
    });
    openai.responses.parse
      .mockResolvedValueOnce({ output_parsed: { flagged: [] } })
      .mockResolvedValueOnce({
        output_parsed: {
          paragraphs: [
            'PUPIL_NAME has studied algebra.',
            'PUPIL_NAME shows consistent effort.',
            'PUPIL_NAME demonstrates problem-solving.',
            'PUPIL_NAME should focus on revision.'
          ]
        }
      });

    const response = await request(app)
      .post('/generate-report')
      .send({
        pronouns: 'they/them',
        subjectId: 1,
        yearGroupId: 2,
        additionalComments: 'Extra note.',
        'Strengths / achievements': ['Works well in groups']
      });

    expect(response.status).toBe(200);
    expectEveryCallIsPrivate(2);
  });

  it('on all three /api/import-reports calls (relevance, extraction, merge)', async () => {
    // A subject description turns the relevance filter on, and an existing
    // category puts the default merge mode down the merge branch, so all three
    // reportImport call sites run.
    models.SubjectContext.findOne.mockResolvedValue({
      subjectDescription: 'Mathematics focusing on algebra.'
    });
    models.Category.findAll.mockResolvedValue([
      { id: 7, name: 'Effort / motivation / attendance', Comments: [{ id: 1, text: 'Works hard' }] }
    ]);
    models.Category.create.mockResolvedValue({ id: 10 });
    models.Comment.create.mockResolvedValue({});
    openai.responses.parse.mockResolvedValue({
      output_parsed: {
        categories: [{ name: 'Effort / motivation / attendance', comments: ['Works hard'] }],
        flagged: []
      }
    });

    const response = await request(app)
      .post('/api/import-reports')
      .send({
        subjectId: 1,
        yearGroupId: 2,
        reports: 'A steady term of work in mathematics, with good progress in algebra.'
      });

    expect(response.status).toBe(200);
    expectEveryCallIsPrivate(3);
  });
});

describe('no OpenAI call site escapes the test above', () => {
  it('finds the call sites at all', () => {
    const files = listSourceFiles(srcDir);
    // Floor: a readdir that returns nothing would make the census below pass
    // by comparing two empty things.
    expect(files.length).toBeGreaterThan(0);
  });

  it('matches the exact set of call sites this file drives', () => {
    const found = {};
    for (const file of listSourceFiles(srcDir)) {
      const matches = fs.readFileSync(file, 'utf8').match(/\.responses\.parse\(/g);
      if (matches) found[path.relative(srcDir, file)] = matches.length;
    }

    // Exact, not a floor. A new call site is the failure this guards, and the
    // stakes — report text retained at OpenAI — justify the maintenance cost of
    // updating this list deliberately.
    //
    // A mention of `.responses.parse(` inside a comment would also trip this.
    // That is the safe direction: a false alarm someone reads, rather than a
    // false pass. The runtime assertions above are what actually prove the
    // parameters, so this count can afford to be blunt.
    expect(found).toEqual(KNOWN_CALL_SITES);
  });
});
