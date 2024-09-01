-- MariaDB dump 10.19  Distrib 10.11.6-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: 127.0.0.1    Database: comment_bank
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
  `subjectId` int(11) NOT NULL,
  `yearGroupId` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `subjectId` (`subjectId`),
  KEY `yearGroupId` (`yearGroupId`),
  KEY `userId` (`userId`),
  CONSTRAINT `Categories_ibfk_1` FOREIGN KEY (`subjectId`) REFERENCES `Subjects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Categories_ibfk_2` FOREIGN KEY (`yearGroupId`) REFERENCES `YearGroups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Categories_ibfk_3` FOREIGN KEY (`userId`) REFERENCES `Users` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Categories`
--

LOCK TABLES `Categories` WRITE;
/*!40000 ALTER TABLE `Categories` DISABLE KEYS */;
INSERT INTO `Categories` VALUES
(1,'Attitude and Focus',3,7,1,'2024-06-30 16:45:54','2024-06-30 16:45:54'),
(2,'Programming Skills',3,7,1,'2024-06-30 16:45:54','2024-06-30 16:45:54'),
(3,'Interest and Engagement',3,8,1,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(4,'Programming Skills',3,8,1,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(5,'Theory Understanding',3,8,1,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(6,'Creativity and Desktop Publishing',3,8,1,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(7,'Group Work and Collaboration',3,8,1,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(8,'Confidence and Participation',3,8,1,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(9,'Perseverance and Dedication',3,8,1,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(10,'Targets',3,8,1,'2024-06-30 19:53:32','2024-06-30 19:53:32');
/*!40000 ALTER TABLE `Categories` ENABLE KEYS */;
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
  `categoryId` int(11) NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `categoryId` (`categoryId`),
  CONSTRAINT `Comments_ibfk_1` FOREIGN KEY (`categoryId`) REFERENCES `Categories` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=79 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Comments`
--

LOCK TABLES `Comments` WRITE;
/*!40000 ALTER TABLE `Comments` DISABLE KEYS */;
INSERT INTO `Comments` VALUES
(1,'Occasionally finds it challenging when something goes wrong with the computer but re-engages quickly with guidance.',1,'2024-06-30 16:45:54','2024-06-30 16:45:54'),
(2,'Brings a positive attitude to the start of lessons but sometimes needs encouragement to stay focused.',1,'2024-06-30 16:45:54','2024-06-30 16:45:54'),
(3,'Consistently arrives with a positive attitude and is eager to start work right away.',1,'2024-06-30 16:45:54','2024-06-30 16:45:54'),
(4,'Keen to start lessons quickly and works well with others in group settings.',1,'2024-06-30 16:45:54','2024-06-30 16:45:54'),
(5,'Shows a quiet enthusiasm and is ready to begin work promptly.',1,'2024-06-30 16:45:54','2024-06-30 16:45:54'),
(6,'Demonstrates a confident and energetic approach to lessons.',1,'2024-06-30 16:45:54','2024-06-30 16:45:54'),
(7,'Finds programming tasks particularly challenging and needs considerable support.',2,'2024-06-30 16:45:54','2024-06-30 16:45:54'),
(8,'Shows a good understanding of basic programming concepts but requires encouragement to apply them.',2,'2024-06-30 16:45:54','2024-06-30 16:45:54'),
(9,'Has made some progress with basic code but struggles with more advanced concepts.',2,'2024-06-30 16:45:54','2024-06-30 16:45:54'),
(10,'Demonstrates a solid understanding of key programming concepts like sequencing, selection, and iteration.',2,'2024-06-30 16:45:54','2024-06-30 16:45:54'),
(11,'Enjoys programming lessons more than theory-based ones and has created imaginative programs.',2,'2024-06-30 16:45:54','2024-06-30 16:45:54'),
(12,'Has improved in experimenting with code and learning from previous efforts.',2,'2024-06-30 16:45:54','2024-06-30 16:45:54'),
(13,'Excels in programming, showing creativity and proficiency in coding.',2,'2024-06-30 16:45:54','2024-06-30 16:45:54'),
(14,'Demonstrates strong aptitude and creativity in programming projects.',2,'2024-06-30 16:45:54','2024-06-30 16:45:54'),
(15,'\n                                            \n                                            \n                                            \n                                            Shows initial enthusiasm but struggles to maintain focus, especially in theory lesson.\n                                        \n                                        \n                                        \n                                        ',3,'2024-06-30 19:53:32','2024-06-30 22:40:45'),
(16,'\n                                            \n                                            \n                                            Disappointed when lessons do not involve preferred activities like Minecraft and similar.\n                                        \n                                        \n                                        ',3,'2024-06-30 19:53:32','2024-06-30 22:41:03'),
(17,'Keen to start lessons and occasionally disrupts whole class teaching to begin tasks.',3,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(18,'Brings a positive attitude to lessons but sometimes underestimates abilities.',3,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(19,'Shows quiet enthusiasm and is eager to begin work promptly.',3,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(20,'\n                                            Confident and energetic approach, though occasionally struggles to maintain focus.\n                                        ',3,'2024-06-30 19:53:32','2024-06-30 22:57:55'),
(21,'Shows interest in specific areas of computing but lacks interest in others.',3,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(22,'Demonstrates a clear preference for programming over theory-based lessons.',3,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(23,'Struggles with applying correct programming concepts even with support.',4,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(24,'Finds programming lessons challenging and needs considerable support.',4,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(25,'Shows some improvement in understanding basic programming concepts.',4,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(26,'Demonstrates a solid understanding of basic programming concepts with encouragement.',4,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(27,'Has made progress in programming, particularly in practical applications like controlling a robot.',4,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(28,'Shows creativity and proficiency in programming, often experimenting with ideas.',4,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(29,'Excels in programming, demonstrating a strong understanding of coding concepts.',4,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(30,'Shows exceptional skill and creativity in programming, completing projects independently.',4,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(31,'Struggles with theory-based lessons and needs extra support.',5,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(32,'Finds theory concepts challenging but can understand with guidance.',5,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(33,'Shows understanding of core concepts like input and output peripherals with support.',5,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(34,'Demonstrates a solid understanding of computer networks and technology\'s impact on society.',5,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(35,'Shows a good understanding of networks and societal impacts of technology.',5,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(36,'Engages in insightful discussions about technology and networks.',5,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(37,'Demonstrates strong grasp of theory and contributes confidently in discussions.',5,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(38,'Balances proficiency in both programming and theory-based lessons effectively.',5,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(39,'Shows creativity and skill in desktop publishing tasks.',6,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(40,'Enjoys creating imaginative posters using desktop publishing software.',6,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(41,'Demonstrates growing proficiency and creativity in desktop publishing.',6,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(42,'Shows remarkable improvement and creativity in desktop publishing.',6,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(43,'Struggles with desktop publishing but shows willingness to improve.',6,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(44,'Demonstrates competence in using desktop publishing applications effectively.',6,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(45,'Shows exceptional skill and creativity in desktop publishing tasks.',6,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(46,'Balances creativity with technical skills in desktop publishing effectively.',6,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(47,'Struggles to maintain focus in group settings without support.',7,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(48,'Works well with others, contributing positively to team efforts.',7,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(49,'Keen to help others with computer issues during lessons.',7,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(50,'Quiet and reserved but listens attentively and contributes when comfortable.',7,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(51,'Starts to contribute more during group work, showing willingness to collaborate.',7,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(52,'Excels in leading group work, demonstrating leadership and collaborative spirit.',7,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(53,'Attends computing club, showcasing inquisitiveness and determination.',7,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(54,'Demonstrates strong leadership and collaboration skills in group settings.',7,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(55,'Quiet and reserved but gradually gaining confidence.',8,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(56,'Often quiet during discussions but asks insightful questions.',8,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(57,'Starts to answer more questions in front of the class, showing growing confidence.',8,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(58,'Consistently participates in whole class discussions with insightful points.',8,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(59,'Confident and keen to share knowledge with the class.',8,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(60,'Shows a preference for programming, demonstrating confidence and creativity.',8,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(61,'Confidently delivers discussions on technology\'s impact on society.',8,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(62,'Demonstrates significant improvement in confidence and participation.',8,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(63,'Struggles to stay focused but shows perseverance with support.',9,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(64,'Demonstrates resilience when using challenging technology like eye trackers.',9,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(65,'Shows determination to complete tasks, even when finding them difficult.',9,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(66,'Perseveres with programming, improving steadily over time.',9,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(67,'Shows willingness to experiment with code and learn from past attempts.',9,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(68,'Demonstrates commendable perseverance and dedication in all areas.',9,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(69,'Balances creativity with technical skills, showcasing persistence.',9,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(70,'Shows outstanding perseverance and dedication, excelling in all areas.',9,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(71,'Improve focus during theory lessons by breaking tasks into smaller segments.',10,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(72,'Apply programming concepts more effectively with guided practice.',10,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(73,'Enhance understanding of theory concepts through regular revision.',10,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(74,'Develop more confidence in group settings and contribute ideas.',10,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(75,'Continue to build creativity and proficiency in desktop publishing tasks.',10,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(76,'Experiment with new programming ideas and learn from mistakes.',10,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(77,'Balance interest in specific computing areas with broader subject engagement.',10,'2024-06-30 19:53:32','2024-06-30 19:53:32'),
(78,'***Generate a target for this pupil and add to the report***',10,'2024-06-30 19:53:32','2024-06-30 19:53:32');
/*!40000 ALTER TABLE `Comments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Prompts`
--

DROP TABLE IF EXISTS `Prompts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Prompts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `subjectId` int(11) NOT NULL,
  `yearGroupId` int(11) NOT NULL,
  `userId` int(11) NOT NULL,
  `promptPart` text NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `subjectId` (`subjectId`),
  KEY `yearGroupId` (`yearGroupId`),
  KEY `userId` (`userId`),
  CONSTRAINT `Prompts_ibfk_1` FOREIGN KEY (`subjectId`) REFERENCES `Subjects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Prompts_ibfk_2` FOREIGN KEY (`yearGroupId`) REFERENCES `YearGroups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Prompts_ibfk_3` FOREIGN KEY (`userId`) REFERENCES `Users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Prompts`
--

LOCK TABLES `Prompts` WRITE;
/*!40000 ALTER TABLE `Prompts` DISABLE KEYS */;
INSERT INTO `Prompts` VALUES
(1,3,5,1,'Generate a detailed and concise school report for the pupil, who is in Year 5 Computing lessons. The tone of the report should be friendly yet formal. The report should be between 100 and 170 words and should flow smoothly without any repetition.\n\nBelow are categories and comments to base the report on. Each comment should be integrated seamlessly into the report without explicit headings. The report can be organized into up to three paragraphs, ensuring that each paragraph addresses different aspects of the pupil\'s performance and behaviour.\n\nMake sure to highlight the pupil\'s strengths, areas for improvement, and any notable achievements. If applicable, provide specific examples or incidents that illustrate these points. Conclude with a positive outlook on the pupil\'s potential and future progress in Computing.','2024-06-30 18:05:40','2024-06-30 18:05:54');
/*!40000 ALTER TABLE `Prompts` ENABLE KEYS */;
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
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Subjects`
--

LOCK TABLES `Subjects` WRITE;
/*!40000 ALTER TABLE `Subjects` DISABLE KEYS */;
INSERT INTO `Subjects` VALUES
(1,'Art','2024-06-30 16:45:54','2024-06-30 16:45:54'),
(2,'Citizenship','2024-06-30 16:45:54','2024-06-30 16:45:54'),
(3,'Computing','2024-06-30 16:45:54','2024-06-30 16:45:54'),
(4,'English','2024-06-30 16:45:54','2024-06-30 16:45:54'),
(5,'Food Technology','2024-06-30 16:45:54','2024-06-30 16:45:54'),
(6,'French','2024-06-30 16:45:54','2024-06-30 16:45:54'),
(7,'Geography','2024-06-30 16:45:54','2024-06-30 16:45:54'),
(8,'History','2024-06-30 16:45:54','2024-06-30 16:45:54'),
(9,'Mathematics','2024-06-30 16:45:54','2024-06-30 16:45:54'),
(10,'PSHE&C','2024-06-30 16:45:54','2024-06-30 16:45:54'),
(11,'Physical Education','2024-06-30 16:45:54','2024-06-30 16:45:54'),
(12,'Registration','2024-06-30 16:45:54','2024-06-30 16:45:54'),
(13,'Religious Education','2024-06-30 16:45:54','2024-06-30 16:45:54'),
(14,'Science','2024-06-30 16:45:54','2024-06-30 16:45:54'),
(15,'Swimming','2024-06-30 16:45:54','2024-06-30 16:45:54'),
(16,'Technology','2024-06-30 16:45:54','2024-06-30 16:45:54');
/*!40000 ALTER TABLE `Subjects` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `UserSubjects`
--

DROP TABLE IF EXISTS `UserSubjects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `UserSubjects` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `subjectId` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UserSubjects_subjectId_userId_unique` (`userId`,`subjectId`),
  KEY `subjectId` (`subjectId`),
  CONSTRAINT `UserSubjects_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `Users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `UserSubjects_ibfk_2` FOREIGN KEY (`subjectId`) REFERENCES `Subjects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `UserSubjects`
--

LOCK TABLES `UserSubjects` WRITE;
/*!40000 ALTER TABLE `UserSubjects` DISABLE KEYS */;
INSERT INTO `UserSubjects` VALUES
(9,1,3),
(10,1,9),
(11,1,12);
/*!40000 ALTER TABLE `UserSubjects` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `UserYearGroups`
--

DROP TABLE IF EXISTS `UserYearGroups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `UserYearGroups` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `userId` int(11) NOT NULL,
  `yearGroupId` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UserYearGroups_yearGroupId_userId_unique` (`userId`,`yearGroupId`),
  KEY `yearGroupId` (`yearGroupId`),
  CONSTRAINT `UserYearGroups_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `Users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `UserYearGroups_ibfk_2` FOREIGN KEY (`yearGroupId`) REFERENCES `YearGroups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `UserYearGroups`
--

LOCK TABLES `UserYearGroups` WRITE;
/*!40000 ALTER TABLE `UserYearGroups` DISABLE KEYS */;
INSERT INTO `UserYearGroups` VALUES
(8,1,7),
(9,1,8),
(10,1,9),
(11,1,10);
/*!40000 ALTER TABLE `UserYearGroups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Users`
--

DROP TABLE IF EXISTS `Users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `Users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `isAdmin` tinyint(1) DEFAULT 0,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Users`
--

LOCK TABLES `Users` WRITE;
/*!40000 ALTER TABLE `Users` DISABLE KEYS */;
INSERT INTO `Users` VALUES
(1,'testuser','$2b$10$0IGpKxQVfaLnPJwlKaCis.eIKIprEK1bClqhsZqEe8Ed1BpZqGszW',1,'2024-06-30 16:45:54','2024-06-30 16:45:54'),
(2,'duguid','$2b$10$CO9S1XZUuEigTUaVjQv5XOkD6TIcsllls2Xz1yHYDwBPkb0pL9Ub6',1,'2024-06-30 23:07:48','2024-06-30 23:07:48'),
(3,'goode','$2b$10$Wi6/KeJ5qo/Hkl1nxbKFBuzjeMORhORI8AR/JT5hTpjuPOoWY4Hni',0,'2024-06-30 23:08:39','2024-06-30 23:08:39');
/*!40000 ALTER TABLE `Users` ENABLE KEYS */;
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
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `YearGroups`
--

LOCK TABLES `YearGroups` WRITE;
/*!40000 ALTER TABLE `YearGroups` DISABLE KEYS */;
INSERT INTO `YearGroups` VALUES
(1,'Year 1','2024-06-30 16:45:54','2024-06-30 16:45:54'),
(2,'Year 2','2024-06-30 16:45:54','2024-06-30 16:45:54'),
(3,'Year 3','2024-06-30 16:45:54','2024-06-30 16:45:54'),
(4,'Year 4','2024-06-30 16:45:54','2024-06-30 16:45:54'),
(5,'Year 5','2024-06-30 16:45:54','2024-06-30 16:45:54'),
(6,'Year 6','2024-06-30 16:45:54','2024-06-30 16:45:54'),
(7,'Year 7','2024-06-30 16:45:54','2024-06-30 16:45:54'),
(8,'Year 8','2024-06-30 16:45:54','2024-06-30 16:45:54'),
(9,'Year 9','2024-06-30 16:45:54','2024-06-30 16:45:54'),
(10,'Year 10','2024-06-30 16:45:54','2024-06-30 16:45:54'),
(11,'Year 11','2024-06-30 16:45:54','2024-06-30 16:45:54'),
(12,'Year 12','2024-06-30 16:45:54','2024-06-30 16:45:54'),
(13,'Year 13','2024-06-30 16:45:54','2024-06-30 16:45:54'),
(14,'Year 14','2024-06-30 16:45:54','2024-06-30 16:45:54');
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

-- Dump completed on 2024-06-30 23:09:12
