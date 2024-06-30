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
(1,'Attitude and Focus',3,7,1,'2024-06-09 15:30:47','2024-06-09 15:30:47'),
(2,'Programming Skills',3,7,1,'2024-06-09 15:30:47','2024-06-09 15:30:47'),
(3,'Interest and Engagement',3,8,1,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(4,'Programming Skills',3,8,1,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(5,'Theory Understanding',3,8,1,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(6,'Creativity and Desktop Publishing',3,8,1,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(7,'Group Work and Collaboration',3,8,1,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(8,'Confidence and Participation',3,8,1,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(9,'Perseverance and Dedication',3,8,1,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(10,'Targets',3,8,1,'2024-06-09 19:06:00','2024-06-09 19:06:00');
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
(1,'Occasionally finds it challenging when something goes wrong with the computer but re-engages quickly with guidance.',1,'2024-06-09 15:30:47','2024-06-09 15:30:47'),
(2,'Brings a positive attitude to the start of lessons but sometimes needs encouragement to stay focused.',1,'2024-06-09 15:30:47','2024-06-09 15:30:47'),
(3,'Consistently arrives with a positive attitude and is eager to start work right away.',1,'2024-06-09 15:30:47','2024-06-09 15:30:47'),
(4,'Keen to start lessons quickly and works well with others in group settings.',1,'2024-06-09 15:30:47','2024-06-09 15:30:47'),
(5,'Shows a quiet enthusiasm and is ready to begin work promptly.',1,'2024-06-09 15:30:47','2024-06-09 15:30:47'),
(6,'Demonstrates a confident and energetic approach to lessons.',1,'2024-06-09 15:30:47','2024-06-09 15:30:47'),
(7,'Finds programming tasks particularly challenging and needs considerable support.',2,'2024-06-09 15:30:47','2024-06-09 15:30:47'),
(8,'Shows a good understanding of basic programming concepts but requires encouragement to apply them.',2,'2024-06-09 15:30:47','2024-06-09 15:30:47'),
(9,'Has made some progress with basic code but struggles with more advanced concepts.',2,'2024-06-09 15:30:47','2024-06-09 15:30:47'),
(10,'Demonstrates a solid understanding of key programming concepts like sequencing, selection, and iteration.',2,'2024-06-09 15:30:47','2024-06-09 15:30:47'),
(11,'Enjoys programming lessons more than theory-based ones and has created imaginative programs.',2,'2024-06-09 15:30:47','2024-06-09 15:30:47'),
(12,'Has improved in experimenting with code and learning from previous efforts.',2,'2024-06-09 15:30:47','2024-06-09 15:30:47'),
(13,'Excels in programming, showing creativity and proficiency in coding.',2,'2024-06-09 15:30:47','2024-06-09 15:30:47'),
(14,'Demonstrates strong aptitude and creativity in programming projects.',2,'2024-06-09 15:30:47','2024-06-09 15:30:47'),
(15,'Shows initial enthusiasm but struggles to maintain focus, especially in theory lessons.',3,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(16,'Disappointed when lessons do not involve preferred activities like Minecraft and similar.',3,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(17,'Keen to start lessons and occasionally disrupts whole class teaching to begin tasks.',3,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(18,'Brings a positive attitude to lessons but sometimes underestimates abilities.',3,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(19,'Shows quiet enthusiasm and is eager to begin work promptly.',3,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(20,'Confident and energetic approach, though occasionally struggles to maintain focus.',3,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(21,'Shows interest in specific areas of computing but lacks interest in others.',3,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(22,'Demonstrates a clear preference for programming over theory-based lessons.',3,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(23,'Struggles with applying correct programming concepts even with support.',4,'2024-06-09 19:06:00','2024-06-09 19:10:14'),
(24,'Finds programming lessons challenging and needs considerable support.',4,'2024-06-09 19:06:00','2024-06-09 19:09:48'),
(25,'Shows some improvement in understanding basic programming concepts.',4,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(26,'Demonstrates a solid understanding of basic programming concepts with encouragement.',4,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(27,'Has made progress in programming, particularly in practical applications like controlling a robot.',4,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(28,'Shows creativity and proficiency in programming, often experimenting with ideas.',4,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(29,'Excels in programming, demonstrating a strong understanding of coding concepts.',4,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(30,'Shows exceptional skill and creativity in programming, completing projects independently.',4,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(31,'Struggles with theory-based lessons and needs extra support.',5,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(32,'Finds theory concepts challenging but can understand with guidance.',5,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(33,'Shows understanding of core concepts like input and output peripherals with support.',5,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(34,'Demonstrates a solid understanding of computer networks and technology\'s impact on society.',5,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(35,'Shows a good understanding of networks and societal impacts of technology.',5,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(36,'Engages in insightful discussions about technology and networks.',5,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(37,'Demonstrates strong grasp of theory and contributes confidently in discussions.',5,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(38,'Balances proficiency in both programming and theory-based lessons effectively.',5,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(39,'Shows creativity and skill in desktop publishing tasks.',6,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(40,'Enjoys creating imaginative posters using desktop publishing software.',6,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(41,'Demonstrates growing proficiency and creativity in desktop publishing.',6,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(42,'Shows remarkable improvement and creativity in desktop publishing.',6,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(43,'Struggles with desktop publishing but shows willingness to improve.',6,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(44,'Demonstrates competence in using desktop publishing applications effectively.',6,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(45,'Shows exceptional skill and creativity in desktop publishing tasks.',6,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(46,'Balances creativity with technical skills in desktop publishing effectively.',6,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(47,'Struggles to maintain focus in group settings without support.',7,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(48,'Works well with others, contributing positively to team efforts.',7,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(49,'Keen to help others with computer issues during lessons.',7,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(50,'Quiet and reserved but listens attentively and contributes when comfortable.',7,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(51,'Starts to contribute more during group work, showing willingness to collaborate.',7,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(52,'Excels in leading group work, demonstrating leadership and collaborative spirit.',7,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(53,'Attends computing club, showcasing inquisitiveness and determination.',7,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(54,'Demonstrates strong leadership and collaboration skills in group settings.',7,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(55,'Quiet and reserved but gradually gaining confidence.',8,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(56,'Often quiet during discussions but asks insightful questions.',8,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(57,'Starts to answer more questions in front of the class, showing growing confidence.',8,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(58,'Consistently participates in whole class discussions with insightful points.',8,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(59,'Confident and keen to share knowledge with the class.',8,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(60,'Shows a preference for programming, demonstrating confidence and creativity.',8,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(61,'Confidently delivers discussions on technology\'s impact on society.',8,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(62,'Demonstrates significant improvement in confidence and participation.',8,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(63,'Struggles to stay focused but shows perseverance with support.',9,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(64,'Demonstrates resilience when using challenging technology like eye trackers.',9,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(65,'Shows determination to complete tasks, even when finding them difficult.',9,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(66,'Perseveres with programming, improving steadily over time.',9,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(67,'Shows willingness to experiment with code and learn from past attempts.',9,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(68,'Demonstrates commendable perseverance and dedication in all areas.',9,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(69,'Balances creativity with technical skills, showcasing persistence.',9,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(70,'Shows outstanding perseverance and dedication, excelling in all areas.',9,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(71,'Improve focus during theory lessons by breaking tasks into smaller segments.',10,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(72,'Apply programming concepts more effectively with guided practice.',10,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(73,'Enhance understanding of theory concepts through regular revision.',10,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(74,'Develop more confidence in group settings and contribute ideas.',10,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(75,'Continue to build creativity and proficiency in desktop publishing tasks.',10,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(76,'Experiment with new programming ideas and learn from mistakes.',10,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(77,'Balance interest in specific computing areas with broader subject engagement.',10,'2024-06-09 19:06:00','2024-06-09 19:06:00'),
(78,'***Generate a target for this pupil and add to the report***',10,'2024-06-09 19:06:00','2024-06-09 19:06:00');
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
  `promptPart` text NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `subjectId` (`subjectId`),
  KEY `yearGroupId` (`yearGroupId`),
  CONSTRAINT `Prompts_ibfk_1` FOREIGN KEY (`subjectId`) REFERENCES `Subjects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Prompts_ibfk_2` FOREIGN KEY (`yearGroupId`) REFERENCES `YearGroups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Prompts`
--

LOCK TABLES `Prompts` WRITE;
/*!40000 ALTER TABLE `Prompts` DISABLE KEYS */;
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
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Subjects`
--

LOCK TABLES `Subjects` WRITE;
/*!40000 ALTER TABLE `Subjects` DISABLE KEYS */;
INSERT INTO `Subjects` VALUES
(1,'Art','2024-06-09 15:30:47','2024-06-09 15:30:47'),
(2,'Citizenship','2024-06-09 15:30:47','2024-06-09 15:30:47'),
(3,'Computing','2024-06-09 15:30:47','2024-06-09 15:30:47'),
(4,'English','2024-06-09 15:30:47','2024-06-09 15:30:47'),
(5,'Food Technology','2024-06-09 15:30:47','2024-06-09 15:30:47'),
(6,'French','2024-06-09 15:30:47','2024-06-09 15:30:47'),
(7,'Geography','2024-06-09 15:30:47','2024-06-09 15:30:47'),
(8,'History','2024-06-09 15:30:47','2024-06-09 15:30:47'),
(9,'Mathematics','2024-06-09 15:30:47','2024-06-09 15:30:47'),
(10,'PSHE&C','2024-06-09 15:30:47','2024-06-09 15:30:47'),
(11,'Physical Education','2024-06-09 15:30:47','2024-06-09 15:30:47'),
(12,'Registration','2024-06-09 15:30:47','2024-06-09 15:30:47'),
(13,'Religious Education','2024-06-09 15:30:47','2024-06-09 15:30:47'),
(14,'Science','2024-06-09 15:30:47','2024-06-09 15:30:47'),
(15,'Swimming','2024-06-09 15:30:47','2024-06-09 15:30:47'),
(16,'Technology','2024-06-09 15:30:47','2024-06-09 15:30:47');
/*!40000 ALTER TABLE `Subjects` ENABLE KEYS */;
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
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Users`
--

LOCK TABLES `Users` WRITE;
/*!40000 ALTER TABLE `Users` DISABLE KEYS */;
INSERT INTO `Users` VALUES
(1,'testuser','$2b$10$JbR/VutF2utEyBUeCUsn4eprJAJgZsFK9vCNvHoELYR3dEPCcfkLS',1,'2024-06-09 15:30:47','2024-06-09 15:30:47'),
(2,'test2','$2b$10$9gUkzQ5FGRlExsCZkLAR3OlBB3aGKiHtUI6KpQPtChC0PMNlET0mG',0,'2024-06-09 15:32:49','2024-06-09 15:32:49'),
(3,'duguid','$2b$10$BcSTnxFJkof.UjMIj2b0.ej/f.bpuS0BLpgw3bvHWJdCX6EIjdJGy',1,'2024-06-09 19:37:50','2024-06-09 19:37:50');
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
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `YearGroups`
--

LOCK TABLES `YearGroups` WRITE;
/*!40000 ALTER TABLE `YearGroups` DISABLE KEYS */;
INSERT INTO `YearGroups` VALUES
(1,'Year 1','2024-06-09 15:30:47','2024-06-09 15:30:47'),
(2,'Year 2','2024-06-09 15:30:47','2024-06-09 15:30:47'),
(3,'Year 3','2024-06-09 15:30:47','2024-06-09 15:30:47'),
(4,'Year 4','2024-06-09 15:30:47','2024-06-09 15:30:47'),
(5,'Year 5','2024-06-09 15:30:47','2024-06-09 15:30:47'),
(6,'Year 6','2024-06-09 15:30:47','2024-06-09 15:30:47'),
(7,'Year 7','2024-06-09 15:30:47','2024-06-09 15:30:47'),
(8,'Year 8','2024-06-09 15:30:47','2024-06-09 15:30:47'),
(9,'Year 9','2024-06-09 15:30:47','2024-06-09 15:30:47'),
(10,'Year 10','2024-06-09 15:30:47','2024-06-09 15:30:47'),
(11,'Year 11','2024-06-09 15:30:47','2024-06-09 15:30:47'),
(12,'Year 12','2024-06-09 15:30:47','2024-06-09 15:30:47'),
(13,'Year 13','2024-06-09 15:30:47','2024-06-09 15:30:47'),
(14,'Year 14','2024-06-09 15:30:47','2024-06-09 15:30:47');
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

-- Dump completed on 2024-06-09 21:22:12
