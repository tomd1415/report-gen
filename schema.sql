-- MariaDB dump 10.19  Distrib 10.11.6-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: comment_bank
-- ------------------------------------------------------
-- Server version	10.11.6-MariaDB-0+deb12u1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `Categories`
--

DROP TABLE IF EXISTS `Categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Categories`
--

LOCK TABLES `Categories` WRITE;
/*!40000 ALTER TABLE `Categories` DISABLE KEYS */;
INSERT INTO `Categories` VALUES
(1,'Programming'),
(2,'Test ');
/*!40000 ALTER TABLE `Categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `CategorySubjectYearGroups`
--

DROP TABLE IF EXISTS `CategorySubjectYearGroups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `CategorySubjectYearGroups` (
  `categoryId` int(11) NOT NULL,
  `subjectId` int(11) NOT NULL,
  `yearGroupId` int(11) NOT NULL,
  PRIMARY KEY (`categoryId`,`subjectId`,`yearGroupId`),
  UNIQUE KEY `CategorySubjectYearGroups_yearGroupId_categoryId_unique` (`categoryId`,`yearGroupId`),
  UNIQUE KEY `CategorySubjectYearGroups_subjectId_categoryId_unique` (`subjectId`),
  KEY `yearGroupId` (`yearGroupId`),
  CONSTRAINT `CategorySubjectYearGroups_ibfk_1` FOREIGN KEY (`categoryId`) REFERENCES `Categories` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CategorySubjectYearGroups_ibfk_2` FOREIGN KEY (`subjectId`) REFERENCES `Subjects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CategorySubjectYearGroups_ibfk_3` FOREIGN KEY (`yearGroupId`) REFERENCES `YearGroups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `CategorySubjectYearGroups`
--

LOCK TABLES `CategorySubjectYearGroups` WRITE;
/*!40000 ALTER TABLE `CategorySubjectYearGroups` DISABLE KEYS */;
INSERT INTO `CategorySubjectYearGroups` VALUES
(1,1,1);
/*!40000 ALTER TABLE `CategorySubjectYearGroups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `CommentSubjects`
--

DROP TABLE IF EXISTS `CommentSubjects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `CommentSubjects` (
  `commentId` int(11) NOT NULL,
  `subjectId` int(11) NOT NULL,
  PRIMARY KEY (`commentId`,`subjectId`),
  UNIQUE KEY `CommentSubjects_subjectId_commentId_unique` (`commentId`,`subjectId`),
  KEY `subjectId` (`subjectId`),
  CONSTRAINT `CommentSubjects_ibfk_1` FOREIGN KEY (`commentId`) REFERENCES `Comments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CommentSubjects_ibfk_2` FOREIGN KEY (`subjectId`) REFERENCES `Subjects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `CommentSubjects`
--

LOCK TABLES `CommentSubjects` WRITE;
/*!40000 ALTER TABLE `CommentSubjects` DISABLE KEYS */;
/*!40000 ALTER TABLE `CommentSubjects` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `CommentYearGroups`
--

DROP TABLE IF EXISTS `CommentYearGroups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `CommentYearGroups` (
  `commentId` int(11) NOT NULL,
  `yearGroupId` int(11) NOT NULL,
  PRIMARY KEY (`commentId`,`yearGroupId`),
  UNIQUE KEY `CommentYearGroups_yearGroupId_commentId_unique` (`commentId`,`yearGroupId`),
  KEY `yearGroupId` (`yearGroupId`),
  CONSTRAINT `CommentYearGroups_ibfk_1` FOREIGN KEY (`commentId`) REFERENCES `Comments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CommentYearGroups_ibfk_2` FOREIGN KEY (`yearGroupId`) REFERENCES `YearGroups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `CommentYearGroups`
--

LOCK TABLES `CommentYearGroups` WRITE;
/*!40000 ALTER TABLE `CommentYearGroups` DISABLE KEYS */;
/*!40000 ALTER TABLE `CommentYearGroups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Comments`
--

DROP TABLE IF EXISTS `Comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Comments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `text` text NOT NULL,
  `categoryId` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `categoryId` (`categoryId`),
  CONSTRAINT `Comments_ibfk_1` FOREIGN KEY (`categoryId`) REFERENCES `Categories` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Comments`
--

LOCK TABLES `Comments` WRITE;
/*!40000 ALTER TABLE `Comments` DISABLE KEYS */;
/*!40000 ALTER TABLE `Comments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `SubjectYearGroupPrompts`
--

DROP TABLE IF EXISTS `SubjectYearGroupPrompts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `SubjectYearGroupPrompts`
--

LOCK TABLES `SubjectYearGroupPrompts` WRITE;
/*!40000 ALTER TABLE `SubjectYearGroupPrompts` DISABLE KEYS */;
/*!40000 ALTER TABLE `SubjectYearGroupPrompts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Subjects`
--

DROP TABLE IF EXISTS `Subjects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Subjects` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Subjects`
--

LOCK TABLES `Subjects` WRITE;
/*!40000 ALTER TABLE `Subjects` DISABLE KEYS */;
INSERT INTO `Subjects` VALUES
(1,'Computing');
/*!40000 ALTER TABLE `Subjects` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `YearGroups`
--

DROP TABLE IF EXISTS `YearGroups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `YearGroups` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `YearGroups`
--

LOCK TABLES `YearGroups` WRITE;
/*!40000 ALTER TABLE `YearGroups` DISABLE KEYS */;
INSERT INTO `YearGroups` VALUES
(1,'Year 10');
/*!40000 ALTER TABLE `YearGroups` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2024-05-25 16:40:08
