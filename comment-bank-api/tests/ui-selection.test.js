// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { collectSelections, matchCategoryGroup } from '../public/report-selection.js';

const buildCategory = (name, { checkedIndices = [], count = 2 } = {}) => {
  const section = document.createElement('div');
  section.className = 'comment-category';
  section.dataset.categoryName = name;

  const options = document.createElement('div');
  options.className = 'comment-options';

  for (let i = 0; i < count; i += 1) {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = `${name} comment ${i + 1}`;
    if (checkedIndices.includes(i)) {
      checkbox.checked = true;
    }
    label.appendChild(checkbox);
    options.appendChild(label);
  }

  section.appendChild(options);
  return section;
};

describe('report selection helpers', () => {
  it('does not require General/Other categories', () => {
    const container = document.createElement('div');
    container.appendChild(buildCategory('Topics studied / knowledge / skills acquired', { checkedIndices: [0] }));
    container.appendChild(buildCategory('Effort / motivation / attendance', { checkedIndices: [0] }));
    container.appendChild(buildCategory('Strengths / achievements', { checkedIndices: [0] }));
    container.appendChild(buildCategory('Areas for development / targets toward end-of-year Teacher Target', { checkedIndices: [0] }));
    container.appendChild(buildCategory('General / Other', { checkedIndices: [] }));

    const { missingGroups } = collectSelections(container);
    expect(missingGroups).toEqual([]);
  });

  it('reports missing selections for core categories', () => {
    const container = document.createElement('div');
    container.appendChild(buildCategory('Topics studied / knowledge / skills acquired', { checkedIndices: [0] }));
    container.appendChild(buildCategory('Effort / motivation / attendance', { checkedIndices: [0] }));
    container.appendChild(buildCategory('Strengths / achievements', { checkedIndices: [] }));
    container.appendChild(buildCategory('Areas for development / targets toward end-of-year Teacher Target', { checkedIndices: [0] }));

    const { missingGroups } = collectSelections(container);
    expect(missingGroups).toContain('Strengths / Achievements');
  });

  it('collects selected comments by category name', () => {
    const container = document.createElement('div');
    container.appendChild(buildCategory('Strengths / achievements', { checkedIndices: [0, 1], count: 3 }));

    const { selections } = collectSelections(container);
    expect(Object.keys(selections)).toEqual(['Strengths / achievements']);
    expect(selections['Strengths / achievements']).toHaveLength(2);
  });

  it('treats General/Other as non-core', () => {
    expect(matchCategoryGroup('General / Other')).toBeNull();
  });

  it('maps development categories before topics/areas', () => {
    expect(matchCategoryGroup('Areas for development / targets toward end-of-year Teacher Target')).toBe('development');
  });
});
