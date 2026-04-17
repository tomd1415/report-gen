const formatCount = (value, singularLabel, pluralLabel = `${singularLabel}s`) => {
  const count = Number(value);
  if (!Number.isFinite(count)) {
    return null;
  }
  return `${count} ${count === 1 ? singularLabel : pluralLabel}`;
};

export const formatImportSummary = (payload = {}, { targetLabel = 'comment bank' } = {}) => {
  const parts = [
    formatCount(payload.totalCategories, 'category', 'categories'),
    formatCount(payload.totalComments, 'comment')
  ].filter(Boolean);

  if (Number(payload.filteredCount) > 0) {
    parts.push(formatCount(
      payload.filteredCount,
      'out-of-scope comment filtered',
      'out-of-scope comments filtered'
    ));
  }
  if (Number(payload.skippedRows) > 0) {
    parts.push(formatCount(payload.skippedRows, 'CSV row skipped', 'CSV rows skipped'));
  }
  if (payload.mode) {
    parts.push(`${payload.mode} mode`);
  }
  if (payload.replacedExisting) {
    parts.push('existing comments replaced');
  } else if (payload.mergedExisting) {
    parts.push('merged with existing comments');
  }

  const target = payload.targetUser?.username || targetLabel;
  if (parts.length === 0) {
    return payload.message || `Import completed for ${target}.`;
  }

  return `Import completed for ${target}: ${parts.join(', ')}.`;
};

if (typeof window !== 'undefined') {
  window.ReportGenImportSummary = { formatImportSummary };
}
