BEGIN TRANSACTION;
CREATE TABLE Category (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subject_id INTEGER,
    year_group_id INTEGER,
    FOREIGN KEY (subject_id) REFERENCES Subject(id),
    FOREIGN KEY (year_group_id) REFERENCES YearGroup(id)
);
INSERT INTO "Category" VALUES(1,'Attitude and Focus',1,1);
INSERT INTO "Category" VALUES(2,'Programming Skills',1,1);
INSERT INTO "Category" VALUES(3,'Theory-Based Learning',1,1);
INSERT INTO "Category" VALUES(4,'Desktop Publishing Skills',1,1);
INSERT INTO "Category" VALUES(5,'Confidence and Participation',1,1);
INSERT INTO "Category" VALUES(6,'Independent Work and Perseverance',1,1);
INSERT INTO "Category" VALUES(7,'Creativity and Imagination',1,1);
INSERT INTO "Category" VALUES(8,'Targets',1,1);
CREATE TABLE Comment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    category_id INTEGER,
    FOREIGN KEY (category_id) REFERENCES Category(id)
);
INSERT INTO "Comment" VALUES(1,'Occasionally finds it challenging when something goes wrong with the computer but re-engages quickly with guidance.',1);
INSERT INTO "Comment" VALUES(2,'Brings a positive attitude to the start of lessons but sometimes needs encouragement to stay focused.',1);
INSERT INTO "Comment" VALUES(3,'Consistently arrives with a positive attitude and is eager to start work right away.',1);
INSERT INTO "Comment" VALUES(4,'Keen to start lessons quickly and works well with others in group settings.',1);
INSERT INTO "Comment" VALUES(5,'Shows a quiet enthusiasm and is ready to begin work promptly.',1);
INSERT INTO "Comment" VALUES(6,'Demonstrates a confident and energetic approach to lessons.',1);
INSERT INTO "Comment" VALUES(7,'Finds programming tasks particularly challenging and needs considerable support.',2);
INSERT INTO "Comment" VALUES(8,'Shows a good understanding of basic programming concepts but requires encouragement to apply them.',2);
INSERT INTO "Comment" VALUES(9,'Has made some progress with basic code but struggles with more advanced concepts.',2);
INSERT INTO "Comment" VALUES(10,'Demonstrates a solid understanding of key programming concepts like sequencing, selection, and iteration.',2);
INSERT INTO "Comment" VALUES(11,'Enjoys programming lessons more than theory-based ones and has created imaginative programs.',2);
INSERT INTO "Comment" VALUES(12,'Has improved in experimenting with code and learning from previous efforts.',2);
INSERT INTO "Comment" VALUES(13,'Excels in programming, showing creativity and proficiency in coding.',2);
INSERT INTO "Comment" VALUES(14,'Demonstrates strong aptitude and creativity in programming projects.',2);
INSERT INTO "Comment" VALUES(15,'Finds theory-based lessons challenging and requires extra assistance.',3);
INSERT INTO "Comment" VALUES(16,'Needs more time to grasp theory concepts but is willing to persevere.',3);
INSERT INTO "Comment" VALUES(17,'Struggles to concentrate in theory lessons and needs support to engage.',3);
INSERT INTO "Comment" VALUES(18,'Performs better in theory-based work than in programming.',3);
INSERT INTO "Comment" VALUES(19,'Shows a good understanding of networks and the impact of technology on society.',3);
INSERT INTO "Comment" VALUES(20,'Demonstrates a solid grasp of theory concepts and participates in discussions.',3);
INSERT INTO "Comment" VALUES(21,'Has insightful discussions on technology''s impact on society.',3);
INSERT INTO "Comment" VALUES(22,'Excels in theory lessons, showing a thorough understanding of the material.',3);
INSERT INTO "Comment" VALUES(23,'Shows good skill and creativity in desktop publishing tasks.',4);
INSERT INTO "Comment" VALUES(24,'Demonstrates competence in using desktop publishing applications.',4);
INSERT INTO "Comment" VALUES(25,'Has created imaginative and beautiful posters using desktop publishing software.',4);
INSERT INTO "Comment" VALUES(26,'Demonstrates growing proficiency and creativity in desktop publishing.',4);
INSERT INTO "Comment" VALUES(27,'Uses desktop publishing software effectively for creative tasks.',4);
INSERT INTO "Comment" VALUES(28,'Excels in graphic design and has created impressive work using desktop publishing software.',4);
INSERT INTO "Comment" VALUES(29,'Shows remarkable improvement in desktop publishing work.',4);
INSERT INTO "Comment" VALUES(30,'Demonstrates high skill and creativity in using desktop publishing tools.',4);
INSERT INTO "Comment" VALUES(31,'Gradually improving confidence and starting to contribute more in group work.',5);
INSERT INTO "Comment" VALUES(32,'Shows quiet confidence but often listens attentively and takes in information.',5);
INSERT INTO "Comment" VALUES(33,'Starting to answer more questions in front of the class, showing increased confidence.',5);
INSERT INTO "Comment" VALUES(34,'Keen to take part in whole class discussions and often has insightful points.',5);
INSERT INTO "Comment" VALUES(35,'Test',5);
INSERT INTO "Comment" VALUES(36,'Often needs encouragement and support to participate in class discussions.',6);
INSERT INTO "Comment" VALUES(37,'Requires support to stay on task but makes steady progress with guidance.',6);
INSERT INTO "Comment" VALUES(38,'Needs encouragement and support to get started with independent work.',6);
INSERT INTO "Comment" VALUES(39,'Benefits from repetition and short tasks to maintain interest in theory lessons.',6);
INSERT INTO "Comment" VALUES(40,'Struggles to stay focused without support but shows perseverance.',6);
INSERT INTO "Comment" VALUES(41,'Shows dedication and resilience when dealing with programming challenges.',6);
INSERT INTO "Comment" VALUES(42,'Continues to make steady progress with gentle encouragement and support.',6);
INSERT INTO "Comment" VALUES(43,'Demonstrates perseverance and dedication, making steady progress.',6);
INSERT INTO "Comment" VALUES(44,'Consistently tries out various technologies and persists despite challenges.',6);
INSERT INTO "Comment" VALUES(45,'Occasionally struggles to apply programming concepts but shows creativity in projects.',7);
INSERT INTO "Comment" VALUES(46,'Demonstrates creativity in desktop publishing tasks despite challenges in other areas.',7);
INSERT INTO "Comment" VALUES(47,'Shows imaginative programming projects and a preference for experimentation.',7);
INSERT INTO "Comment" VALUES(48,'Demonstrates creativity and skill in desktop publishing and programming tasks.',7);
INSERT INTO "Comment" VALUES(49,'Often experiments with ideas in programming, reinforcing learning.',7);
INSERT INTO "Comment" VALUES(50,'Has created unique projects based on programming techniques.',7);
INSERT INTO "Comment" VALUES(51,'Shows a natural talent for programming and excels in this area.',7);
INSERT INTO "Comment" VALUES(52,'Continuously tries different approaches until finding a solution.',7);
INSERT INTO "Comment" VALUES(53,'Improve focus during theory lessons by breaking tasks into smaller, manageable steps.',8);
INSERT INTO "Comment" VALUES(54,'Enhance programming skills by practicing coding tasks regularly and seeking help when needed.',8);
INSERT INTO "Comment" VALUES(55,'Develop better engagement in theory lessons by participating in class discussions more actively.',8);
INSERT INTO "Comment" VALUES(56,'Improve desktop publishing skills by experimenting with new design techniques.',8);
INSERT INTO "Comment" VALUES(57,'Increase confidence in class participation by answering more questions and contributing to group work.',8);
INSERT INTO "Comment" VALUES(58,'Continue to explore creative programming projects and document the learning process.',8);
INSERT INTO "Comment" VALUES(59,'Seek additional support for challenging topics and practice applying learned concepts.',8);
INSERT INTO "Comment" VALUES(60,'***Generate a target for this pupil and add to the report***',8);
CREATE TABLE Prompt (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER,
    year_group_id INTEGER,
    prompt_part TEXT NOT NULL,
    FOREIGN KEY (subject_id) REFERENCES Subject(id),
    FOREIGN KEY (year_group_id) REFERENCES YearGroup(id)
);
INSERT INTO "Prompt" VALUES(3,1,1,'Generate a concision school report for a pupil. This is for Computing lessons and I would like it to be friendly and formal. I would like it to be between 100 and 170 words long and flow nicely with no repetition. Below are categories and comments to base the report on. There should be no headings on the report. It could have up to 3 paragraphs if necessary. Finish the report with **TEST COMPLETE**');
CREATE TABLE Subject (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
);
INSERT INTO "Subject" VALUES(1,'Computing');
INSERT INTO "Subject" VALUES(2,'Art');
INSERT INTO "Subject" VALUES(3,'Maths');
INSERT INTO "Subject" VALUES(4,'English');
CREATE TABLE YearGroup (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
);
INSERT INTO "YearGroup" VALUES(1,'Year 7');
INSERT INTO "YearGroup" VALUES(2,'Year 8');
INSERT INTO "YearGroup" VALUES(3,'Year 9');
INSERT INTO "YearGroup" VALUES(4,'Year 10');
INSERT INTO "YearGroup" VALUES(5,'Year 11');
INSERT INTO "YearGroup" VALUES(6,'Year 12');
INSERT INTO "YearGroup" VALUES(7,'Year 13');
DELETE FROM "sqlite_sequence";
INSERT INTO "sqlite_sequence" VALUES('YearGroup',14);
INSERT INTO "sqlite_sequence" VALUES('Subject',8);
INSERT INTO "sqlite_sequence" VALUES('Category',16);
INSERT INTO "sqlite_sequence" VALUES('Comment',120);
INSERT INTO "sqlite_sequence" VALUES('Prompt',3);
COMMIT;
