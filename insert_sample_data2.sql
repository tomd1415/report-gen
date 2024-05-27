USE comment_bank;
-- Finding the ID for the subject 'Computing'
SELECT id INTO @subjectId FROM Subjects WHERE name = 'Computing';

-- Finding the ID for the year group 'Year 10'
SELECT id INTO @yearGroupId FROM YearGroups WHERE name = 'Year 10';

-- Inserting categories for Year 10 Computing
INSERT INTO `Categories` (`name`, `subjectId`, `yearGroupId`) VALUES
('Interest and Engagement', @subjectId, @yearGroupId),
('Independent Study', @subjectId, @yearGroupId),
('Programming Skills', @subjectId, @yearGroupId),
('Theory Understanding', @subjectId, @yearGroupId),
('Exam Performance', @subjectId, @yearGroupId),
('Motivation and Focus', @subjectId, @yearGroupId),
('Problem-Solving', @subjectId, @yearGroupId),
('Class Participation', @subjectId, @yearGroupId),
('Targets', @subjectId, @yearGroupId);

-- Finding the IDs for the newly inserted categories
SELECT id INTO @interestEngagementId FROM Categories WHERE name = 'Interest and Engagement' AND subjectId = @subjectId AND yearGroupId = @yearGroupId;
SELECT id INTO @independentStudyId FROM Categories WHERE name = 'Independent Study' AND subjectId = @subjectId AND yearGroupId = @yearGroupId;
SELECT id INTO @programmingSkillsId FROM Categories WHERE name = 'Programming Skills' AND subjectId = @subjectId AND yearGroupId = @yearGroupId;
SELECT id INTO @theoryUnderstandingId FROM Categories WHERE name = 'Theory Understanding' AND subjectId = @subjectId AND yearGroupId = @yearGroupId;
SELECT id INTO @examPerformanceId FROM Categories WHERE name = 'Exam Performance' AND subjectId = @subjectId AND yearGroupId = @yearGroupId;
SELECT id INTO @motivationFocusId FROM Categories WHERE name = 'Motivation and Focus' AND subjectId = @subjectId AND yearGroupId = @yearGroupId;
SELECT id INTO @problemSolvingId FROM Categories WHERE name = 'Problem-Solving' AND subjectId = @subjectId AND yearGroupId = @yearGroupId;
SELECT id INTO @classParticipationId FROM Categories WHERE name = 'Class Participation' AND subjectId = @subjectId AND yearGroupId = @yearGroupId;
SELECT id INTO @targetsId FROM Categories WHERE name = 'Targets' AND subjectId = @subjectId AND yearGroupId = @yearGroupId;

-- Inserting comments for Interest and Engagement
INSERT INTO `Comments` (`text`, `categoryId`) VALUES
('Shows good attitude initially but sometimes struggles to maintain focus.', @interestEngagementId),
('Brings a quiet confidence to all computing lessons but can sometimes lose focus.', @interestEngagementId),
('Engages well with topics of interest but can be distracted by peers.', @interestEngagementId),
('Maintains interest during hands-on activities but finds lectures challenging.', @interestEngagementId),
('Participates actively in class discussions when focused.', @interestEngagementId);

-- Inserting comments for Independent Study
INSERT INTO `Comments` (`text`, `categoryId`) VALUES
('Keen to learn quickly but sometimes rushes and misses mistakes.', @independentStudyId),
('Prefers independence and self-study, often completing work outside of school.', @independentStudyId),
('Shows initiative by researching topics independently.', @independentStudyId),
('Often asks insightful questions after studying topics alone.', @independentStudyId),
('Can work well independently but needs to check for errors.', @independentStudyId);

-- Inserting comments for Programming Skills
INSERT INTO `Comments` (`text`, `categoryId`) VALUES
('Developed skills in short bursts, not yet completing larger projects.', @programmingSkillsId),
('Shows a fantastic aptitude for coding and program design.', @programmingSkillsId),
('Can decompose problems but struggles with debugging.', @programmingSkillsId),
('Enjoys experimenting with new coding techniques.', @programmingSkillsId),
('Has a solid understanding of programming fundamentals.', @programmingSkillsId);

-- Inserting comments for Theory Understanding
INSERT INTO `Comments` (`text`, `categoryId`) VALUES
('Patchy understanding, excelling in some areas, struggling in others.', @theoryUnderstandingId),
('Has a secure understanding of the majority of theory topics covered so far.', @theoryUnderstandingId),
('Finds abstract concepts challenging but understands practical applications.', @theoryUnderstandingId),
('Can explain theory topics clearly when confident.', @theoryUnderstandingId),
('Needs to revise theory topics regularly to retain information.', @theoryUnderstandingId);

-- Inserting comments for Exam Performance
INSERT INTO `Comments` (`text`, `categoryId`) VALUES
('Struggles with written answers; needs clarity despite good verbal understanding.', @examPerformanceId),
('Can answer exam style questions quickly and accurately when in the right mood.', @examPerformanceId),
('Finds timed exams stressful but performs well under calm conditions.', @examPerformanceId),
('Needs to practice exam techniques to improve performance.', @examPerformanceId),
('Often overthinks exam questions, leading to mistakes.', @examPerformanceId);

-- Inserting comments for Motivation and Focus
INSERT INTO `Comments` (`text`, `categoryId`) VALUES
('Finds it hard to maintain enthusiasm but improving with breaks.', @motivationFocusId),
('Sometimes struggles to maintain focus throughout the lesson.', @motivationFocusId),
('Motivation fluctuates, leading to inconsistent performance.', @motivationFocusId),
('Engages better with frequent short tasks rather than long activities.', @motivationFocusId),
('Needs encouragement to stay focused during challenging tasks.', @motivationFocusId);

-- Inserting comments for Problem-Solving
INSERT INTO `Comments` (`text`, `categoryId`) VALUES
('Gets frustrated with errors but improving at debugging.', @problemSolvingId),
('Capable of working out the steps needed to go from idea to working program.', @problemSolvingId),
('Shows persistence when solving complex problems.', @problemSolvingId),
('Can break down problems into manageable parts.', @problemSolvingId),
('Enjoys problem-solving activities when in a positive mood.', @problemSolvingId);

-- Inserting comments for Class Participation
INSERT INTO `Comments` (`text`, `categoryId`) VALUES
('More confident in theory, often leading group discussions.', @classParticipationId),
('Contributes well to lessons and often has insightful discussions.', @classParticipationId),
('Engages in class activities but needs prompting to participate.', @classParticipationId),
('Supports peers during group work, providing valuable insights.', @classParticipationId),
('Participates actively when familiar with the topic.', @classParticipationId);

-- Inserting comments for Targets
INSERT INTO `Comments` (`text`, `categoryId`) VALUES
('Should work on task decomposition for complex problems.', @targetsId),
('Needs to slow down and check work for mistakes before submitting.', @targetsId),
('Should practice more exam-style questions to improve performance.', @targetsId),
('Needs to engage more consistently with all topics, not just favorites.', @targetsId),
('Should seek help when struggling rather than rushing through tasks.', @targetsId);
