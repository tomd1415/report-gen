USE comment_bank;
CREATE TABLE IF NOT EXISTS `CategorySubjectYearGroup` (
    `categoryId` INT,
    `subjectId` INT,
    `yearGroupId` INT,
    PRIMARY KEY (`categoryId`, `subjectId`, `yearGroupId`),
    FOREIGN KEY (`categoryId`) REFERENCES `Categories`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`subjectId`) REFERENCES `Subjects`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`yearGroupId`) REFERENCES `YearGroups`(`id`) ON DELETE CASCADE
);
