// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

let clearStatus;
let filterCommentBank;
let getSelectedOptionText;
let renderContextSummary;
let setButtonLoading;
let setFieldInvalid;
let showStatus;

beforeAll(async () => {
  ({
    clearStatus,
    filterCommentBank,
    getSelectedOptionText,
    renderContextSummary,
    setButtonLoading,
    setFieldInvalid,
    showStatus
  } = await import('../public/app-ui.js'));
});

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('shared UI helpers', () => {
  it('shows and clears status messages', () => {
    document.body.innerHTML = '<div id="status" hidden></div>';

    expect(showStatus('#status', 'Saved', { tone: 'success', documentRef: document })).toBe(true);
    expect(document.querySelector('#status').hidden).toBe(false);
    expect(document.querySelector('#status').textContent).toBe('Saved');
    expect(document.querySelector('#status').classList.contains('status-panel--success')).toBe(true);

    expect(clearStatus('#status', { documentRef: document })).toBe(true);
    expect(document.querySelector('#status').hidden).toBe(true);
  });

  it('renders selected context chips', () => {
    document.body.innerHTML = '<div id="context"></div>';

    renderContextSummary('#context', [
      { label: 'Subject', value: 'Maths' },
      { label: 'Year group', value: '' }
    ], { documentRef: document });

    expect(document.querySelector('#context').hidden).toBe(false);
    expect(document.querySelector('#context').textContent).toBe('Subject: Maths');
  });

  it('reads selected option text only when a real value is selected', () => {
    document.body.innerHTML = `
      <select id="subject">
        <option value="">Select Subject</option>
        <option value="1" selected>Science</option>
      </select>
    `;

    expect(getSelectedOptionText('#subject', { documentRef: document })).toBe('Science');
  });

  it('sets and restores button loading state', () => {
    document.body.innerHTML = '<button id="save">Save</button>';

    setButtonLoading('#save', true, 'Saving...', { documentRef: document });
    expect(document.querySelector('#save').disabled).toBe(true);
    expect(document.querySelector('#save').textContent).toBe('Saving...');

    setButtonLoading('#save', false, undefined, { documentRef: document });
    expect(document.querySelector('#save').disabled).toBe(false);
    expect(document.querySelector('#save').textContent).toBe('Save');
  });

  it('marks and clears invalid fields consistently', () => {
    document.body.innerHTML = '<input id="name">';

    expect(setFieldInvalid('#name', true, { documentRef: document })).toBe(true);
    expect(document.querySelector('#name').classList.contains('field-invalid')).toBe(true);
    expect(document.querySelector('#name').getAttribute('aria-invalid')).toBe('true');

    expect(setFieldInvalid('#name', false, { documentRef: document })).toBe(true);
    expect(document.querySelector('#name').classList.contains('field-invalid')).toBe(false);
    expect(document.querySelector('#name').hasAttribute('aria-invalid')).toBe(false);
  });

  it('filters comment bank categories and comments', () => {
    document.body.innerHTML = `
      <div id="bank">
        <div class="category">
          <h3 class="category-title">Effort</h3>
          <div class="comment"><span class="comment-content">Works hard</span></div>
        </div>
        <div class="category">
          <h3 class="category-title">Knowledge</h3>
          <div class="comment"><span class="comment-content">Uses fractions</span></div>
        </div>
      </div>
    `;

    const result = filterCommentBank('#bank', 'fraction', { documentRef: document });

    expect(result).toEqual({ total: 2, visible: 1 });
    expect(document.querySelectorAll('.category')[0].hidden).toBe(true);
    expect(document.querySelectorAll('.category')[1].hidden).toBe(false);
  });
});
