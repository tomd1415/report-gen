-- Create the database
CREATE DATABASE IF NOT EXISTS comment_bank;

-- Use the database
USE comment_bank;

-- Create Subjects table
CREATE TABLE IF NOT EXISTS Subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

-- Create YearGroups table
CREATE TABLE IF NOT EXISTS YearGroups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

-- Create Categories table
CREATE TABLE IF NOT EXISTS Categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

-- Create Comments table
CREATE TABLE IF NOT EXISTS Comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    text TEXT NOT NULL,
    categoryId INT,
    FOREIGN KEY (categoryId) REFERENCES Categories(id)
);

-- Create CommentSubject table for many-to-many relationship between Comments and Subjects
CREATE TABLE IF NOT EXISTS CommentSubjects (
    commentId INT,
    subjectId INT,
    PRIMARY KEY (commentId, subjectId),
    FOREIGN KEY (commentId) REFERENCES Comments(id),
    FOREIGN KEY (subjectId) REFERENCES Subjects(id)
);

-- Create CommentYearGroup table for many-to-many relationship between Comments and YearGroups
CREATE TABLE IF NOT EXISTS CommentYearGroups (
    commentId INT,
    yearGroupId INT,
    PRIMARY KEY (commentId, yearGroupId),
    FOREIGN KEY (commentId) REFERENCES Comments(id),
    FOREIGN KEY (yearGroupId) REFERENCES YearGroups(id)
);

-- Create SubjectYearGroupPrompts table to store the prompt parts for each subject and year group combination
CREATE TABLE IF NOT EXISTS SubjectYearGroupPrompts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subjectId INT,
    yearGroupId INT,
    promptPart TEXT NOT NULL,
    FOREIGN KEY (subjectId) REFERENCES Subjects(id),
    FOREIGN KEY (yearGroupId) REFERENCES YearGroups(id)
);

-- Insert initial data into Subjects
INSERT INTO Subjects (name) VALUES ('Computing');

-- Insert initial data into YearGroups
INSERT INTO YearGroups (name) VALUES ('Year 10'), ('Year 11');

-- Insert initial data into Categories
INSERT INTO Categories (name) VALUES ('Interest and Engagement'), ('Independent Study'), ('Programming Skills'), ('Theory Understanding'), ('Exam Performance'), ('Motivation and Focus'), ('Problem-Solving'), ('Class Participation'), ('Targets');

-- Insert initial data into Comments (example data)
INSERT INTO Comments (text, categoryId) VALUES 
('shows good attitude initially but sometimes struggles to maintain focus.', 1),
('keen to learn quickly but sometimes rushes and misses mistakes.', 2),
('developed skills in short bursts, not yet completing larger projects.', 3),
('patchy understanding, excelling in some areas, struggling in others.', 4),
('struggles with written answers; needs clarity despite good verbal understanding.', 5),
('finds it hard to maintain enthusiasm but improving with breaks.', 6),
('gets frustrated with errors but improving at debugging.', 7),
('more confident in theory, often leading group discussions.', 8),
('should work on task decomposition for complex problems.', 9);

-- Associate Comments with Subjects and YearGroups (example data)
INSERT INTO CommentSubjects (commentId, subjectId) VALUES 
(1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (6, 1), (7, 1), (8, 1), (9, 1);

INSERT INTO CommentYearGroups (commentId, yearGroupId) VALUES 
(1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (6, 1), (7, 1), (8, 1), (9, 1),
(1, 2), (2, 2), (3, 2), (4, 2), (5, 2), (6, 2), (7, 2), (8, 2), (9, 2);

-- Insert prompt part for Year 10 Computing
INSERT INTO SubjectYearGroupPrompts (subjectId, yearGroupId, promptPart) VALUES 
((SELECT id FROM Subjects WHERE name = 'Computing'), 
(SELECT id FROM YearGroups WHERE name = 'Year 10'), 
'Generate a concise school report for a Computer Science GCSE student. This report should avoid repetition, be professional and friendly, and flow well. This text will appear in a preformatted text box and so should not have any titles or headings. There should be no subheadings. This report should be around 150 words.');
