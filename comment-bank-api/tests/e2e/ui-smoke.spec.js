import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { expect, test } from '@playwright/test';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');

const OFF_ORIGIN = /^https?:\/\/(?!127\.0\.0\.1[:/]|localhost[:/])/;

// Pages must load entirely from their own origin: a filtered school network
// blocks CDNs, and a third-party request leaks referrer and IP. Anything listed
// here is a KNOWN outstanding violation, not an approved exception — the goal is
// an empty list, and it is currently empty. Never add to it to make a test
// pass; vendor the asset instead.
const KNOWN_OFF_ORIGIN_VIOLATIONS = [];

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
  username = 'teacher',
  importReportsResponse = null
} = {}) => {
  // Abort off-origin requests. On a network that cannot reach the remote host
  // they hang, the page 'load' event never fires and every page.goto times out
  // — which is the normal case on a filtered school network. Aborting keeps the
  // tests exercising the app rather than the network; the dedicated test below
  // is what stops a new external asset slipping in behind this.
  await page.route(OFF_ORIGIN, (route) => route.abort());

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
    if (path === '/api/import-reports' || /^\/api\/admin\/staff\/[^/]+\/import-reports$/.test(path)) {
      if (typeof importReportsResponse === 'function') {
        return importReportsResponse(route);
      }
      return fulfillJson(route, { message: 'Reports imported successfully.', totalCategories: 1, totalComments: 2 });
    }
    if (path === '/api/logout') {
      return fulfillJson(route, { ok: true });
    }

    return fulfillJson(route, { message: `Unhandled test route: ${path}` }, 404);
  });

  await page.route('**/generate-report', async (route) => {
    if (typeof generateReportResponse === 'function') {
      return generateReportResponse(route);
    }
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
  await mockApis(page, { isAdmin: false, username: 'teacher' });

  await page.goto('/index.html');
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Logout' })).toBeVisible();
  await expect(page.locator('[data-admin-menu-item]')).toBeHidden();
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

  await page.getByRole('button', { name: 'Generate Report' }).click();
  await expect(page.locator('#generate-status')).toContainText('Effort / Motivation / Attendance');
  await expect(page.getByRole('button', { name: /Paragraph 2/i })).toHaveClass(/active/);
  await expect(page.getByRole('button', { name: /Paragraph 2/i })).toBeFocused();

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
  let attempts = 0;
  await mockApis(page, {
    generateReportResponse: (route) => {
      attempts += 1;
      if (attempts === 1) {
        return fulfillJson(route, {
          report: 'Only one paragraph.',
          paragraphs: ['Only one paragraph.']
        });
      }
      return fulfillJson(route, {
        report: 'Paragraph one.\n\nParagraph two.\n\nParagraph three.\n\nParagraph four.',
        paragraphs: ['Paragraph one.', 'Paragraph two.', 'Paragraph three.', 'Paragraph four.']
      });
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
  // Free text is present, so the confirm-before-send preview gates the request.
  await page.getByRole('button', { name: 'Confirm and send' }).click();

  await expect(page.locator('#generate-status')).toContainText('incomplete report');
  await expect(page.locator('#pupil-name')).toHaveValue('Alex');
  await expect(page.locator('#pupil-pronouns')).toHaveValue('they/them');
  await expect(page.locator('#additional-comments')).toHaveValue('Keep this note.');
  await expect(page.locator('input[value="Understands fractions well."]')).toBeChecked();
  await expect(page.getByRole('button', { name: 'Try Again' })).toBeVisible();

  await page.getByRole('button', { name: 'Try Again' }).click();
  await expect(page.locator('#generate-status')).toContainText('Report generated');
  await expect(page.locator('#pupil-name')).toHaveValue('');
  await expect(page.locator('input[value="Understands fractions well."]')).not.toBeChecked();
});

const fillReportForm = async (page, { name = 'Alice', pronouns = 'she/her', additionalComments } = {}) => {
  await chooseSubjectAndYear(page);
  await page.fill('#pupil-name', name);
  await page.fill('#pupil-pronouns', pronouns);
  if (additionalComments !== undefined) {
    await page.fill('#additional-comments', additionalComments);
  }
  await selectCommentForStep(page, 'Paragraph 1', 'Understands fractions well.');
  await selectCommentForStep(page, 'Paragraph 2', 'Works hard in lessons.');
  await selectCommentForStep(page, 'Paragraph 3', 'Explains mathematical ideas clearly.');
  await selectCommentForStep(page, 'Paragraph 4', 'Should practise checking calculations.');
};

test('free-text preview redacts the pupil name, warns about other names, and never sends the name', async ({ page }) => {
  let sentBody = null;
  await mockApis(page, {
    generateReportResponse: (route) => {
      sentBody = JSON.parse(route.request().postData());
      return fulfillJson(route, {
        report: 'PUPIL_NAME has studied fractions.\n\nPUPIL_NAME works hard.\n\nPUPIL_NAME explains ideas clearly.\n\nPUPIL_NAME should check calculations.',
        paragraphs: [
          'PUPIL_NAME has studied fractions.',
          'PUPIL_NAME works hard.',
          'PUPIL_NAME explains ideas clearly.',
          'PUPIL_NAME should check calculations.'
        ]
      });
    }
  });

  await page.goto('/index.html');
  await fillReportForm(page, {
    name: 'Alice',
    additionalComments: 'Alice works well alongside Jordan in lessons.'
  });

  await page.getByRole('button', { name: 'Generate Report' }).click();

  // The preview shows exactly what will be sent: Alice redacted, Jordan flagged.
  const preview = page.locator('#send-preview-modal');
  await expect(preview).toBeVisible();
  await expect(page.locator('#send-preview-body')).toContainText(
    'PUPIL_NAME works well alongside Jordan in lessons.'
  );
  await expect(page.locator('#send-preview-body')).not.toContainText('Alice');
  await expect(page.locator('.suspect-name')).toHaveText('Jordan');
  await expect(page.locator('#send-preview-suspects')).toContainText('Jordan');

  await page.getByRole('button', { name: 'Confirm and send' }).click();
  await expect(preview).toBeHidden();
  await expect(page.locator('#generate-status')).toContainText('Report generated');

  // The name never left the browser...
  expect(sentBody.name).toBeUndefined();
  expect(JSON.stringify(sentBody)).not.toContain('Alice');
  expect(sentBody.additionalComments).toBe('PUPIL_NAME works well alongside Jordan in lessons.');

  // ...but the finished report reads with the real name restored.
  await expect(page.locator('#the-report')).toContainText('Alice has studied fractions.');
  await expect(page.locator('#the-report')).not.toContainText('PUPIL_NAME');
});

test('free-text preview can be cancelled, and is skipped when there is no free text', async ({ page }) => {
  let requestCount = 0;
  await mockApis(page, {
    generateReportResponse: (route) => {
      requestCount += 1;
      return fulfillJson(route, {
        report: 'One.\n\nTwo.\n\nThree.\n\nFour.',
        paragraphs: ['One.', 'Two.', 'Three.', 'Four.']
      });
    }
  });

  await page.goto('/index.html');
  await fillReportForm(page, { additionalComments: 'A note about the pupil.' });

  await page.getByRole('button', { name: 'Generate Report' }).click();
  await page.getByRole('button', { name: 'Go back and edit' }).click();

  await expect(page.locator('#send-preview-modal')).toBeHidden();
  await expect(page.locator('#generate-status')).toContainText('Sending cancelled');
  expect(requestCount).toBe(0);
  await expect(page.locator('#additional-comments')).toHaveValue('A note about the pupil.');

  // Decision 1(A): with the free text cleared there is nothing to review, so
  // the preview is skipped and the report sends straight away.
  await page.fill('#additional-comments', '');
  await page.getByRole('button', { name: 'Generate Report' }).click();
  await expect(page.locator('#generate-status')).toContainText('Report generated');
  expect(requestCount).toBe(1);
});

test('no page loads an asset from another origin', async ({ page }) => {
  const unexpected = new Set();
  page.on('request', (request) => {
    const url = request.url();
    if (!OFF_ORIGIN.test(url)) {
      return;
    }
    if (KNOWN_OFF_ORIGIN_VIOLATIONS.some((prefix) => url.startsWith(prefix))) {
      return;
    }
    unexpected.add(url);
  });

  await mockApis(page);

  // Derived from the directory rather than hand-listed. The hand-written list
  // named eleven pages while public/ held twelve — `header.html` was missing,
  // an exact instance of the two-lists-that-must-agree shape this suite exists
  // to catch, sitting inside one of the gates.
  //
  // Measured 2026-08-12 before changing it: planting an off-origin <img> in
  // header.html DID turn the old test red, because page-layout.js injects that
  // fragment into every page, so its assets are requested during the visits that
  // were listed. So this was a latent gap, not a live hole — worth saying
  // plainly rather than dressing up as a catch. What it would have missed is a
  // genuinely new standalone page, which is the ordinary way pages get added.
  //
  // The floor below is what the explicit list was really providing (see
  // docs/TESTING.md rule 4): a readdir that returned nothing would otherwise
  // make this test pass having visited no pages at all.
  const pages = fs.readdirSync(publicDir)
    .filter((name) => name.endsWith('.html'))
    .sort()
    .map((name) => `/${name}`);
  expect(pages.length).toBeGreaterThanOrEqual(12);
  for (const path of pages) {
    await page.goto(path).catch((error) => {
      // The login pages redirect as soon as the mocked session reports it is
      // authenticated, which aborts the in-flight navigation. Harmless here:
      // this test cares which origins were requested, not that the navigation
      // settled, and the requests are recorded either way.
      //
      // The same race surfaces as *two different* messages depending on how far
      // the navigation got before the redirect won — 'net::ERR_ABORTED' from the
      // network layer, or 'interrupted by another navigation' from the
      // navigation layer. Which one you see is timing-dependent, so on a loaded
      // machine the second appears and the first does not. Tolerating only one
      // of them made this test fail intermittently (seen 2026-08-06 at load
      // average ~31 on 4 cores).
      //
      // Neither tolerance weakens the guard: the `page.on('request')` listener
      // above has already recorded every request that was issued, whether or
      // not the navigation itself resolved.
      const isRedirectRace = /ERR_ABORTED/.test(error.message)
        || /interrupted by another navigation/.test(error.message);
      if (!isRedirectRace) {
        throw error;
      }
    });
    // Let any late asset request (image, font, stylesheet) be recorded.
    await page.waitForTimeout(150);
  }

  expect([...unexpected]).toEqual([]);
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

  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Logout' })).toBeVisible();
  await expect(page.locator('.admin-step-number')).toHaveText(['1', '2', '3']);
  await expect(page.locator('.admin-step-heading')).toContainText([
    'Choose Staff And Class',
    'Set Staff Context',
    'Import Previous Reports'
  ]);

  let subjectDialog = '';
  page.once('dialog', async (dialog) => {
    subjectDialog = dialog.message();
    await dialog.dismiss();
  });
  await page.locator('#subject-list').getByRole('button', { name: 'Delete' }).first().click();
  expect(subjectDialog).toContain('Delete subject "Mathematics"?');
  expect(subjectDialog).toContain('global subject');

  let yearGroupDialog = '';
  page.once('dialog', async (dialog) => {
    yearGroupDialog = dialog.message();
    await dialog.dismiss();
  });
  await page.locator('#year-group-list').getByRole('button', { name: 'Delete' }).first().click();
  expect(yearGroupDialog).toContain('Delete year group "Year 7"?');
  expect(yearGroupDialog).toContain('global year group');
});

test('import page warns about possible names and requires confirmation before sending', async ({ page }) => {
  let sentBody = null;
  await mockApis(page, {
    importReportsResponse: (route) => {
      sentBody = JSON.parse(route.request().postData());
      return fulfillJson(route, { message: 'Reports imported successfully.', totalCategories: 1, totalComments: 2 });
    }
  });

  await page.goto('/import_reports.html');
  await chooseSubjectAndYear(page);

  // The field that used to collect a list of pupils' names is gone (removed
  // 2026-08-06, owner decision) — nothing on this page should ask for one.
  await expect(page.locator('#pupil-names')).toHaveCount(0);
  await expect(page.locator('#reports-privacy-guidance')).toContainText("Do not paste pupils' names");

  // Live, warn-only: appears as soon as something looks like a name, and never
  // edits the pasted text.
  await page.fill('#reports', 'Worked well with Jordan. Later Jordan helped Priya with fractions.');
  const warning = page.locator('#import-suspects');
  await expect(warning).toBeVisible();
  await expect(warning).toContainText('Jordan (2)');
  await expect(warning).toContainText('Priya');
  await expect(page.locator('#reports')).toHaveValue(
    'Worked well with Jordan. Later Jordan helped Priya with fractions.'
  );

  await page.getByRole('button', { name: 'Import Reports' }).click();

  // Confirm-before-send: snippets, not the whole 60k paste.
  const modal = page.locator('#import-preview-modal');
  await expect(modal).toBeVisible();
  await expect(page.locator('#import-preview-body')).toContainText('Jordan');
  await expect(page.locator('#import-preview-body')).toContainText('appears 2 times');
  await expect(page.locator('.suspect-name').first()).toHaveText('Jordan');
  expect(sentBody).toBeNull();   // nothing sent while the dialog is open

  await page.getByRole('button', { name: 'Confirm and import' }).click();
  await expect(modal).toBeHidden();
  await expect(page.locator('#result-container')).toContainText('Import completed');

  // Warn-only means the text is sent exactly as pasted — nothing was redacted
  // or mangled on the way through — and no name list is sent with it.
  expect(sentBody.reports).toBe('Worked well with Jordan. Later Jordan helped Priya with fractions.');
  expect(sentBody.pupilNames).toBeUndefined();
});

test('import can be cancelled, and is not gated when nothing looks like a name', async ({ page }) => {
  let requestCount = 0;
  await mockApis(page, {
    importReportsResponse: (route) => {
      requestCount += 1;
      return fulfillJson(route, { message: 'Reports imported successfully.', totalCategories: 1, totalComments: 2 });
    }
  });

  await page.goto('/import_reports.html');
  await chooseSubjectAndYear(page);
  await page.fill('#reports', 'Confident with fractions and worked with Jordan.');

  await page.getByRole('button', { name: 'Import Reports' }).click();
  await page.getByRole('button', { name: 'Go back and edit' }).click();

  await expect(page.locator('#import-preview-modal')).toBeHidden();
  await expect(page.locator('#result-container')).toContainText('Import cancelled');
  expect(requestCount).toBe(0);
  // Cancelling must not lose the teacher's paste.
  await expect(page.locator('#reports')).toHaveValue('Confident with fractions and worked with Jordan.');

  // With nothing flagged there is nothing to review, so the dialog is skipped.
  // Stated plainly because it is the honest limit of this control: a clean pass
  // means the heuristic found nothing, not that no name is present.
  await page.fill('#reports', 'confident with fractions and improving steadily.');
  await expect(page.locator('#import-suspects')).toBeHidden();
  await page.getByRole('button', { name: 'Import Reports' }).click();
  await expect(page.locator('#import-preview-modal')).toBeHidden();
  await expect(page.locator('#result-container')).toContainText('Import completed');
  expect(requestCount).toBe(1);
});

test('import refuses to send if the possible-name check could not load', async ({ page }) => {
  // Fail closed. If report-selection.js does not load, the check silently finds
  // nothing — and "nothing found" is indistinguishable from "never ran". Without
  // this branch a broken script would look exactly like a clean paste and the
  // import would go through with no check at all.
  let requestCount = 0;
  await mockApis(page, {
    importReportsResponse: (route) => {
      requestCount += 1;
      return fulfillJson(route, { message: 'Reports imported successfully.' });
    }
  });
  await page.route('**/report-selection.js', (route) => route.abort());

  await page.goto('/import_reports.html');
  await chooseSubjectAndYear(page);
  await page.fill('#reports', 'Worked well with Jordan this term.');

  await expect(page.locator('#import-suspects')).toContainText('Could not run the possible-name check');

  await page.getByRole('button', { name: 'Import Reports' }).click();
  await expect(page.locator('#result-container')).toContainText('Could not run the possible-name check');
  expect(requestCount).toBe(0);
});

test('admin staff import refuses to send if the possible-name check could not load', async ({ page }) => {
  // The admin Staff Comment Banks panel carries its OWN copy of the possible-name
  // check — a second implementation of the same privacy control. Only the
  // teacher-facing page's fail-closed branch was covered, so this one could rot
  // without anything going red. Two implementations that must agree, with
  // nothing checking that they do.
  let requestCount = 0;
  await mockApis(page, {
    isAdmin: true,
    username: 'admin',
    importReportsResponse: (route) => {
      requestCount += 1;
      return fulfillJson(route, { message: 'Reports imported successfully.' });
    }
  });
  await page.route('**/report-selection.js', (route) => route.abort());

  await page.goto('/adminpage.html');
  await page.selectOption('#staff-bank-user', '1');
  await page.selectOption('#staff-bank-subject', '1');
  await page.selectOption('#staff-bank-year-group', '1');
  await page.fill('#staff-bank-reports', 'Worked well with Jordan this term.');

  await page.locator('#staff-bank-import-button').click();

  await expect(page.locator('#staff-bank-result')).toContainText('Could not run the possible-name check');
  expect(requestCount).toBe(0);
});
