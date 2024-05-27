DROP DATABASE IF EXISTS comment_bank;
CREATE DATABASE comment_bank;
USE comment_bank;

CREATE TABLE `Categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `Subjects` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `YearGroups` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `Comments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `text` text NOT NULL,
  `categoryId` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `categoryId` (`categoryId`),
  CONSTRAINT `Comments_ibfk_1` FOREIGN KEY (`categoryId`) REFERENCES `Categories` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `CommentSubjects` (
  `commentId` int(11) NOT NULL,
  `subjectId` int(11) NOT NULL,
  PRIMARY KEY (`commentId`, `subjectId`),
  FOREIGN KEY (`commentId`) REFERENCES `Comments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`subjectId`) REFERENCES `Subjects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `CommentYearGroups` (
  `commentId` int(11) NOT NULL,
  `yearGroupId` int(11) NOT NULL,
  PRIMARY KEY (`commentId`, `yearGroupId`),
  FOREIGN KEY (`commentId`) REFERENCES `Comments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`yearGroupId`) REFERENCES `YearGroups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `CategorySubjectYearGroups` (
  `categoryId` int(11) NOT NULL,
  `subjectId` int(11) NOT NULL,
  `yearGroupId` int(11) NOT NULL,
  PRIMARY KEY (`categoryId`, `subjectId`, `yearGroupId`),
  FOREIGN KEY (`categoryId`) REFERENCES `Categories` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`subjectId`) REFERENCES `Subjects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`yearGroupId`) REFERENCES `YearGroups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `SubjectYearGroupPrompts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `subjectId` int(11) DEFAULT NULL,
  `yearGroupId` int(11) DEFAULT NULL,
  `promptPart` text NOT NULL,
  PRIMARY KEY (`id`),
  KEY `subjectId` (`subjectId`),
  KEY `yearGroupId` (`yearGroupId`),
  CONSTRAINT `SubjectYearGroupPrompts_ibfk_1` FOREIGN KEY (`subjectId`) REFERENCES `Subjects` (`id`),
  CONSTRAINT `SubjectYearGroupPrompts_ibfk_2` FOREIGN KEY (`yearGroupId`) REFERENCES `YearGroups` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
