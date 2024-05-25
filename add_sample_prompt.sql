USE comment_bank;
INSERT INTO SubjectYearGroupPrompts (subjectId, yearGroupId, promptPart) VALUES (
  (SELECT id FROM Subjects WHERE name = 'Computing'), 
  (SELECT id FROM YearGroups WHERE name = 'Year 10'), 
  'Generate a concise school report for a Computer Science GCSE student. This report should avoid repetition, be professional and friendly, and flow well. This text will appear in a preformatted text box and so should not have any titles or headings. There should be no subheadings. This report should be around 150 words.'
);
