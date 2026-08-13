// The Generate Report page's logic.
//
// This was a single 1,225-line inline <script> in index.html until 2026-08-13.
// Moving it out is the first step toward enabling Content Security Policy
// (docs/PROJECT_STATE.md §6.4): CSP cannot be turned on while pages carry inline
// script, and any page rendering report text is an XSS surface in the meantime —
// `cleanText` normalises whitespace and does no HTML escaping.
//
// The move is deliberately behaviour-preserving: the code is unchanged apart
// from the window bindings at the foot of the file, which keep the existing
// inline `onclick=` attributes working. Those attributes are a SECOND and
// separate CSP blocker; removing them is a further step, not this one.

// Guarded so the module can be imported outside a browser — `tests/public-module-coverage.test.js`
// loads every public/*.js under the node environment to prove it parses, and a
// bare `document` reference at top level would make that fail for the wrong
// reason. The listener is the only top-level side effect in this file.
if (typeof document !== 'undefined') {
document.addEventListener("DOMContentLoaded", async function () {
    if (!await isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    fetchUsername();
    loadSettings();
    setupReadyChecklistListeners();
});
}

async function isAuthenticated() {
    try {
        const response = await fetch('/api/authenticated');
        if (response.ok) {
            const data = await response.json();
            return data.authenticated;
        } else {
            return false;
        }
    } catch (error) {
        console.error('Error checking authentication:', error);
        return false;
    }
}

async function fetchUsername() {
    try {
        const response = await fetch('/api/user-info');
        if (response.ok) {
            const data = await response.json();
            document.getElementById('username').textContent = data.username;
        } else {
            console.error('Failed to fetch username');
        }
    } catch (error) {
        console.error('Error fetching username:', error);
    }
}

async function loadSettings() {
    try {
        const response = await fetch('/api/user-selected-settings');
        const settings = await response.json();
        loadSubjects(settings.userSubjects);
        loadYearGroups(settings.userYearGroups);
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

function resolveSubjectOption(subject) {
    const nested = subject?.Subject || subject?.subject;
    return {
        id: nested?.id ?? subject?.subjectId ?? subject?.id ?? '',
        name: nested?.name ?? subject?.name ?? ''
    };
}

function resolveYearGroupOption(yearGroup) {
    const nested = yearGroup?.YearGroup || yearGroup?.yearGroup;
    return {
        id: nested?.id ?? yearGroup?.yearGroupId ?? yearGroup?.id ?? '',
        name: nested?.name ?? yearGroup?.name ?? ''
    };
}

async function loadSubjects(userSubjects) {
    const response = await fetch('/api/subjects');
    const subjects = await response.json();
    const subjectSelect = document.getElementById('subject-select');
    subjectSelect.innerHTML = '<option value="">Select Subject</option>';

    const selectedSubjects = userSubjects.length ? userSubjects : subjects;
    selectedSubjects.forEach(subject => {
        const { id, name } = resolveSubjectOption(subject);
        if (!id || !name) {
            return;
        }
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        subjectSelect.appendChild(option);
    });
}

async function loadYearGroups(userYearGroups) {
    const response = await fetch('/api/year-groups');
    const yearGroups = await response.json();
    const yearGroupSelect = document.getElementById('year-group-select');
    yearGroupSelect.innerHTML = '<option value="">Select Year Group</option>';

    const selectedYearGroups = userYearGroups.length ? userYearGroups : yearGroups;
    selectedYearGroups.forEach(yearGroup => {
        const { id, name } = resolveYearGroupOption(yearGroup);
        if (!id || !name) {
            return;
        }
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        yearGroupSelect.appendChild(option);
    });
}

function updateGenerateContext() {
    window.ReportGenUI?.renderContextSummary('#generate-context', [
        { label: 'Subject', value: window.ReportGenUI?.getSelectedOptionText('#subject-select') },
        { label: 'Year group', value: window.ReportGenUI?.getSelectedOptionText('#year-group-select') }
    ]);
    updateReadyChecklist();
}

function showGenerateStatus(message, tone = 'info') {
    window.ReportGenUI?.showStatus('#generate-status', message, { tone });
}

function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
    const fetcher = window.ReportGenUI?.fetchWithTimeout || fetch;
    return fetcher(url, options, { timeoutMs });
}

function setupReadyChecklistListeners() {
    ['pupil-name', 'pupil-pronouns'].forEach((id) => {
        document.getElementById(id)?.addEventListener('input', updateReadyChecklist);
    });
}

function setFieldInvalid(id, invalid) {
    const field = document.getElementById(id);
    setControlInvalid(field, invalid);
}

function setControlInvalid(field, invalid) {
    if (field) {
        window.ReportGenUI?.setFieldInvalid(field, invalid);
    }
}

function setStrengthFocusValidation(incompleteRows = []) {
    const incompleteSet = new Set(incompleteRows);
    document.querySelectorAll('.strength-focus-row').forEach((row, index) => {
        const rowNumber = index + 1;
        const topicInput = row.querySelector('.strength-topic');
        const levelSelect = row.querySelector('.strength-level');
        const rowInvalid = incompleteSet.has(rowNumber);

        row.classList.toggle('field-invalid-row', rowInvalid);
        setControlInvalid(topicInput, rowInvalid && !topicInput?.value.trim());
        setControlInvalid(levelSelect, rowInvalid && !levelSelect?.value.trim());
    });
}

function focusFirstIncompleteStrengthRow() {
    const firstInvalid = document.querySelector('.strength-focus-row.field-invalid-row .field-invalid');
    if (firstInvalid) {
        firstInvalid.focus();
    }
}

function renderChecklistItem(label, complete, detail = '') {
    const item = document.createElement('li');
    item.className = complete ? 'ready-item ready-item--complete' : 'ready-item ready-item--missing';

    const marker = document.createElement('span');
    marker.className = 'ready-marker';
    marker.textContent = complete ? 'Ready' : 'Needed';

    const text = document.createElement('span');
    text.textContent = detail ? `${label}: ${detail}` : label;

    item.append(marker, text);
    return item;
}

function updateReadyChecklist() {
    const checklist = document.getElementById('ready-checklist');
    if (!checklist) {
        return;
    }

    const helper = window.ReportSelection;
    const container = document.getElementById('categories-container');
    const hasName = Boolean(document.getElementById('pupil-name')?.value.trim());
    const hasPronouns = Boolean(document.getElementById('pupil-pronouns')?.value.trim());
    const hasSubject = Boolean(document.getElementById('subject-select')?.value);
    const hasYearGroup = Boolean(document.getElementById('year-group-select')?.value);
    const categoriesLoaded = container?.querySelectorAll('.comment-category').length > 0;
    const selectionState = helper?.collectSelections && categoriesLoaded
        ? helper.collectSelections(container)
        : { missingGroups: [], selections: {} };
    const missingGroups = selectionState.missingGroups || [];
    const selectedCount = Object.values(selectionState.selections || {})
        .reduce((sum, comments) => sum + comments.length, 0);
    const strengthFocus = collectStrengthFocus();
    const incompleteStrength = strengthFocus.incomplete.length > 0;

    checklist.innerHTML = '';
    checklist.appendChild(renderChecklistItem('Subject and year group', hasSubject && hasYearGroup));
    checklist.appendChild(renderChecklistItem('Pupil name', hasName));
    checklist.appendChild(renderChecklistItem('Pronouns', hasPronouns));
    checklist.appendChild(renderChecklistItem(
        'Paragraph comments',
        categoriesLoaded && missingGroups.length === 0,
        categoriesLoaded
            ? `${selectedCount} selected${missingGroups.length ? `, missing ${missingGroups.join(', ')}` : ''}`
            : 'no comment bank loaded'
    ));
    checklist.appendChild(renderChecklistItem(
        'Strength focus',
        !incompleteStrength,
        strengthFocus.items.length ? `${strengthFocus.items.length} added` : 'optional'
    ));

    setFieldInvalid('pupil-name', !hasName && validationActive);
    setFieldInvalid('pupil-pronouns', !hasPronouns && validationActive);
}

async function loadCategoriesAndComments() {
    const subjectId = document.getElementById('subject-select').value;
    const yearGroupId = document.getElementById('year-group-select').value;
    if (subjectId && yearGroupId) {
        document.getElementById('name-pronoun-section').style.display = 'flex';
        showGenerateStatus('Loading comment bank and prompt settings.');
        console.log(`Fetching categories and comments for subjectId: ${subjectId}, yearGroupId: ${yearGroupId}`);

        const [categoriesResponse, promptPartResponse, subjectContextResponse] = await Promise.all([
            fetchWithTimeout(`/api/categories-comments?subjectId=${subjectId}&yearGroupId=${yearGroupId}`),
            fetchWithTimeout(`/api/prompts?subjectId=${subjectId}&yearGroupId=${yearGroupId}`),
            fetchWithTimeout(`/api/subject-context?subjectId=${subjectId}&yearGroupId=${yearGroupId}`)
        ]);

        const categories = await categoriesResponse.json();
        // `const` added 2026-08-13 during the move out of the inline <script>.
        // It had no declaration at all, which in a sloppy-mode inline script
        // silently created a global; a module is strict mode, so the same line
        // throws ReferenceError and aborts this function halfway — the page then
        // sits on "Loading comment bank and prompt settings." for ever. Nothing
        // else in the codebase read that global, so scoping it here is the whole
        // fix. Found by the e2e journeys, which is what they are for.
        const promptPart = await promptPartResponse.text();
        const subjectContext = subjectContextResponse.ok ? await subjectContextResponse.json() : {};

        console.log('Fetched categories:', categories);
        console.log('Fetched prompt part:', promptPart);
        console.log('Fetched subject context:', subjectContext);

        document.getElementById('subject-description').value = subjectContext.subjectDescription || '';
        document.getElementById('word-limit').value = subjectContext.wordLimit || '';
        document.getElementById('subject-description-wrapper').style.display = 'block';
        document.getElementById('word-limit-wrapper').style.display = 'block';
        document.getElementById('report-builder').style.display = 'grid';
        document.getElementById('comment-filter').value = '';
        document.getElementById('selected-only').checked = false;
        clearRelevanceWarning();

        const categoriesContainer = document.getElementById('categories-container');
        categoriesContainer.innerHTML = ''; // Clear previous options

        const selectionHelper = window.ReportSelection;
        if (!selectionHelper) {
            showGenerateStatus('Unable to load selection tools. Please refresh the page.', 'error');
            return;
        }

        if (categories.length === 0) {
            document.getElementById('step-tabs').innerHTML = '';
            document.getElementById('category-controls').style.display = 'none';
            document.getElementById('strength-focus-wrapper').style.display = 'none';
            document.getElementById('additional-comments-wrapper').style.display = 'none';
            document.getElementById('generate-report').style.display = 'none';
            categoriesContainer.innerHTML = `
                <div class="empty-state">
                    <h3>No comments found for this selection</h3>
                    <p>This subject and year group has no saved comment bank yet.</p>
                </div>
            `;
            updateSelectionSummary();
            updateReadyChecklist();
            showGenerateStatus('No comment bank exists yet for this subject and year group.', 'warning');
            return;
        }

        const stepPresence = {
            topics: false,
            effort: false,
            strengths: false,
            development: false,
            other: false
        };

        categories.forEach((category) => {
            const categoryDiv = document.createElement('div');
            categoryDiv.classList.add('form-section', 'comment-category');
            categoryDiv.dataset.categoryId = category.id;
            categoryDiv.dataset.categoryName = category.name;
            const groupKey = selectionHelper.matchCategoryGroup(category.name) || 'other';
            categoryDiv.dataset.group = groupKey;
            stepPresence[groupKey] = true;

            const header = document.createElement('div');
            header.classList.add('comment-category-header');

            const headerLeft = document.createElement('div');
            headerLeft.classList.add('comment-category-label');

            const title = document.createElement('h3');
            title.classList.add('comment-category-title');
            title.textContent = category.name;
            headerLeft.appendChild(title);

            const countBadge = document.createElement('span');
            countBadge.classList.add('category-selected-count');
            countBadge.textContent = '0 selected';
            headerLeft.appendChild(countBadge);

            header.appendChild(headerLeft);

            const toggleButton = document.createElement('button');
            toggleButton.type = 'button';
            toggleButton.classList.add('button', 'inline-button', 'toggle-button');
            toggleButton.textContent = 'Collapse';
            toggleButton.setAttribute('aria-expanded', 'true');
            toggleButton.addEventListener('click', () => {
                toggleCategory(categoryDiv, toggleButton);
            });
            header.appendChild(toggleButton);

            categoryDiv.appendChild(header);

            const optionsContainer = document.createElement('div');
            optionsContainer.classList.add('comment-options');

            category.Comments.forEach((comment) => {
                appendCommentCheckbox(optionsContainer, comment.text, category.id);
            });

            categoryDiv.appendChild(optionsContainer);

            const addButton = document.createElement('button');
            addButton.type = 'button';
            addButton.classList.add('button', 'inline-button', 'addcomment');
            addButton.textContent = 'Add comment';
            addButton.addEventListener('click', () => {
                openModal(category.id);
            });
            categoryDiv.appendChild(addButton);
            categoriesContainer.appendChild(categoryDiv);
        });
        const firstStep = setupStepTabs(stepPresence);
        setActiveStep(firstStep || 'topics');
        updateSelectionSummary();
        setupFilters();
        setupAdditionalCommentPreview();
        setupStrengthFocus();
        setValidationState(false);
        setAllCategoriesCollapsed(false);
        document.getElementById('category-controls').style.display = categories.length ? 'flex' : 'none';
        document.getElementById('additional-comments-wrapper').style.display = 'block';
        document.getElementById('generate-report').style.display = 'block';
        updateReadyChecklist();
        showGenerateStatus(`Loaded ${categories.length} categories for this report.`, categories.length ? 'success' : 'warning');
    }
}

let currentCategoryContainer = null;
let activeStep = 'topics';
let filterInitialized = false;
let additionalListenerBound = false;
let validationActive = false;
let categoriesCollapsed = false;

const stepDefinitions = [
    { key: 'topics', label: 'Paragraph 1', subtitle: 'Topics and skills' },
    { key: 'effort', label: 'Paragraph 2', subtitle: 'Effort and attendance' },
    { key: 'strengths', label: 'Paragraph 3', subtitle: 'Strengths and achievements' },
    { key: 'development', label: 'Paragraph 4', subtitle: 'Development and targets' },
    { key: 'other', label: 'Other', subtitle: 'Optional extras', optional: true }
];
const strengthLevels = [
    { value: '', label: 'Select level' },
    { value: 'exceptional', label: 'Exceptional' },
    { value: 'strong', label: 'Strong' },
    { value: 'secure', label: 'Secure' },
    { value: 'developing', label: 'Developing' },
    { value: 'emerging', label: 'Emerging' }
];
const STRENGTH_FOCUS_MAX = 5;

function appendCommentCheckbox(container, text, categoryId, checked = false) {
    const label = document.createElement('label');
    label.classList.add('checkbox-option');
    label.dataset.comment = text;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = text;
    checkbox.name = `category-${categoryId}`;
    checkbox.checked = checked;
    checkbox.addEventListener('change', () => {
        updateSelectionSummary();
        applyFilters();
        clearRelevanceWarning();
    });

    const span = document.createElement('span');
    span.textContent = text;

    label.appendChild(checkbox);
    label.appendChild(span);
    container.appendChild(label);
}

function toggleCategory(categoryDiv, toggleButton) {
    const isCollapsed = categoryDiv.classList.toggle('is-collapsed');
    toggleButton.textContent = isCollapsed ? 'Expand' : 'Collapse';
    toggleButton.setAttribute('aria-expanded', String(!isCollapsed));
}

function setAllCategoriesCollapsed(collapsed) {
    categoriesCollapsed = collapsed;
    const categorySections = document.querySelectorAll('.comment-category');
    categorySections.forEach(section => {
        section.classList.toggle('is-collapsed', collapsed);
        const toggle = section.querySelector('.toggle-button');
        if (toggle) {
            toggle.textContent = collapsed ? 'Expand' : 'Collapse';
            toggle.setAttribute('aria-expanded', String(!collapsed));
        }
    });
    const toggleButton = document.getElementById('toggle-categories');
    if (toggleButton) {
        toggleButton.textContent = collapsed ? 'Expand all' : 'Collapse all';
    }
}

function expandAllCategories() {
    setAllCategoriesCollapsed(false);
}

function collapseAllCategories() {
    setAllCategoriesCollapsed(true);
}

function toggleAllCategories() {
    setAllCategoriesCollapsed(!categoriesCollapsed);
}

function setupStepTabs(stepPresence) {
    const tabsContainer = document.getElementById('step-tabs');
    tabsContainer.innerHTML = '';
    let firstKey = null;
    stepDefinitions.forEach(step => {
        if (step.optional && !stepPresence[step.key]) {
            return;
        }
        if (!firstKey) {
            firstKey = step.key;
        }
        const button = document.createElement('button');
        button.type = 'button';
        button.classList.add('step-tab');
        button.dataset.step = step.key;
        button.innerHTML = `
            <span class="step-title">${step.label}</span>
            <span class="step-subtitle">${step.subtitle}</span>
            <span class="step-status"></span>
            <span class="step-count">0</span>
        `;
        button.addEventListener('click', () => setActiveStep(step.key));
        tabsContainer.appendChild(button);
    });
    return firstKey;
}

function setActiveStep(stepKey) {
    activeStep = stepKey;
    document.querySelectorAll('.step-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.step === stepKey);
    });
    document.querySelectorAll('.comment-category').forEach(section => {
        const matches = section.dataset.group === stepKey;
        section.classList.toggle('is-hidden', !matches);
    });
    const strengthFocus = document.getElementById('strength-focus-wrapper');
    if (strengthFocus) {
        strengthFocus.style.display = stepKey === 'strengths' ? 'block' : 'none';
    }
    applyFilters();
}

function focusFirstMissingParagraph(missingGroups) {
    const categoryGroups = window.ReportSelection?.categoryGroups || [];
    const firstMissing = categoryGroups.find(group => missingGroups.includes(group.label));
    if (!firstMissing) {
        return false;
    }

    setActiveStep(firstMissing.key);
    const tab = document.querySelector(`.step-tab[data-step="${firstMissing.key}"]`);
    if (tab) {
        tab.focus();
        tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    return true;
}

function setupFilters() {
    if (filterInitialized) {
        return;
    }
    const filterInput = document.getElementById('comment-filter');
    const selectedOnly = document.getElementById('selected-only');
    filterInput.addEventListener('input', applyFilters);
    selectedOnly.addEventListener('change', applyFilters);
    filterInitialized = true;
}

function setupAdditionalCommentPreview() {
    if (additionalListenerBound) {
        return;
    }
    const additional = document.getElementById('additional-comments');
    if (additional) {
        additional.addEventListener('input', updateSelectionSummary);
        additionalListenerBound = true;
    }
}

function setValidationState(active) {
    validationActive = active;
    const builder = document.getElementById('report-builder');
    if (builder) {
        builder.classList.toggle('validation-active', active);
    }
}

function setupStrengthFocus() {
    const list = document.getElementById('strength-focus-list');
    if (!list) {
        return;
    }
    list.innerHTML = '';
    addStrengthFocusRow(true);
    updateReadyChecklist();
}

function createStrengthFocusRow({ topic = '', level = '' } = {}) {
    const row = document.createElement('div');
    row.classList.add('strength-focus-row');

    const topicInput = document.createElement('input');
    topicInput.type = 'text';
    topicInput.maxLength = 80;
    topicInput.placeholder = 'Topic or aspect (e.g. fractions, map skills)';
    topicInput.classList.add('strength-topic');
    topicInput.value = topic;
    topicInput.addEventListener('input', () => {
        if (validationActive || document.querySelector('.strength-focus-row.field-invalid-row')) {
            setStrengthFocusValidation(collectStrengthFocus().incomplete);
        }
        updateSelectionSummary();
        clearRelevanceWarning();
    });

    const levelSelect = document.createElement('select');
    levelSelect.classList.add('strength-level');
    strengthLevels.forEach((levelOption) => {
        const option = document.createElement('option');
        option.value = levelOption.value;
        option.textContent = levelOption.label;
        if (levelOption.value === level) {
            option.selected = true;
        }
        levelSelect.appendChild(option);
    });
    levelSelect.addEventListener('change', () => {
        if (validationActive || document.querySelector('.strength-focus-row.field-invalid-row')) {
            setStrengthFocusValidation(collectStrengthFocus().incomplete);
        }
        updateSelectionSummary();
        clearRelevanceWarning();
    });

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.classList.add('button', 'inline-button', 'delete');
    removeButton.textContent = 'Remove';
    removeButton.addEventListener('click', () => {
        removeStrengthFocusRow(removeButton);
    });

    row.appendChild(topicInput);
    row.appendChild(levelSelect);
    row.appendChild(removeButton);
    return row;
}

function addStrengthFocusRow(skipLimitCheck = false) {
    const list = document.getElementById('strength-focus-list');
    if (!list) {
        return;
    }
    if (!skipLimitCheck && list.children.length >= STRENGTH_FOCUS_MAX) {
        showGenerateStatus(`You can add up to ${STRENGTH_FOCUS_MAX} strength focus items.`, 'warning');
        return;
    }
    list.appendChild(createStrengthFocusRow());
    updateSelectionSummary();
    updateReadyChecklist();
}

function removeStrengthFocusRow(button) {
    const row = button.closest('.strength-focus-row');
    if (row) {
        row.remove();
        updateSelectionSummary();
        updateReadyChecklist();
    }
}

function collectStrengthFocus() {
    const rows = document.querySelectorAll('.strength-focus-row');
    const items = [];
    const incomplete = [];

    rows.forEach((row, index) => {
        const topic = row.querySelector('.strength-topic')?.value.trim() || '';
        const level = row.querySelector('.strength-level')?.value.trim() || '';

        if (!topic && !level) {
            return;
        }
        if (!topic || !level) {
            incomplete.push(index + 1);
            return;
        }
        items.push({ topic, level });
    });

    return { items, incomplete };
}

function applyFilters() {
    const filterInput = document.getElementById('comment-filter');
    const selectedOnly = document.getElementById('selected-only');
    if (!filterInput || !selectedOnly) {
        return;
    }
    const query = filterInput.value.trim().toLowerCase();
    const onlySelected = selectedOnly.checked;

    document.querySelectorAll('.comment-category').forEach(section => {
        if (section.classList.contains('is-hidden')) {
            return;
        }
        let visibleCount = 0;
        section.querySelectorAll('.checkbox-option').forEach(option => {
            const checkbox = option.querySelector('input[type="checkbox"]');
            const text = option.textContent.toLowerCase();
            const matchesQuery = !query || text.includes(query);
            const matchesSelected = !onlySelected || checkbox.checked;
            const show = matchesQuery && matchesSelected;
            option.style.display = show ? '' : 'none';
            if (show) {
                visibleCount += 1;
            }
        });
        section.classList.toggle('filtered-empty', visibleCount === 0);
    });
}

function updateSelectionSummary() {
    const summaryContainer = document.getElementById('selection-summary');
    if (!summaryContainer) {
        return;
    }
    const { items: strengthFocusItems } = collectStrengthFocus();
    const counts = {
        topics: 0,
        effort: 0,
        strengths: 0,
        development: 0,
        other: 0
    };
    const groupedSelections = {
        topics: [],
        effort: [],
        strengths: [],
        development: [],
        other: []
    };

    document.querySelectorAll('.comment-category').forEach(section => {
        const groupKey = section.dataset.group;
        const categoryName = section.dataset.categoryName;
        const checked = Array.from(section.querySelectorAll('input[type="checkbox"]:checked'));
        const selectedCount = checked.length;
        const countBadge = section.querySelector('.category-selected-count');
        if (countBadge) {
            countBadge.textContent = selectedCount ? `${selectedCount} selected` : '0 selected';
            countBadge.classList.toggle('has-selection', selectedCount > 0);
        }
        counts[groupKey] += checked.length;
        checked.forEach(input => {
            groupedSelections[groupKey].push({ category: categoryName, comment: input.value });
        });
    });
    if (strengthFocusItems.length > 0) {
        counts.strengths += strengthFocusItems.length;
    }

    summaryContainer.innerHTML = '';
    stepDefinitions.forEach(step => {
        if (step.optional && groupedSelections[step.key].length === 0) {
            return;
        }
        const section = document.createElement('div');
        section.classList.add('summary-section');
        const heading = document.createElement('h4');
        heading.textContent = step.label;
        section.appendChild(heading);

        if (groupedSelections[step.key].length === 0) {
            const empty = document.createElement('p');
            empty.classList.add('summary-empty');
            empty.textContent = 'No comments selected yet.';
            section.appendChild(empty);
        } else {
            const list = document.createElement('ul');
            groupedSelections[step.key].forEach(item => {
                const li = document.createElement('li');
                li.textContent = `${item.comment}`;
                list.appendChild(li);
            });
            section.appendChild(list);
        }
        if (step.key === 'strengths' && strengthFocusItems.length > 0) {
            const focusHeading = document.createElement('p');
            focusHeading.classList.add('summary-focus-title');
            focusHeading.textContent = 'Subject strengths focus';
            section.appendChild(focusHeading);
            const focusList = document.createElement('ul');
            focusList.classList.add('summary-tag-list');
            strengthFocusItems.forEach(item => {
                const li = document.createElement('li');
                li.classList.add('summary-tag');
                li.textContent = `${item.topic} (${item.level})`;
                focusList.appendChild(li);
            });
            section.appendChild(focusList);
        }
        summaryContainer.appendChild(section);
    });

    const additional = document.getElementById('additional-comments')?.value.trim();
    if (additional) {
        const extraSection = document.createElement('div');
        extraSection.classList.add('summary-section');
        const heading = document.createElement('h4');
        heading.textContent = 'Additional comments';
        const text = document.createElement('p');
        text.textContent = additional;
        extraSection.appendChild(heading);
        extraSection.appendChild(text);
        summaryContainer.appendChild(extraSection);
    }

    const missingRequiredKeys = stepDefinitions
        .filter(step => !step.optional && (counts[step.key] || 0) === 0)
        .map(step => step.key);

    if (validationActive && missingRequiredKeys.length === 0) {
        setValidationState(false);
    }

    document.querySelectorAll('.step-tab').forEach(tab => {
        const key = tab.dataset.step;
        const count = counts[key] || 0;
        const countNode = tab.querySelector('.step-count');
        const statusNode = tab.querySelector('.step-status');
        const stepMeta = stepDefinitions.find(step => step.key === key);
        if (countNode) {
            countNode.textContent = count;
        }
        if (statusNode && stepMeta) {
            if (!stepMeta.optional) {
                statusNode.textContent = count > 0 ? 'Done' : 'Needs selection';
            } else {
                statusNode.textContent = count > 0 ? 'Selected' : 'Optional';
            }
        }
        tab.classList.toggle('has-selection', count > 0);
        tab.classList.toggle('needs-selection', missingRequiredKeys.includes(key));
    });
    updateReadyChecklist();
}

function showRelevanceWarning(flaggedItems) {
    const warning = document.getElementById('relevance-warning');
    const list = document.getElementById('relevance-list');
    if (!warning || !list) {
        return;
    }
    list.innerHTML = '';
    flaggedItems.forEach(item => {
        const row = document.createElement('div');
        row.classList.add('warning-item');
        row.innerHTML = `
            <strong>${item.category}</strong>
            <span>${item.comment}</span>
            <em>${item.reason}</em>
        `;
        list.appendChild(row);
    });
    highlightFlagged(flaggedItems);
    warning.classList.remove('hidden');
}

function clearRelevanceWarning() {
    const warning = document.getElementById('relevance-warning');
    if (warning) {
        warning.classList.add('hidden');
    }
    document.querySelectorAll('.checkbox-option.flagged').forEach(option => {
        option.classList.remove('flagged');
    });
    document.querySelectorAll('.strength-focus-row.flagged').forEach(row => {
        row.classList.remove('flagged');
    });
}

function dismissRelevanceWarning() {
    clearRelevanceWarning();
}

function highlightFlagged(flaggedItems) {
    const normalizeKey = (value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const buildKey = (category, comment) => `${normalizeKey(category)}||${normalizeKey(comment)}`;
    const flaggedSet = new Set(flaggedItems.map(item => buildKey(item.category, item.comment)));
    document.querySelectorAll('.comment-category').forEach(section => {
        const categoryName = section.dataset.categoryName;
        section.querySelectorAll('.checkbox-option').forEach(option => {
            const key = buildKey(categoryName, option.dataset.comment);
            option.classList.toggle('flagged', flaggedSet.has(key));
        });
    });
    document.querySelectorAll('.strength-focus-row').forEach(row => {
        const topic = row.querySelector('.strength-topic')?.value.trim() || '';
        const level = row.querySelector('.strength-level')?.value.trim() || '';
        const comment = topic && level ? `${topic} (${level})` : '';
        const key = buildKey('Strength focus', comment);
        row.classList.toggle('flagged', comment && flaggedSet.has(key));
    });
}

function openModal(categoryId) {
    document.getElementById('add-comment-modal').classList.remove('hidden');
    document.getElementById('add-comment-modal').dataset.categoryId = categoryId;
    currentCategoryContainer = document.querySelector(
        `.comment-category[data-category-id="${categoryId}"] .comment-options`
    );
}

function closeModal() {
    document.getElementById('add-comment-modal').classList.add('hidden');
    document.getElementById('new-comment-text').value = '';
}

async function saveNewComment() {
    const categoryId = document.getElementById('add-comment-modal').dataset.categoryId;
    const commentText = document.getElementById('new-comment-text').value.trim();

    if (commentText) {
        try {
            const response = await fetchWithTimeout('/api/comments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text: commentText, categoryId })
            });
            if (!response.ok) {
                console.error('Error adding comment:', response.statusText);
                showGenerateStatus('Error adding comment.', 'error');
                return;
            }
            const newComment = await response.json();
            if (currentCategoryContainer) {
                appendCommentCheckbox(currentCategoryContainer, newComment.text, categoryId, true);
            }
            updateSelectionSummary();
            applyFilters();
            closeModal();
            showGenerateStatus('Comment added to this report.', 'success');
        } catch (error) {
            console.error('Error adding comment:', error);
            showGenerateStatus('Error adding comment.', 'error');
        }
    } else {
        showGenerateStatus('Please enter a comment before saving it.', 'warning');
    }
}

function getCompleteReportParagraphs(data) {
    const normalizeParagraphs = (items) => items
        .map((item) => String(item || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
    const paragraphs = Array.isArray(data?.paragraphs) ? normalizeParagraphs(data.paragraphs) : [];
    if (paragraphs.length === 4) {
        return paragraphs;
    }

    const reportText = String(data?.report || '').trim();
    if (!reportText) {
        return [];
    }

    const splitParagraphs = normalizeParagraphs(reportText.split(/\n\s*\n/));
    return splitParagraphs.length === 4 ? splitParagraphs : [];
}

function showResultMessage(resultContainer, message, { showRetry = false, retryOptions = {} } = {}) {
    resultContainer.innerHTML = '';
    const paragraph = document.createElement('p');
    paragraph.textContent = message;
    resultContainer.appendChild(paragraph);

    if (showRetry) {
        const retryButton = document.createElement('button');
        retryButton.type = 'button';
        retryButton.classList.add('button', 'inline-button');
        retryButton.textContent = 'Try Again';
        retryButton.addEventListener('click', () => {
            generateReport(retryOptions);
        });
        resultContainer.appendChild(retryButton);
    }
}

function clearGenerateFormAfterSuccessfulReport() {
    confirmedFreeTextSignature = null;
    document.getElementById('pupil-name').value = '';
    document.getElementById('pupil-pronouns').value = '';
    document.getElementById('additional-comments').value = '';
    setupStrengthFocus();
    setFieldInvalid('pupil-name', false);
    setFieldInvalid('pupil-pronouns', false);

    const checkboxes = document.querySelectorAll('#categories-container input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    updateSelectionSummary();
    applyFilters();
    updateReadyChecklist();
}

// Signature of the free text the teacher last confirmed, so an unchanged
// retry does not re-prompt but an edit does. Not persisted anywhere —
// decision 2(A): the confirmation is interaction-only, nothing is stored.
let confirmedFreeTextSignature = null;

// Renders text into a container as DOM nodes (never innerHTML), underlining
// any word flagged as a possible pupil name. Warn-only: the text shown is
// exactly what gets sent, highlights change nothing.
function renderPreviewText(container, text, suspects) {
    const flagged = new Set(suspects.map(word => word.toLowerCase()));
    container.textContent = '';
    text.split(/(\s+)/).forEach(token => {
        const bare = token.replace(/^[^\p{L}']+|[^\p{L}']+$/gu, '');
        if (bare && flagged.has(bare.toLowerCase())) {
            const lead = token.slice(0, token.indexOf(bare));
            const trail = token.slice(token.indexOf(bare) + bare.length);
            if (lead) container.appendChild(document.createTextNode(lead));
            const mark = document.createElement('span');
            mark.className = 'suspect-name';
            mark.textContent = bare;
            container.appendChild(mark);
            if (trail) container.appendChild(document.createTextNode(trail));
        } else {
            container.appendChild(document.createTextNode(token));
        }
    });
}

// Decision 1(A): only shown when there is free-text to review. With both
// free-text fields empty there is nothing un-vetted to look at, and a
// dialog that is usually empty just trains people to click through it.
// Decision 2(A): the confirmation is the accountability trail — informed
// sign-off on the exact payload. Nothing is stored.
function confirmFreeTextSend(fields, pupilName) {
    const modal = document.getElementById('send-preview-modal');
    const body = document.getElementById('send-preview-body');
    const suspectBox = document.getElementById('send-preview-suspects');
    const confirmBtn = document.getElementById('send-preview-confirm');
    const cancelBtn = document.getElementById('send-preview-cancel');

    body.textContent = '';
    const allSuspects = new Set();

    fields.forEach(field => {
        const suspects = window.ReportSelection.findSuspectNames(field.text, { ignore: [pupilName] });
        suspects.forEach(word => allSuspects.add(word));

        const wrapper = document.createElement('div');
        wrapper.className = 'send-preview-field';
        const heading = document.createElement('h4');
        heading.textContent = field.label;
        const textBox = document.createElement('div');
        textBox.className = 'send-preview-text';
        renderPreviewText(textBox, field.text, suspects);
        wrapper.appendChild(heading);
        wrapper.appendChild(textBox);
        body.appendChild(wrapper);
    });

    if (allSuspects.size > 0) {
        suspectBox.textContent = `Please check these words before sending — if any is another pupil's name, go back and remove it: ${[...allSuspects].join(', ')}. (Subject topics and place names are fine.)`;
        suspectBox.classList.remove('hidden');
    } else {
        suspectBox.textContent = '';
        suspectBox.classList.add('hidden');
    }

    modal.classList.remove('hidden');
    confirmBtn.focus();

    return new Promise(resolve => {
        const finish = (result) => {
            modal.classList.add('hidden');
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            document.removeEventListener('keydown', onKeydown);
            resolve(result);
        };
        const onConfirm = () => finish(true);
        const onCancel = () => finish(false);
        const onKeydown = (event) => {
            if (event.key === 'Escape') {
                finish(false);
            }
        };
        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
        document.addEventListener('keydown', onKeydown);
    });
}

async function generateReport(options = {}) {
    const pupilName = document.getElementById('pupil-name').value.trim();
    const pupilPronouns = document.getElementById('pupil-pronouns').value.trim();
    const additionalComments = document.getElementById('additional-comments').value;
    const wordLimit = document.getElementById('word-limit').value;

    const subjectId = document.getElementById('subject-select').value;
    const yearGroupId = document.getElementById('year-group-select').value;

    clearRelevanceWarning();
    setFieldInvalid('pupil-name', false);
    setFieldInvalid('pupil-pronouns', false);
    setStrengthFocusValidation([]);

    if (!pupilName) {
        setValidationState(true);
        setFieldInvalid('pupil-name', true);
        updateReadyChecklist();
        showGenerateStatus('Please enter the pupil name before generating a report.', 'warning');
        document.getElementById('pupil-name').focus();
        return;
    }

    if (!pupilPronouns) {
        setValidationState(true);
        setFieldInvalid('pupil-pronouns', true);
        updateReadyChecklist();
        showGenerateStatus('Please enter the pupil pronouns before generating a report.', 'warning');
        document.getElementById('pupil-pronouns').focus();
        return;
    }

    const selectionHelper = window.ReportSelection;
    // Also guard the redaction helpers: a stale cached copy of
    // report-selection.js without them would otherwise send the name.
    // Fail closed rather than fall back to transmitting it.
    if (!selectionHelper
        || typeof selectionHelper.collectSelections !== 'function'
        || typeof selectionHelper.redactPupilName !== 'function'
        || typeof selectionHelper.restorePupilName !== 'function'
        || typeof selectionHelper.findSuspectNames !== 'function') {
        showGenerateStatus('Unable to prepare the report safely. Please reload the page (Ctrl+F5) and try again.', 'error');
        return;
    }

    const { selections, missingGroups } = selectionHelper.collectSelections(
        document.getElementById('categories-container')
    );
    if (missingGroups.length > 0) {
        setValidationState(true);
        updateReadyChecklist();
        focusFirstMissingParagraph(missingGroups);
        showGenerateStatus(`Please select at least one comment for: ${missingGroups.join(', ')}.`, 'warning');
        return;
    }
    setValidationState(false);
    updateReadyChecklist();

    const strengthFocus = collectStrengthFocus();
    if (strengthFocus.incomplete.length > 0) {
        setValidationState(true);
        setStrengthFocusValidation(strengthFocus.incomplete);
        updateReadyChecklist();
        showGenerateStatus('Please complete or remove all strength focus rows before generating the report.', 'warning');
        focusFirstIncompleteStrengthRow();
        return;
    }

    // Redact this pupil's name in the browser so it is never transmitted.
    // The server is not told the name, so it cannot do this for us — which
    // is why report-selection.js's helpers are unit-tested directly.
    const redactedAdditionalComments = selectionHelper.redactPupilName(additionalComments, pupilName);
    const redactedStrengthFocus = strengthFocus.items.map(item => ({
        topic: selectionHelper.redactPupilName(item.topic, pupilName),
        level: selectionHelper.redactPupilName(item.level, pupilName)
    }));

    const previewFields = [];
    if (redactedAdditionalComments) {
        previewFields.push({ label: 'Additional comments', text: redactedAdditionalComments });
    }
    redactedStrengthFocus.forEach((item, index) => {
        previewFields.push({
            label: `Strength focus ${index + 1}`,
            text: `${item.topic} (${item.level})`
        });
    });

    // Gate on the *content* rather than a flag, so a retry or "generate
    // anyway" with unchanged text does not re-prompt, but any edit to the
    // free text does.
    const previewSignature = JSON.stringify(previewFields);
    if (previewFields.length > 0 && confirmedFreeTextSignature !== previewSignature) {
        const confirmed = await confirmFreeTextSend(previewFields, pupilName);
        if (!confirmed) {
            showGenerateStatus('Sending cancelled. Edit the free-text fields, then generate again.', 'warning');
            document.getElementById('additional-comments').focus();
            return;
        }
        confirmedFreeTextSignature = previewSignature;
    }

    const pupil = {
        pronouns: pupilPronouns,
        subjectId: subjectId,
        yearGroupId: yearGroupId,
        additionalComments: redactedAdditionalComments,
        wordLimit: wordLimit,
        overrideIrrelevant: options.override === true,
        strengthFocus: redactedStrengthFocus
    };

    Object.entries(selections).forEach(([categoryName, selectedComments]) => {
        pupil[categoryName] = selectedComments;
    });
    document.getElementById('result-container').style.display = 'block';
    let resultContainer = document.getElementById('result-container');
    resultContainer.innerHTML = '<h1>Generating Report</h1>'; // Clear previous results
    const generateButton = document.getElementById('generate-report');
    window.ReportGenUI?.setButtonLoading(generateButton, true, 'Generating...');
    showGenerateStatus('Generating report. This may take a moment.');

    // Generate report for the pupil
    try {
        const response = await fetchWithTimeout('/generate-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(pupil)
        }, 120000);
        if (response.status === 422) {
            const errorPayload = await response.json().catch(() => ({}));
            showRelevanceWarning(errorPayload.flagged || []);
            resultContainer.innerHTML = '<p>Please review the highlighted comments before continuing.</p>';
            showGenerateStatus('Review the highlighted comments, then either adjust selections or generate anyway.', 'warning');
            return;
        }
        if (!response.ok) {
            const errorPayload = await response.json().catch(() => ({}));
            throw new Error(errorPayload.message || 'There was an error generating the report.');
        }
        const data = await response.json();
        // The server never saw the name, so the placeholder comes back
        // intact and is swapped here.
        const paragraphs = getCompleteReportParagraphs(data)
            .map(paragraph => selectionHelper.restorePupilName(paragraph, pupilName));
        if (paragraphs.length !== 4) {
            throw new Error('The AI returned an incomplete report. Your entries have been kept so you can try again.');
        }
        resultContainer.innerHTML = `<button id="copy-report-btn" class="button" onclick="copyReportToClipboard()">Copy Report to Clipboard</button>`;
        resultContainer.innerHTML += `<div id="the-report"></div>`;
        const reportContainer = document.getElementById('the-report');
        reportContainer.textContent = paragraphs.join('\n\n');
        showGenerateStatus('Report generated.', 'success');
        clearGenerateFormAfterSuccessfulReport();
    } catch (error) {
        console.error('Error:', error);
        showResultMessage(resultContainer, error.message, { showRetry: true, retryOptions: options });
        showGenerateStatus(error.message, 'error');
    } finally {
        window.ReportGenUI?.setButtonLoading(generateButton, false);
    }
    const copyButton = document.getElementById('copy-report-btn');
    if (copyButton) {
        copyButton.style.display = 'block';
    }
}

function copyReportToClipboard() {
    const reportContainer = document.getElementById('the-report');
    const reportText = reportContainer.innerText || reportContainer.textContent;

    navigator.clipboard.writeText(reportText).then(() => {
        showGenerateStatus('Report copied to clipboard.', 'success');
    }).catch(err => {
        console.error('Failed to copy report: ', err);
        showGenerateStatus('Failed to copy report to clipboard.', 'error');
    });
}

// The page still uses inline `onclick=` / `onchange=` attributes, which resolve
// against the global scope. Module top-level bindings are module-scoped, so the
// nine functions those attributes name are published here explicitly.
//
// This is the same pattern the other browser modules use (`window.ReportGenUI`,
// `window.ReportSelection`). It is a bridge, not a destination: each of these
// disappears as its attribute becomes an addEventListener.
// Exported as well as published on `window`: the export is what lets a test
// import this file, and one list keeps the two from drifting apart.
export {
  addStrengthFocusRow,
  closeModal,
  copyReportToClipboard,
  dismissRelevanceWarning,
  generateReport,
  loadCategoriesAndComments,
  saveNewComment,
  toggleAllCategories,
  updateGenerateContext
};

if (typeof window !== 'undefined') {
  Object.assign(window, {
    addStrengthFocusRow,
    closeModal,
    copyReportToClipboard,
    dismissRelevanceWarning,
    generateReport,
    loadCategoriesAndComments,
    saveNewComment,
    toggleAllCategories,
    updateGenerateContext
  });
}
