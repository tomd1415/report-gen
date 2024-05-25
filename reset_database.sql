-- Drop existing database
DROP DATABASE IF EXISTS comment_bank;

-- Create new database
CREATE DATABASE comment_bank;
USE comment_bank;

-- Create tables
CREATE TABLE Subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE YearGroups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE Categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE Comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    text TEXT NOT NULL,
    categoryId INT,
    FOREIGN KEY (categoryId) REFERENCES Categories(id) ON DELETE CASCADE
);

CREATE TABLE CommentSubjects (
    commentId INT,
    subjectId INT,
    PRIMARY KEY (commentId, subjectId),
    FOREIGN KEY (commentId) REFERENCES Comments(id) ON DELETE CASCADE,
    FOREIGN KEY (subjectId) REFERENCES Subjects(id) ON DELETE CASCADE
);

CREATE TABLE CommentYearGroups (
    commentId INT,
    yearGroupId INT,
    PRIMARY KEY (commentId, yearGroupId),
    FOREIGN KEY (commentId) REFERENCES Comments(id) ON DELETE CASCADE,
    FOREIGN KEY (yearGroupId) REFERENCES YearGroups(id) ON DELETE CASCADE
);

CREATE TABLE CategorySubjectYearGroup (
    categoryId INT,
    subjectId INT,
    yearGroupId INT,
    PRIMARY KEY (categoryId, subjectId, yearGroupId),
    FOREIGN KEY (categoryId) REFERENCES Categories(id) ON DELETE CASCADE,
    FOREIGN KEY (subjectId) REFERENCES Subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (yearGroupId) REFERENCES YearGroups(id) ON DELETE CASCADE
);

CREATE TABLE SubjectYearGroupPrompts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subjectId INT,
    yearGroupId INT,
    promptPart TEXT NOT NULL,
    FOREIGN KEY (subjectId) REFERENCES Subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (yearGroupId) REFERENCES YearGroups(id) ON DELETE CASCADE
);
