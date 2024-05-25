USE comment_bank;
CREATE TABLE SubjectYearGroupPrompts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subjectId INT,
    yearGroupId INT,
    promptPart TEXT,
    FOREIGN KEY (subjectId) REFERENCES Subjects(id),
    FOREIGN KEY (yearGroupId) REFERENCES YearGroups(id)
);
