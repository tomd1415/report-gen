-- Drop existing database
DROP DATABASE IF EXISTS comment_bank;

-- Create new database
CREATE DATABASE comment_bank;
USE comment_bank;

-- Drop existing tables if they exist
DROP TABLE IF EXISTS CommentSubjects;
DROP TABLE IF EXISTS CommentYearGroups;
DROP TABLE IF EXISTS CategorySubjectYearGroups;
DROP TABLE IF EXISTS Comments;
DROP TABLE IF EXISTS Categories;
DROP TABLE IF EXISTS Subjects;
DROP TABLE IF EXISTS YearGroups;
DROP TABLE IF EXISTS SubjectYearGroupPrompts;

-- Create Subjects table
CREATE TABLE Subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL
);

-- Create YearGroups table
CREATE TABLE YearGroups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL
);

-- Create Categories table
CREATE TABLE Categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL
);

-- Create Comments table
CREATE TABLE Comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  text TEXT NOT NULL,
  categoryId INT,
  FOREIGN KEY (categoryId) REFERENCES Categories(id)
);

-- Create join table for Category-Subject-YearGroup associations
CREATE TABLE CategorySubjectYearGroups (
  categoryId INT,
  subjectId INT,
  yearGroupId INT,
  FOREIGN KEY (categoryId) REFERENCES Categories(id),
  FOREIGN KEY (subjectId) REFERENCES Subjects(id),
  FOREIGN KEY (yearGroupId) REFERENCES YearGroups(id),
  PRIMARY KEY (categoryId, subjectId, yearGroupId)
);

-- Create join table for Comment-Subject associations
CREATE TABLE CommentSubjects (
  commentId INT,
  subjectId INT,
  FOREIGN KEY (commentId) REFERENCES Comments(id),
  FOREIGN KEY (subjectId) REFERENCES Subjects(id),
  PRIMARY KEY (commentId, subjectId)
);

-- Create join table for Comment-YearGroup associations
CREATE TABLE CommentYearGroups (
  commentId INT,
  yearGroupId INT,
  FOREIGN KEY (commentId) REFERENCES Comments(id),
  FOREIGN KEY (yearGroupId) REFERENCES YearGroups(id),
  PRIMARY KEY (commentId, yearGroupId)
);

-- Create SubjectYearGroupPrompts table
CREATE TABLE SubjectYearGroupPrompts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subjectId INT,
  yearGroupId INT,
  promptPart TEXT NOT NULL,
  FOREIGN KEY (subjectId) REFERENCES Subjects(id),
  FOREIGN KEY (yearGroupId) REFERENCES YearGroups(id)
);
