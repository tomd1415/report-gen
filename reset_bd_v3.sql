DROP DATABASE IF EXISTS comment_bank;
CREATE DATABASE comment_bank;
USE comment_bank;

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
    name VARCHAR(255) NOT NULL,
    subjectId INT,
    yearGroupId INT,
    FOREIGN KEY (subjectId) REFERENCES Subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (yearGroupId) REFERENCES YearGroups(id) ON DELETE CASCADE
);

-- Create Comments table
CREATE TABLE Comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    text TEXT NOT NULL,
    categoryId INT,
    FOREIGN KEY (categoryId) REFERENCES Categories(id) ON DELETE CASCADE
);

-- Create Prompts table
CREATE TABLE Prompts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subjectId INT,
    yearGroupId INT,
    promptPart TEXT NOT NULL,
    FOREIGN KEY (subjectId) REFERENCES Subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (yearGroupId) REFERENCES YearGroups(id) ON DELETE CASCADE
);
