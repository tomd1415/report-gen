import { expect, test } from '@playwright/test';

const subjects = [{ id: 1, name: 'Mathematics' }];
const yearGroups = [{ id: 1, name: 'Year 7' }];
const staffUsers = [
  { id: 1, username: 'teacher', isAdmin: false },
  { id: 2, username: 'admin', isAdmin: true }
];

const reportCategories = [
  {
    id: 11,
    name: 'Topics studied / knowledge / skills acquired',
    Comments: [{ id: 101, text: 'Understands fractions well.' }]
  },
  {
    id: 12,
    name: 'Effort / motivation / attendance',
    Comments: [{ id: 102, text: 'Works hard in lessons.' }]
  },
  {
    id: 13,
    name: 'Strengths / achievements',
    Comments: [{ id: 103, text: 'Explains mathematical ideas clearly.' }]
  },
  {
    id: 14,
    name: 'Areas for development / targets toward end-of-year Teacher Target',
    Comments: [{ id: 104, text: 'Should practise checking calculations.' }]
  }
];

const manageCategories = [
  {
    id: 21,
    name: 'Effort',
    Comments: [
      { id: 201, text: 'Works hard in lessons.' },
      { id: 202, text: 'Participates well in group tasks.' }
    ]
  },
  {
    id: 22,
    name: 'Knowledge',
    Comments: [{ id: 203, text: 'Uses fractions confidently.' }]
  }
];

const fulfillJson = (route, body, status = 200) => route.fulfill({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body)
});

const fulfillText = (route, body, status = 200) => route.fulfill({
  status,
  contentType: 'text/plain',
  body
});

const mockApis = async (page, {
  categories = reportCategories,
  generateReportResponse = {
    body: {
      report: 'Paragraph one.\n\nParagraph two.\n\nParagraph three.\n\nParagraph four.',
      paragraphs: ['Paragraph one.', 'Paragraph two.', 'Paragraph three.', 'Paragraph four.']
    },
    status: 200
  },
  isAdmin = false,
  username = 'teacher'
} = {}) => {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === '/api/authenticated') {
      return fulfillJson(route, { authenticated: true });
    }
    if (path === '/api/user-info') {
      return fulfillJson(route, { id: isAdmin ? 2 : 1, username, isAdmin });
    }
    if (path === '/api/user-selected-settings') {
      return fulfillJson(route, { userSubjects: [], userYearGroups: [] });
    }
    if (path === '/api/subjects' && request.method() === 'GET') {
      return fulfillJson(route, subjects);
    }
    if (path === '/api/year-groups' && request.method() === 'GET') {
      return fulfillJson(route, yearGroups);
    }
    if (path === '/api/users' && request.method() === 'GET') {
      return fulfillJson(route, staffUsers);
    }
    if (path === '/api/categories-comments') {
      return fulfillJson(route, categories);
    }
    if (path === '/api/prompts') {
      return fulfillText(route, 'Use the school report structure.');
    }
    if (path === '/api/subject-context') {
      return fulfillJson(route, {
        subjectDescription: 'Number, algebra, and problem solving.',
        wordLimit: 140
      });
    }
    if (/^\/api\/admin\/staff\/[^/]+\/subject-context$/.test(path)) {
      return fulfillJson(route, {
        subjectDescription: 'Admin-entered staff context.',
        wordLimit: 150
      });
    }
    if (/^\/api\/admin\/staff\/[^/]+\/prompts\/[^/]+\/[^/]+$/.test(path)) {
      return fulfillJson(route, { promptPart: 'Staff prompt text.' });
    }
    if (/^\/api\/admin\/staff\/[^/]+\/comment-bank$/.test(path)) {
      return fulfillJson(route, { totalCategories: 2, totalComments: 3 });
    }
    if (path === '/api/logout') {
      return fulfillJson(route, { ok: true });
    }

    return fulfillJson(route, { message: `Unhandled test route: ${path}` }, 404);
  });

  await page.route('**/generate-report', async (route) => {
    return fulfillJson(route, generateReportResponse.body, generateReportResponse.status);
  });
};

const chooseSubjectAndYear = async (page) => {
  await page.selectOption('#subject-select', '1');
  await page.selectOption('#year-group-select', '1');
};

const selectCommentForStep = async (page, stepName, commentText) => {
  await page.getByRole('button', { name: new RegExp(stepName, 'i') }).click();
  await page.getByLabel(commentText).check();
};

test('Generate Report ready check validates required fields and reaches a generated report', async ({ page }) => {
  await mockApis(page);

  await page.goto('/index.html');
  await chooseSubjectAndYear(page);

  await expect(page.locator('#generate-status')).toContainText('Loaded 4 categories');
  await expect(page.locator('#ready-checklist')).toContainText('Pupil name');

  await page.getByRole('button', { name: 'Generate Report' }).click();
  await expect(page.locator('#generate-status')).toContainText('Please enter the pupil name');
  await expect(page.locator('#pupil-name')).toHaveClass(/field-invalid/);
  await expect(page.locator('#pupil-name')).toBeFocused();

  await page.fill('#pupil-name', 'Alex');
  await page.fill('#pupil-pronouns', 'they/them');
  await selectCommentForStep(page, 'Paragraph 1', 'Understands fractions well.');
  await selectCommentForStep(page, 'Paragraph 2', 'Works hard in lessons.');
  await selectCommentForStep(page, 'Paragraph 3', 'Explains mathematical ideas clearly.');
  await selectCommentForStep(page, 'Paragraph 4', 'Should practise checking calculations.');

  await expect(page.locator('.ready-item--complete').filter({ hasText: 'Paragraph comments' })).toContainText('4 selected');

  await page.getByRole('button', { name: 'Generate Report' }).click();
  await expect(page.locator('#generate-status')).toContainText('Report generated');
  await expect(page.locator('#the-report')).toContainText('Paragraph three.');
  await expect(page.locator('#pupil-name')).toHaveValue('');
  await expect(page.locator('#pupil-pronouns')).toHaveValue('');
  await expect(page.locator('input[value="Understands fractions well."]')).not.toBeChecked();
});

test('Generate Report keeps entered data when the returned report is incomplete', async ({ page }) => {
  await mockApis(page, {
    generateReportResponse: {
      body: {
        report: 'Only one paragraph.',
        paragraphs: ['Only one paragraph.']
      },
      status: 200
    }
  });

  await page.goto('/index.html');
  await chooseSubjectAndYear(page);

  await page.fill('#pupil-name', 'Alex');
  await page.fill('#pupil-pronouns', 'they/them');
  await page.fill('#additional-comments', 'Keep this note.');
  await selectCommentForStep(page, 'Paragraph 1', 'Understands fractions well.');
  await selectCommentForStep(page, 'Paragraph 2', 'Works hard in lessons.');
  await selectCommentForStep(page, 'Paragraph 3', 'Explains mathematical ideas clearly.');
  await selectCommentForStep(page, 'Paragraph 4', 'Should practise checking calculations.');

  await page.getByRole('button', { name: 'Generate Report' }).click();

  await expect(page.locator('#generate-status')).toContainText('incomplete report');
  await expect(page.locator('#pupil-name')).toHaveValue('Alex');
  await expect(page.locator('#pupil-pronouns')).toHaveValue('they/them');
  await expect(page.locator('#additional-comments')).toHaveValue('Keep this note.');
  await expect(page.locator('input[value="Understands fractions well."]')).toBeChecked();
});

test('Generate Report shows an empty state when no comment bank exists', async ({ page }) => {
  await mockApis(page, { categories: [] });

  await page.goto('/index.html');
  await chooseSubjectAndYear(page);

  await expect(page.locator('.empty-state')).toContainText('No comments found');
  await expect(page.locator('#ready-checklist')).toContainText('no comment bank loaded');
  await expect(page.locator('#generate-report')).toBeHidden();
});

test('Manage Comments shows counts, expands/collapses, and confirms destructive actions clearly', async ({ page }) => {
  await mockApis(page, { categories: manageCategories });

  await page.goto('/manage_categories_comments.html');
  await chooseSubjectAndYear(page);

  await expect(page.locator('#comment-bank-counts')).toHaveText('2 categories / 3 comments');
  await expect(page.getByText('Works hard in lessons.')).toBeHidden();

  await page.getByRole('button', { name: 'Expand all' }).click();
  await expect(page.getByText('Works hard in lessons.')).toBeVisible();

  await page.getByRole('button', { name: 'Collapse all' }).click();
  await expect(page.getByText('Works hard in lessons.')).toBeHidden();

  let dialogMessage = '';
  page.once('dialog', async (dialog) => {
    dialogMessage = dialog.message();
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: 'Delete Category' }).first().click();
  expect(dialogMessage).toContain('Delete "Effort" and its 2 comments?');
});

test('Import pages highlight the first missing required field', async ({ page }) => {
  await mockApis(page);

  await page.goto('/import_reports.html');
  await page.getByRole('button', { name: 'Import Reports' }).click();

  await expect(page.locator('#result-container')).toContainText('Please choose a subject');
  await expect(page.locator('#subject-select')).toHaveClass(/field-invalid/);
  await expect(page.locator('#subject-select')).toBeFocused();

  await page.goto('/manage_export_import.html');
  await page.getByRole('button', { name: 'Import', exact: true }).click();

  await expect(page.locator('#csv-status')).toContainText('Please select a subject');
  await expect(page.locator('#subject-select')).toHaveClass(/field-invalid/);
});

test('Admin staff comment bank workflow is presented as three clear steps', async ({ page }) => {
  await mockApis(page, { isAdmin: true, username: 'admin' });

  await page.goto('/adminpage.html');

  await expect(page.locator('.admin-step-number')).toHaveText(['1', '2', '3']);
  await expect(page.locator('.admin-step-heading')).toContainText([
    'Choose Staff And Class',
    'Set Staff Context',
    'Import Previous Reports'
  ]);
});
