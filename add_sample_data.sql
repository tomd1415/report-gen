USE comment_bank;
-- Create Year Groups
INSERT INTO YearGroups (name) VALUES
('Year 10'),
('Year 11');

-- Add Subject "Computing"
INSERT INTO Subjects (name) VALUES
('Computing');

-- Insert Categories
INSERT INTO Categories (name) VALUES 
('Interest and Engagement'),
('Independent Study'),
('Programming Skills'),
('Theory Understanding'),
('Exam Performance'),
('Motivation and Focus'),
('Problem-Solving'),
('Class Participation'),
('Targets');

-- Insert Comments
INSERT INTO Comments (text, categoryId) VALUES 
-- Interest and Engagement
('Shows good attitude initially but sometimes struggles to maintain focus.', (SELECT id FROM Categories WHERE name = 'Interest and Engagement')),
('Has fantastic enthusiasm, starting lessons with energy and eagerness.', (SELECT id FROM Categories WHERE name = 'Interest and Engagement')),
('Brings quiet confidence and ensures correct setup before starting.', (SELECT id FROM Categories WHERE name = 'Interest and Engagement')),
('Shows strong interest and enthusiasm, especially in interesting, relevant, and challenging topics.', (SELECT id FROM Categories WHERE name = 'Interest and Engagement')),

-- Independent Study
('Keen to learn quickly but sometimes rushes and misses mistakes.', (SELECT id FROM Categories WHERE name = 'Independent Study')),
('Prefers independence, completing much work outside of school.', (SELECT id FROM Categories WHERE name = 'Independent Study')),
('Works hard in lessons and completes extra work outside class.', (SELECT id FROM Categories WHERE name = 'Independent Study')),

-- Programming Skills
('Developed skills in short bursts, not yet completing larger projects.', (SELECT id FROM Categories WHERE name = 'Programming Skills')),
('Shows fantastic aptitude for coding and program design, from idea to program.', (SELECT id FROM Categories WHERE name = 'Programming Skills')),
('Struggled with programming more than theory but improving in both.', (SELECT id FROM Categories WHERE name = 'Programming Skills')),
('Good at experimenting with concepts, gaining deeper understanding.', (SELECT id FROM Categories WHERE name = 'Programming Skills')),
('Better at programming than theory; can decompose tasks but struggles with error messages.', (SELECT id FROM Categories WHERE name = 'Programming Skills')),

-- Theory Understanding
('Patchy understanding, excelling in some areas, struggling in others.', (SELECT id FROM Categories WHERE name = 'Theory Understanding')),
('Demonstrates secure understanding of most theory topics.', (SELECT id FROM Categories WHERE name = 'Theory Understanding')),
('Strong in topics like networks, explaining concepts clearly.', (SELECT id FROM Categories WHERE name = 'Theory Understanding')),
('Consistently produces high-quality work showing secure understanding.', (SELECT id FROM Categories WHERE name = 'Theory Understanding')),

-- Exam Performance
('Struggles with written answers; needs clarity despite good verbal understanding.', (SELECT id FROM Categories WHERE name = 'Exam Performance')),
('Answers exam-style questions quickly and accurately when in the right mood.', (SELECT id FROM Categories WHERE name = 'Exam Performance')),
('Finds exam-style questions hard without support but working on it.', (SELECT id FROM Categories WHERE name = 'Exam Performance')),

-- Motivation and Focus
('Finds it hard to maintain enthusiasm but improving with breaks.', (SELECT id FROM Categories WHERE name = 'Motivation and Focus')),
('Works well on interesting topics but sometimes loses motivation.', (SELECT id FROM Categories WHERE name = 'Motivation and Focus')),
('Needs reminders to stay on task but can produce good work.', (SELECT id FROM Categories WHERE name = 'Motivation and Focus')),

-- Problem-Solving
('Gets frustrated with errors but improving at debugging.', (SELECT id FROM Categories WHERE name = 'Problem-Solving')),
('Resourceful and persistent, sees mistakes as learning opportunities.', (SELECT id FROM Categories WHERE name = 'Problem-Solving')),
('Finds it hard to finish programs from written problems but improving.', (SELECT id FROM Categories WHERE name = 'Problem-Solving')),

-- Class Participation
('More confident in theory, often leading group discussions.', (SELECT id FROM Categories WHERE name = 'Class Participation')),
('Contributes well with insightful class discussions.', (SELECT id FROM Categories WHERE name = 'Class Participation')),
('Asks interesting questions showing good topic understanding.', (SELECT id FROM Categories WHERE name = 'Class Participation')),

-- Targets
('Should work on task decomposition for complex problems.', (SELECT id FROM Categories WHERE name = 'Targets')),
('Should maintain enthusiasm throughout lessons, taking breaks when needed.', (SELECT id FROM Categories WHERE name = 'Targets')),
('Should improve written answers for clarity and coherence.', (SELECT id FROM Categories WHERE name = 'Targets')),
('Should develop programming skills with larger projects.', (SELECT id FROM Categories WHERE name = 'Targets')),
('Should connect theoretical concepts with practical applications.', (SELECT id FROM Categories WHERE name = 'Targets')),
('Should practice timed exam questions for accuracy and speed.', (SELECT id FROM Categories WHERE name = 'Targets')),
('Should interpret error messages to guide debugging.', (SELECT id FROM Categories WHERE name = 'Targets')),
('Should seek support, avoid rushing, and check work.', (SELECT id FROM Categories WHERE name = 'Targets')),
('Should minimize distractions and maintain focus.', (SELECT id FROM Categories WHERE name = 'Targets')),
('Should participate in discussions and ask insightful questions.', (SELECT id FROM Categories WHERE name = 'Targets'));

-- Link Comments to Subject "Computing"
INSERT INTO CommentSubjects (commentId, subjectId)
SELECT id, (SELECT id FROM Subjects WHERE name = 'Computing') FROM Comments;

-- Link Comments to Year Groups "Year 10" and "Year 11"
INSERT INTO CommentYearGroups (commentId, yearGroupId)
SELECT id, (SELECT id FROM YearGroups WHERE name = 'Year 10') FROM Comments;
INSERT INTO CommentYearGroups (commentId, yearGroupId)
SELECT id, (SELECT id FROM YearGroups WHERE name = 'Year 11') FROM Comments;
