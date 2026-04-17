const resolveElement = (target, documentRef = globalThis.document) => {
  if (!target) {
    return null;
  }
  if (typeof target === 'string') {
    return documentRef?.querySelector(target) || documentRef?.getElementById(target) || null;
  }
  return target;
};

export const showStatus = (target, message, { tone = 'info', documentRef = globalThis.document } = {}) => {
  const element = resolveElement(target, documentRef);
  if (!element) {
    return false;
  }

  element.hidden = false;
  element.textContent = message || '';
  element.classList.add('status-panel');
  element.classList.remove('status-panel--info', 'status-panel--success', 'status-panel--warning', 'status-panel--error');
  element.classList.add(`status-panel--${tone}`);
  element.setAttribute('role', tone === 'error' || tone === 'warning' ? 'alert' : 'status');
  return true;
};

export const clearStatus = (target, { documentRef = globalThis.document } = {}) => {
  const element = resolveElement(target, documentRef);
  if (!element) {
    return false;
  }

  element.hidden = true;
  element.textContent = '';
  element.classList.remove('status-panel--info', 'status-panel--success', 'status-panel--warning', 'status-panel--error');
  return true;
};

export const getSelectedOptionText = (target, { documentRef = globalThis.document } = {}) => {
  const select = resolveElement(target, documentRef);
  if (!select || select.selectedIndex < 0) {
    return '';
  }

  const option = select.options[select.selectedIndex];
  return option?.value ? option.textContent.trim() : '';
};

export const setButtonLoading = (target, isLoading, loadingText = 'Working...', { documentRef = globalThis.document } = {}) => {
  const button = resolveElement(target, documentRef);
  if (!button) {
    return false;
  }

  if (isLoading) {
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent;
    }
    button.textContent = loadingText;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    return true;
  }

  button.textContent = button.dataset.originalText || button.textContent;
  delete button.dataset.originalText;
  button.disabled = false;
  button.removeAttribute('aria-busy');
  return true;
};

export const setFieldInvalid = (target, invalid, { documentRef = globalThis.document } = {}) => {
  const field = resolveElement(target, documentRef);
  if (!field) {
    return false;
  }

  field.classList.toggle('field-invalid', Boolean(invalid));
  if (invalid) {
    field.setAttribute('aria-invalid', 'true');
  } else {
    field.removeAttribute('aria-invalid');
  }
  return true;
};

export const renderContextSummary = (target, items, { documentRef = globalThis.document } = {}) => {
  const element = resolveElement(target, documentRef);
  if (!element) {
    return false;
  }

  const visibleItems = items
    .map((item) => ({
      label: item.label,
      value: String(item.value || '').trim()
    }))
    .filter((item) => item.value);

  element.innerHTML = '';
  element.classList.add('context-summary');

  if (visibleItems.length === 0) {
    element.hidden = true;
    return true;
  }

  visibleItems.forEach((item) => {
    const chip = documentRef.createElement('span');
    chip.className = 'context-chip';

    const label = documentRef.createElement('strong');
    label.textContent = `${item.label}: `;

    const value = documentRef.createElement('span');
    value.textContent = item.value;

    chip.append(label, value);
    element.appendChild(chip);
  });
  element.hidden = false;
  return true;
};

export const filterCommentBank = (container, query, { documentRef = globalThis.document } = {}) => {
  const root = resolveElement(container, documentRef);
  if (!root) {
    return { total: 0, visible: 0 };
  }

  const normalizedQuery = String(query || '').trim().toLowerCase();
  const categories = Array.from(root.querySelectorAll('.category'));
  let visible = 0;

  categories.forEach((category) => {
    const categoryText = category.querySelector('.category-title')?.textContent || '';
    const comments = Array.from(category.querySelectorAll('.comment'));
    const categoryMatches = !normalizedQuery || categoryText.toLowerCase().includes(normalizedQuery);
    let visibleComments = 0;

    comments.forEach((comment) => {
      const commentText = comment.querySelector('.comment-content')?.textContent || '';
      const commentMatches = !normalizedQuery || categoryMatches || commentText.toLowerCase().includes(normalizedQuery);
      comment.hidden = !commentMatches;
      if (commentMatches) {
        visibleComments += 1;
      }
    });

    const showCategory = categoryMatches || visibleComments > 0;
    category.hidden = !showCategory;
    if (normalizedQuery && showCategory) {
      const commentsContainer = category.querySelector('.comments-container');
      const expand = category.querySelector('.expand');
      if (commentsContainer) {
        commentsContainer.style.display = 'block';
      }
      if (expand) {
        expand.textContent = '-';
      }
      category.classList.remove('collapsed');
    }
    if (showCategory) {
      visible += 1;
    }
  });

  return { total: categories.length, visible };
};

if (typeof window !== 'undefined') {
  window.ReportGenUI = {
    showStatus,
    clearStatus,
    getSelectedOptionText,
    setButtonLoading,
    setFieldInvalid,
    renderContextSummary,
    filterCommentBank
  };
}
