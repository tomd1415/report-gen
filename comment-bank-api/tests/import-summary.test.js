// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { formatImportSummary } from '../public/import-summary.js';

describe('import summary formatting', () => {
  it('summarizes report import counts and merge mode', () => {
    expect(formatImportSummary({
      totalCategories: 3,
      totalComments: 12,
      filteredCount: 2,
      mode: 'merge',
      mergedExisting: true
    }, {
      targetLabel: 'your comment bank'
    })).toBe('Import completed for your comment bank: 3 categories, 12 comments, 2 out-of-scope comments filtered, merge mode, merged with existing comments.');
  });

  it('uses target staff username when present', () => {
    expect(formatImportSummary({
      targetUser: { username: 'teacher1' },
      totalCategories: 1,
      totalComments: 1,
      mode: 'replace',
      replacedExisting: true
    })).toBe('Import completed for teacher1: 1 category, 1 comment, replace mode, existing comments replaced.');
  });

  it('summarizes skipped CSV rows', () => {
    expect(formatImportSummary({
      totalCategories: 2,
      totalComments: 5,
      skippedRows: 1
    })).toBe('Import completed for comment bank: 2 categories, 5 comments, 1 CSV row skipped.');
  });
});
