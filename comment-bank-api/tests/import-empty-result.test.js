import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importReportsToCommentBank, ReportImportEmptyResultError } from '../src/services/reportImport.js';

// What this file is about
// -----------------------
// persistCategoryMap DELETES the target user's existing categories/comments for
// the subject+year group before writing the new map. Until 2026-08-06 nothing
// checked the new map was non-empty, so an import whose model call returned
// nothing usable destroyed the comment bank and reported success — an empty
// result rather than a crash, and merge is the DEFAULT mode.
//
// Owner decision, 2026-08-06: an empty final map is a FAILED import. Abort
// before deleting, return 502, leave the existing bank untouched.
//
// Each test below asserts the two things that matter together: the call fails,
// AND nothing was destroyed. Asserting only the failure would still pass if the
// delete happened first.

const makeModels = ({ existing = [] } = {}) => {
  const destroyed = { comments: [], categories: [] };
  const created = { categories: [], comments: [] };
  return {
    destroyed,
    created,
    models: {
      Category: {
        findAll: vi.fn().mockResolvedValue(existing),
        destroy: vi.fn(async (args) => { destroyed.categories.push(args.where); }),
        create: vi.fn(async (row) => { created.categories.push(row.name); return { id: created.categories.length }; })
      },
      Comment: {
        destroy: vi.fn(async (args) => { destroyed.comments.push(args.where); }),
        create: vi.fn(async (row) => { created.comments.push(row.text); return {}; })
      }
    }
  };
};

const existingBank = () => ([
  {
    id: 1,
    name: 'Effort / motivation / attendance',
    Comments: [{ text: 'Works hard every lesson' }, { text: 'Excellent attendance' }]
  },
  {
    id: 2,
    name: 'Strengths / achievements',
    Comments: [{ text: 'Confident with fractions' }]
  }
]);

const runImport = ({ models, openai, mode }) => importReportsToCommentBank({
  models,
  openai,
  sequelize: { transaction: async (callback) => callback({}) },
  openAIParams: {},
  ownerUserId: 7,
  actorUserId: 7,
  subjectId: 1,
  yearGroupId: 2,
  reports: 'Alex has worked hard this term.',
  mode,
  subjectDescription: 'Mathematics covering number, fractions and basic geometry.'
});

const extraction = (categories) => ({ output_parsed: { categories } });
const noFlags = { output_parsed: { flagged: [] } };

describe('an empty import result aborts instead of wiping the comment bank', () => {
  let openai;

  beforeEach(() => {
    openai = { responses: { parse: vi.fn() } };
  });

  it('aborts without deleting when the merge call returns no categories (merge is the default mode)', async () => {
    const { models, destroyed, created } = makeModels({ existing: existingBank() });

    openai.responses.parse
      .mockResolvedValueOnce(extraction([{ name: 'Effort / motivation / attendance', comments: ['Tries hard'] }]))
      .mockResolvedValueOnce(noFlags)                       // relevance on the new comments
      .mockResolvedValueOnce({ output_parsed: {} })         // MERGE returns nothing usable
      .mockResolvedValueOnce(noFlags);                      // relevance on the merged (empty) map

    await expect(runImport({ models, openai, mode: 'merge' }))
      .rejects.toThrow(ReportImportEmptyResultError);

    // Nothing was deleted, and nothing was written.
    expect(models.Category.destroy).not.toHaveBeenCalled();
    expect(models.Comment.destroy).not.toHaveBeenCalled();
    expect(destroyed.categories).toEqual([]);
    expect(created.categories).toEqual([]);
    expect(created.comments).toEqual([]);
  });

  it('aborts without deleting when the relevance filter flags every comment', async () => {
    const { models, created } = makeModels({ existing: existingBank() });

    openai.responses.parse
      .mockResolvedValueOnce(extraction([{ name: 'Effort / motivation / attendance', comments: ['Tries hard'] }]))
      .mockResolvedValueOnce({
        output_parsed: {
          flagged: [{ category: 'Effort / motivation / attendance', comment: 'Tries hard', reason: 'Out of scope' }]
        }
      })
      .mockResolvedValueOnce({ output_parsed: { categories: [] } })
      .mockResolvedValueOnce(noFlags);

    await expect(runImport({ models, openai, mode: 'merge' }))
      .rejects.toThrow(ReportImportEmptyResultError);

    expect(models.Category.destroy).not.toHaveBeenCalled();
    expect(created.comments).toEqual([]);
  });

  it('aborts without deleting when extraction returns no output_parsed at all', async () => {
    // The generation path has an explicit output_text fallback for exactly this
    // case, so the codebase already treats a missing output_parsed as something
    // that happens in practice. The import path has no such fallback.
    const { models, created } = makeModels({ existing: existingBank() });

    openai.responses.parse
      .mockResolvedValueOnce({})     // no output_parsed
      .mockResolvedValueOnce(noFlags)
      .mockResolvedValueOnce({ output_parsed: { categories: [] } })
      .mockResolvedValueOnce(noFlags);

    await expect(runImport({ models, openai, mode: 'replace' }))
      .rejects.toThrow(ReportImportEmptyResultError);

    expect(models.Category.destroy).not.toHaveBeenCalled();
    expect(created.categories).toEqual([]);
  });

  it('writes the new bank normally when the result is NOT empty (control)', async () => {
    // Proves the three tests above pass for the reason claimed, and not because
    // the harness never writes anything.
    const { models, created } = makeModels({ existing: [] });

    openai.responses.parse
      .mockResolvedValueOnce(extraction([
        { name: 'Effort / motivation / attendance', comments: ['Tries hard', 'Good attendance'] }
      ]))
      .mockResolvedValueOnce(noFlags);

    await runImport({ models, openai, mode: 'replace' });

    expect(created.categories).toEqual(['Effort / motivation / attendance']);
    expect(created.comments).toEqual(['Tries hard', 'Good attendance']);
  });
});
