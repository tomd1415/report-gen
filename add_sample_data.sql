Use comment_bank;

-- Insert Subjects
INSERT INTO Subjects (name) VALUES ('Computing');

-- Insert Year Groups
INSERT INTO YearGroups (name) VALUES ('Year 10'), ('Year 11');

-- Insert Categories
INSERT INTO Categories (name) VALUES 
('Interest and Engagement'), 
('Independent Study'), 
('Programming Skills'), 
('Theory Understanding'), 
('Exam Performance'), 
('Motivation and Focus'), 
('Problem-Solving'), 
('Class Participation');

-- Insert Comments for Year 10 and Computing
INSERT INTO Comments (text, categoryId) VALUES 
('shows good attitude initially but sometimes struggles to maintain focus.', 1),
('keen to learn quickly but sometimes rushes and misses mistakes.', 2),
('developed skills in short bursts, not yet completing larger projects.', 3),
('patchy understanding, excelling in some areas, struggling in others.', 4),
('struggles with written answers; needs clarity despite good verbal understanding.', 5),
('finds it hard to maintain enthusiasm but improving with breaks.', 6),
('gets frustrated with errors but improving at debugging.', 7),
('more confident in theory, often leading group discussions.', 8);

-- Insert Category-Subject-YearGroup associations
INSERT INTO CategorySubjectYearGroups (categoryId, subjectId, yearGroupId) VALUES 
(1, 1, 1),
(2, 1, 1),
(3, 1, 1),
(4, 1, 1),
(5, 1, 1),
(6, 1, 1),
(7, 1, 1),
(8, 1, 1);

-- Insert Comment-Subject associations
INSERT INTO CommentSubjects (commentId, subjectId) VALUES 
(1, 1),
(2, 1),
(3, 1),
(4, 1),
(5, 1),
(6, 1),
(7, 1),
(8, 1);

-- Insert Comment-YearGroup associations
INSERT INTO CommentYearGroups (commentId, yearGroupId) VALUES 
(1, 1),
(2, 1),
(3, 1),
(4, 1),
(5, 1),
(6, 1),
(7, 1),
(8, 1);

-- Insert prompt part for Year 10 and Computing
INSERT INTO SubjectYearGroupPrompts (subjectId, yearGroupId, promptPart) VALUES 
(1, 1, 'Generate a concise school report for a Computer Science GCSE student. This report should avoid repetition, be professional and friendly, and flow well. This text will appear in a preformatted text box and so should not have any titles or headings. There should be no sub-headings. This report should be around 150 words.');
