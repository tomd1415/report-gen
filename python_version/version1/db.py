import sqlite3
import csv

conn = sqlite3.connect('app.db')
cursor = conn.cursor()

# Create tables if they do not exist
cursor.execute('''
CREATE TABLE IF NOT EXISTS Subject (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    display INTEGER NOT NULL,
    UNIQUE(name)
)
''')

cursor.execute('''
CREATE TABLE IF NOT EXISTS YearGroup (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    display INTEGER NOT NULL,
    UNIQUE(name)
)
''')

cursor.execute('''
CREATE TABLE IF NOT EXISTS Category (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subject_id INTEGER,
    year_group_id INTEGER,
    FOREIGN KEY (subject_id) REFERENCES Subject(id),
    FOREIGN KEY (year_group_id) REFERENCES YearGroup(id)
)
''')

cursor.execute('''
CREATE TABLE IF NOT EXISTS Comment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    category_id INTEGER,
    FOREIGN KEY (category_id) REFERENCES Category(id)
)
''')

cursor.execute('''
CREATE TABLE IF NOT EXISTS Prompt (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER,
    year_group_id INTEGER,
    prompt_part TEXT NOT NULL,
    FOREIGN KEY (subject_id) REFERENCES Subject(id),
    FOREIGN KEY (year_group_id) REFERENCES YearGroup(id)
)
''')

cursor.execute('''
INSERT OR IGNORE INTO YearGroup(name, display) VALUES('Year 1', 0), ('Year 2', 0), ('Year 3', 0), ('Year 4', 0), ('Year 5', 0),('Year 6', 0), ('Year 7', 1), ('Year 8', 1), ('Year 9', 1), ('Year 10', 1), ('Year 11', 1),('Year 12', 1)
''')

cursor.execute('''
INSERT OR IGNORE INTO Subject(name, display) VALUES('Art', 1), ('Computing', 1), ('Design and Technology', 1), ('English', 1), ('French', 1),('Geography', 1),('History', 1),('Maths', 1),('Media Studies', 1)
''')

conn.commit()

def fetch_subjects():
    cursor.execute("SELECT id, name FROM Subject ORDER BY name")
    return cursor.fetchall()

def fetch_subjects_to_display():
    cursor.execute("SELECT id, name FROM Subject WHERE display == 1 ORDER BY name")
    return cursor.fetchall()

def fetch_year_groups():
    cursor.execute("SELECT id, name FROM YearGroup ORDER BY id")
    return cursor.fetchall()

def fetch_year_groups_to_display():
    cursor.execute("SELECT id, name, display FROM YearGroup ORDER BY id")
    return cursor.fetchall()

def fetch_categories(subject_id, year_group_id):
    cursor.execute("""
    SELECT id, name FROM Category
    WHERE subject_id = ? AND year_group_id = ?
    """, (subject_id, year_group_id))
    return cursor.fetchall()

def fetch_comments(category_id):
    cursor.execute("SELECT text FROM Comment WHERE category_id = ?", (category_id,))
    return cursor.fetchall()

def fetch_comments2(category_id):
    cursor.execute("SELECT id, text FROM Comment WHERE category_id = ?", (category_id,))
    return cursor.fetchall()

def fetch_prompt(subject_id, year_group_id):
    cursor.execute("""
    SELECT prompt_part FROM Prompt
    WHERE subject_id = ? AND year_group_id = ?
    """, (subject_id, year_group_id))
    result = cursor.fetchone()
    return result[0] if result else ''

def update_prompt(subject_id, year_group_id, prompt):
    cursor.execute("""
    INSERT OR REPLACE INTO Prompt (subject_id, year_group_id, prompt_part)
    VALUES (?, ?, ?)
    """, (subject_id, year_group_id, prompt))
    conn.commit()

def insert_category(name, subject_id, year_group_id):
    cursor.execute("INSERT INTO Category (name, subject_id, year_group_id) VALUES (?, ?, ?)", (name, subject_id, year_group_id))
    conn.commit()
    return cursor.lastrowid

def update_category_display(id, display):
    cursor.execute("UPDATE Category SET display = ? WHERE id = ?", (display, id))
    conn.commit()

def delete_category(category_id):
    cursor.execute("DELETE FROM Comment WHERE category_id = ?", (category_id,))
    cursor.execute("DELETE FROM Category WHERE id = ?", (category_id,))
    conn.commit()
"""
def clear_categories(subject_id, year_group_id):
    cursor.execute("SELECT id FROM Category WHERE subject_id AND year_group_id = ?", (subject_id, year_group_id))
    category_id = cursor.fetchall()
    cursor.execute("DELETE FROM Comment WHERE category_id = ?", (category_id,))
    cursor.execute("DELETE FROM Category WHERE subject_id = ? AND year_group_id = ?", (subject_id, year_group_id))
    conn.commit()
"""
def insert_comment(text, category_id):
    cursor.execute("INSERT INTO Comment (text, category_id) VALUES (?, ?)", (text, category_id))
    conn.commit()

def update_comment(comment_id, text):
    cursor.execute("UPDATE Comment SET text = ? WHERE id = ?", (text, comment_id))
    conn.commit()

def delete_comment(comment_id):
    cursor.execute("DELETE FROM Comment WHERE id = ?", (comment_id,))
    conn.commit()

def move_comment(comment_id, new_category_id):
    cursor.execute("UPDATE Comment SET category_id = ? WHERE id = ?", (new_category_id, comment_id))
    conn.commit()

def fetch_existing_comments(subject_id, year_group_id):
    cursor.execute("""
    SELECT Category.name, Comment.text
    FROM Category
    JOIN Comment ON Category.id = Comment.category_id
    WHERE Category.subject_id = ? AND Category.year_group_id = ?
    """, (subject_id, year_group_id))
    return cursor.fetchall()
