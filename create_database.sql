CREATE DATABASE comment_bank;

USE comment_bank;

-- Create Categories table
CREATE TABLE Categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

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

-- Create Comments table
CREATE TABLE Comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    text TEXT NOT NULL,
    categoryId INT,
    FOREIGN KEY (categoryId) REFERENCES Categories(id)
);

-- Create junction table for many-to-many relationship between Comments and Subjects
CREATE TABLE CommentSubjects (
    commentId INT,
    subjectId INT,
    PRIMARY KEY (commentId, subjectId),
    FOREIGN KEY (commentId) REFERENCES Comments(id) ON DELETE CASCADE,
    FOREIGN KEY (subjectId) REFERENCES Subjects(id) ON DELETE CASCADE
);

-- Create junction table for many-to-many relationship between Comments and YearGroups
CREATE TABLE CommentYearGroups (
    commentId INT,
    yearGroupId INT,
    PRIMARY KEY (commentId, yearGroupId),
    FOREIGN KEY (commentId) REFERENCES Comments(id) ON DELETE CASCADE,
    FOREIGN KEY (yearGroupId) REFERENCES YearGroups(id) ON DELETE CASCADE
);
