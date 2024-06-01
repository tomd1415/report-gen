import tkinter as tk
from tkinter import ttk, messagebox
import sqlite3
from openai import OpenAI
import os
client = OpenAI(api_key='sk-proj-NRXojKZoTDvNsFuhUH8WT3BlbkFJCbb0Gup2YMFD3iq8lRVS')


# Set up OpenAI

# Database setup
conn = sqlite3.connect('app.db')
cursor = conn.cursor()

# Create tables
cursor.execute('''
CREATE TABLE IF NOT EXISTS Subject (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
)
''')

cursor.execute('''
CREATE TABLE IF NOT EXISTS YearGroup (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
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

conn.commit()

# Helper functions
def fetch_subjects():
    cursor.execute("SELECT id, name FROM Subject")
    return cursor.fetchall()

def fetch_year_groups():
    cursor.execute("SELECT id, name FROM YearGroup")
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

def fetch_prompt(subject_id, year_group_id):
    cursor.execute("""
    SELECT prompt_part FROM Prompt
    WHERE subject_id = ? AND year_group_id = ?
    """, (subject_id, year_group_id))
    result = cursor.fetchone()
    return result[0] if result else ''

def generate_report(name, pronouns, subject_id, year_group_id, additional_comments, categories):
    prompt_part = fetch_prompt(subject_id, year_group_id)
    if not prompt_part:
        prompt_part = "Generate a concise school report for a pupil. the report should be between 120 and 160 words. It should not contain any repetition and should be written in a formal, yet friendly way."

    placeholder = 'PUPIL_NAME'
    prompt = f"{prompt_part}\nI am using the following placeholder for a name: {placeholder} the pronouns for this pupil are ({pronouns})\n"

    for category, comment in categories.items():
        if comment:
            prompt += f"{category.replace('_', ' ')}: {comment}\n"

    if additional_comments:
        prompt += f"The following additional comments should be woven into the whole report: {additional_comments}\n"

    response = client.chat.completions.create(model="gpt-4",
    messages=[{"role": "system", "content": "You are a helpful assistant."}, {"role": "user", "content": prompt}],
    max_tokens=500,
    temperature=0.7)

    report = response.choices[0].message.content.strip()
    return report.replace(placeholder, name)

# GUI setup
class Application(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Comment Bank Selector")

        # Subject selection
        self.subject_label = tk.Label(self, text="Select Subject:")
        self.subject_label.pack()
        self.subject_var = tk.StringVar()
        self.subject_select = ttk.Combobox(self, textvariable=self.subject_var)
        self.subject_select.pack()

        # Year group selection
        self.year_group_label = tk.Label(self, text="Select Year Group:")
        self.year_group_label.pack()
        self.year_group_var = tk.StringVar()
        self.year_group_select = ttk.Combobox(self, textvariable=self.year_group_var)
        self.year_group_select.pack()

        # Load subjects and year groups
        self.load_subjects()
        self.load_year_groups()

        # Pupil name and pronouns
        self.name_label = tk.Label(self, text="Pupil's First Name:")
        self.name_label.pack()
        self.name_entry = tk.Entry(self)
        self.name_entry.pack()

        self.pronouns_label = tk.Label(self, text="Pupil's Pronouns:")
        self.pronouns_label.pack()
        self.pronouns_entry = tk.Entry(self)
        self.pronouns_entry.pack()

        # Categories and comments
        self.categories_frame = tk.Frame(self)
        self.categories_frame.pack()

        # Additional comments
        self.additional_comments_label = tk.Label(self, text="Additional Comments:")
        self.additional_comments_label.pack()
        self.additional_comments_text = tk.Text(self, height=4)
        self.additional_comments_text.pack()

        # Generate report button
        self.generate_button = tk.Button(self, text="Generate Report", command=self.generate_report)
        self.generate_button.pack()

        # Report output
        self.report_text = tk.Text(self, height=10)
        self.report_text.pack()

        # Bind event
        self.subject_select.bind("<<ComboboxSelected>>", self.load_categories_and_comments)
        self.year_group_select.bind("<<ComboboxSelected>>", self.load_categories_and_comments)

    def load_subjects(self):
        subjects = fetch_subjects()
        self.subject_select['values'] = [subject[1] for subject in subjects]
        self.subject_map = {subject[1]: subject[0] for subject in subjects}

    def load_year_groups(self):
        year_groups = fetch_year_groups()
        self.year_group_select['values'] = [year_group[1] for year_group in year_groups]
        self.year_group_map = {year_group[1]: year_group[0] for year_group in year_groups}

    def load_categories_and_comments(self, event=None):
        subject_name = self.subject_var.get()
        year_group_name = self.year_group_var.get()
        if subject_name and year_group_name:
            subject_id = self.subject_map[subject_name]
            year_group_id = self.year_group_map[year_group_name]
            categories = fetch_categories(subject_id, year_group_id)
            for widget in self.categories_frame.winfo_children():
                widget.destroy()
            self.comment_vars = {}
            for category in categories:
                category_name = category[1]
                category_id = category[0]
                comments = fetch_comments(category_id)
                category_label = tk.Label(self.categories_frame, text=f"{category_name}:")
                category_label.pack()
                comment_var = tk.StringVar()
                comment_select = ttk.Combobox(self.categories_frame, textvariable=comment_var)
                comment_select['values'] = [comment[0] for comment in comments]
                comment_select.pack()
                self.comment_vars[category_name.replace(' ', '_')] = comment_var

    def generate_report(self):
        name = self.name_entry.get()
        pronouns = self.pronouns_entry.get()
        additional_comments = self.additional_comments_text.get("1.0", tk.END).strip()
        subject_name = self.subject_var.get()
        year_group_name = self.year_group_var.get()
        if subject_name and year_group_name:
            subject_id = self.subject_map[subject_name]
            year_group_id = self.year_group_map[year_group_name]
            categories = {key: var.get() for key, var in self.comment_vars.items()}
            report = generate_report(name, pronouns, subject_id, year_group_id, additional_comments, categories)
            self.report_text.delete("1.0", tk.END)
            self.report_text.insert(tk.END, report)
        else:
            messagebox.showerror("Error", "Please select both subject and year group")

if __name__ == "__main__":
    app = Application()
    app.mainloop()

