import wx
import sqlite3
from openai import OpenAI
import os
import shutil
import json
import csv

# Set up OpenAI
client = OpenAI(api_key='sk-proj-NRXojKZoTDvNsFuhUH8WT3BlbkFJCbb0Gup2YMFD3iq8lRVS')
global conn
global cursor
# Database setup
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


"""
*** Temp fix for old style database ***
cursor.execute('''
INSERT INTO YearGroup (name)
    SELECT name
        FROM (
            SELECT 'Year 7' AS name
            ) AS o
        WHERE NOT EXISTS (
                SELECT *
                    FROM YearGroup
                    WHERE name == o.name
                )
''')
"""

conn.commit()

# Helper functions
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
    cursor.execute("SELECT id, name FROM YearGroup WHERE display == 1 ORDER BY id")
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

    response = client.chat.completions.create(model="gpt-4o",
                                              messages=[{"role": "system", "content": "You are a helpful assistant."}, {"role": "user", "content": prompt}],
                                              max_tokens=500,
                                              temperature=0.7)

    report = response.choices[0].message.content.strip()
    return report.replace(placeholder, name)

class YearSelectDialog(wx.Dialog):
    def __init__(self, parent):
        super().__init__(parent, title="Select Year Groups", size=(200, 500))
        
        self.panel = wx.Panel(self)
        self.sizer = wx.BoxSizer(wx.VERTICAL)
        
        # Fetch year groups from the database
        year_groups = fetch_year_groups()
        
        self.checkboxes = {}
        
        for year_group in year_groups:
            year_group_id, year_group_name = year_group
            checkbox = wx.CheckBox(self.panel, label=year_group_name)
            self.sizer.Add(checkbox, 0, wx.ALL, 5)
            self.checkboxes[year_group_id] = checkbox
            
            # Set checkbox state based on the 'display' field in the database
            cursor.execute("SELECT display FROM YearGroup WHERE id = ?", (year_group_id,))
            display = cursor.fetchone()[0]
            checkbox.SetValue(display == 1)
        
        self.ok_button = wx.Button(self.panel, label="OK")
        self.sizer.Add(self.ok_button, 0, wx.ALL | wx.CENTER, 5)
        
        self.ok_button.Bind(wx.EVT_BUTTON, self.on_ok)
        
        self.panel.SetSizer(self.sizer)
    
    def on_ok(self, event):
        # Update the database based on checkbox states
        for year_group_id, checkbox in self.checkboxes.items():
            display = 1 if checkbox.GetValue() else 0
            cursor.execute("UPDATE YearGroup SET display = ? WHERE id = ?", (display, year_group_id))
        
        conn.commit()
        self.Destroy()

class SubjectSelectDialog(wx.Dialog):
    def __init__(self, parent):
        super().__init__(parent, title="Select Subjects", size=(300, 400))
        
        self.panel = wx.Panel(self)
        self.sizer = wx.BoxSizer(wx.VERTICAL)
        
        # Fetch year groups from the database
        subjects = fetch_subjects()
        
        self.checkboxes = {}
        
        for subject in subjects:
            subject_id, subject_name = subject
            checkbox = wx.CheckBox(self.panel, label=subject_name)
            self.sizer.Add(checkbox, 0, wx.ALL, 5)
            self.checkboxes[subject_id] = checkbox
            
            # Set checkbox state based on the 'display' field in the database
            cursor.execute("SELECT display FROM Subject WHERE id = ?", (subject_id,))
            display = cursor.fetchone()[0]
            checkbox.SetValue(display == 1)
        
        self.ok_button = wx.Button(self.panel, label="OK")
        self.sizer.Add(self.ok_button, 0, wx.ALL | wx.CENTER, 5)
        
        self.ok_button.Bind(wx.EVT_BUTTON, self.on_ok)
        
        self.panel.SetSizer(self.sizer)
    
    def on_ok(self, event):
        # Update the database based on checkbox states
        for year_group_id, checkbox in self.checkboxes.items():
            display = 1 if checkbox.GetValue() else 0
            cursor.execute("UPDATE Subject SET display = ? WHERE id = ?", (display, year_group_id))
        
        conn.commit()
        self.Destroy()

class ChangePromptDialog(wx.Dialog):
    def __init__(self, parent):
        super().__init__(parent, title="Change AI Prompt", size=(500, 500))

        self.panel = wx.Panel(self)
        self.sizer = wx.BoxSizer(wx.VERTICAL)

        # Subject selection
        self.subject_label = wx.StaticText(self.panel, label="Select Subject:")
        self.sizer.Add(self.subject_label, 0, wx.ALL | wx.EXPAND, 5)
        self.subject_select = wx.ComboBox(self.panel, style=wx.CB_READONLY)
        self.sizer.Add(self.subject_select, 0, wx.ALL | wx.EXPAND, 5)

        # Year group selection
        self.year_group_label = wx.StaticText(self.panel, label="Select Year Group:")
        self.sizer.Add(self.year_group_label, 0, wx.ALL | wx.EXPAND, 5)
        self.year_group_select = wx.ComboBox(self.panel, style=wx.CB_READONLY)
        self.sizer.Add(self.year_group_select, 0, wx.ALL | wx.EXPAND, 5)

        # Prompt text box
        self.prompt_label = wx.StaticText(self.panel, label="Edit Prompt:")
        self.sizer.Add(self.prompt_label, 0, wx.ALL | wx.EXPAND, 5)
        self.prompt_text = wx.TextCtrl(self.panel, style=wx.TE_MULTILINE, size=(-1, 200))
        self.sizer.Add(self.prompt_text, 1, wx.ALL | wx.EXPAND, 5)

        # Save button
        self.save_button = wx.Button(self.panel, label="Save")
        self.sizer.Add(self.save_button, 0, wx.ALL | wx.CENTER, 5)

        self.save_button.Bind(wx.EVT_BUTTON, self.on_save)

        self.panel.SetSizer(self.sizer)

        # Load subjects and year groups
        self.load_subjects()
        self.load_year_groups()

        # Bind events
        self.subject_select.Bind(wx.EVT_COMBOBOX, self.load_prompt)
        self.year_group_select.Bind(wx.EVT_COMBOBOX, self.load_prompt)

    def load_subjects(self):
        subjects = fetch_subjects_to_display()
        self.subject_map = {subject[1]: subject[0] for subject in subjects}
        self.subject_select.Set([subject[1] for subject in subjects])

    def load_year_groups(self):
        year_groups = fetch_year_groups_to_display()
        self.year_group_map = {year_group[1]: year_group[0] for year_group in year_groups}
        self.year_group_select.Set([year_group[1] for year_group in year_groups])

    def load_prompt(self, event):
        subject_name = self.subject_select.GetValue()
        year_group_name = self.year_group_select.GetValue()
        if subject_name and year_group_name:
            subject_id = self.subject_map[subject_name]
            year_group_id = self.year_group_map[year_group_name]
            prompt = fetch_prompt(subject_id, year_group_id)
            if not prompt:
                prompt = ("Generate a detailed and concise school report for the pupil, who is in "  + year_group_name + " " + subject_name +
                          " lessons. The tone of the report should be friendly yet formal. The report "
                          "should be between 100 and 170 words and should flow smoothly without any repetition. Below are "
                          "categories and comments to base the report on. Each comment should be integrated seamlessly into "
                          "the report without explicit headings. The report can be organized into up to three paragraphs, "
                          "ensuring that each paragraph addresses different aspects of the pupil's performance and behaviour. "
                          "Make sure to highlight the pupil's strengths, areas for improvement, and any notable achievements. "
                          "If applicable, provide specific examples or incidents that illustrate these points. Conclude with a "
                          "positive outlook on the pupil's potential and future progress in " + subject_name + ".")
            self.prompt_text.SetValue(prompt)

    def on_save(self, event):
        subject_name = self.subject_select.GetValue()
        year_group_name = self.year_group_select.GetValue()
        if subject_name and year_group_name:
            subject_id = self.subject_map[subject_name]
            year_group_id = self.year_group_map[year_group_name]
            prompt = self.prompt_text.GetValue()
            cursor.execute("""
            INSERT OR REPLACE INTO Prompt (subject_id, year_group_id, prompt_part)
            VALUES (?, ?, ?)
            """, (subject_id, year_group_id, prompt))
            conn.commit()
            wx.MessageBox("Prompt saved successfully", "Info", wx.OK | wx.ICON_INFORMATION)
            self.Destroy()
        else:
            wx.MessageBox("Please select both subject and year group", "Error", wx.OK | wx.ICON_ERROR)

class GenerateCommentsDialog(wx.Dialog):
    def __init__(self, parent):
        super().__init__(parent, title="Generate Comments", size=(600, 600))

        self.panel = wx.Panel(self)
        self.sizer = wx.BoxSizer(wx.VERTICAL)

        # Subject selection
        self.subject_label = wx.StaticText(self.panel, label="Select Subject:")
        self.sizer.Add(self.subject_label, 0, wx.ALL | wx.EXPAND, 5)
        self.subject_select = wx.ComboBox(self.panel, style=wx.CB_READONLY)
        self.sizer.Add(self.subject_select, 0, wx.ALL | wx.EXPAND, 5)

        # Year group selection
        self.year_group_label = wx.StaticText(self.panel, label="Select Year Group:")
        self.sizer.Add(self.year_group_label, 0, wx.ALL | wx.EXPAND, 5)
        self.year_group_select = wx.ComboBox(self.panel, style=wx.CB_READONLY)
        self.sizer.Add(self.year_group_select, 0, wx.ALL | wx.EXPAND, 5)

        # Pupil names input
        self.pupil_names_label = wx.StaticText(self.panel, label="Enter Pupil Names (comma-separated):")
        self.sizer.Add(self.pupil_names_label, 0, wx.ALL | wx.EXPAND, 5)
        self.pupil_names_text = wx.TextCtrl(self.panel)
        self.sizer.Add(self.pupil_names_text, 0, wx.ALL | wx.EXPAND, 5)

        # Reports input
        self.reports_label = wx.StaticText(self.panel, label="Paste Reports Here:")
        self.sizer.Add(self.reports_label, 0, wx.ALL | wx.EXPAND, 5)
        self.reports_text = wx.TextCtrl(self.panel, style=wx.TE_MULTILINE, size=(-1, 300))
        self.sizer.Add(self.reports_text, 1, wx.ALL | wx.EXPAND, 5)

        # Generate button
        self.generate_button = wx.Button(self.panel, label="Generate Comments")
        self.sizer.Add(self.generate_button, 0, wx.ALL | wx.CENTER, 5)
        self.generate_button.Bind(wx.EVT_BUTTON, self.on_generate)

        self.panel.SetSizer(self.sizer)

        # Load subjects and year groups
        self.load_subjects()
        self.load_year_groups()

    def load_subjects(self):
        subjects = fetch_subjects_to_display()
        self.subject_map = {subject[1]: subject[0] for subject in subjects}
        self.subject_select.Set([subject[1] for subject in subjects])

    def load_year_groups(self):
        year_groups = fetch_year_groups_to_display()
        self.year_group_map = {year_group[1]: year_group[0] for year_group in year_groups}
        self.year_group_select.Set([year_group[1] for year_group in year_groups])

    def on_generate(self, event):
        subject_name = self.subject_select.GetValue()
        year_group_name = self.year_group_select.GetValue()
        pupil_names = self.pupil_names_text.GetValue()
        reports = self.reports_text.GetValue()

        if subject_name and year_group_name and reports:
            subject_id = self.subject_map[subject_name]
            year_group_id = self.year_group_map[year_group_name]

            # Replace pupil names with placeholder
            placeholder = 'PUPIL_NAME'
            names_array = [name.strip() for name in pupil_names.split(',')]
            reports_with_placeholder = reports
            for name in names_array:
                reports_with_placeholder = reports_with_placeholder.replace(name, placeholder)

            try:
                # Call OpenAI to process the reports
                response = client.chat.completions.create(
                    model='gpt-4o',
                    messages=[{
                        'role': 'user',
                        'content': (
                            "Please analyze the following school reports and extract relevant categories and comments "
                            "that can be used to generate future student reports. There should be no more than 8 categories "
                            "and similar categories should be merged. Ensure that the comments are concise, clear, and avoid "
                            "any redundancy. Each category should have no more than 8 comments, and similar comments should be "
                            "merged or removed. The final category should be 'Targets', containing specific and actionable targets "
                            "for students, with the last target being '***Generate a target for this pupil and add to the report***'. "
                            "Please try to make each category have the comments cover a variety of abilities and behaviors. Please "
                            "order the comments from least able to most able. Format the output as follows:\n"
                            "Category: [Category Name]\n"
                            "[Comment 1]\n"
                            "[Comment 2]\n"
                            "...\n"
                            "Here is an example of the desired output:\n"
                            "Category: Interest and Engagement\n"
                            "Shows good attitude initially but sometimes struggles to maintain focus.\n"
                            "Brings a quiet confidence to all computing lessons but can sometimes lose focus.\n"
                            "Category: Independent Study\n"
                            "Keen to learn quickly but sometimes rushes and misses mistakes.\n"
                            "Prefers independence and self-study, often completing work outside of school.\n"
                            "The reports start here:\n\n"
                            f"{reports_with_placeholder}"
                        )
                    }],
                    max_tokens=3500,
                    temperature=0.6
                )

                new_extracted_text = response.choices[0].message.content.strip()

                # Example response parsing (assumes categories and comments are structured in the response)
                new_categories = {}
                lines = new_extracted_text.split('\n')
                current_category = None

                for line in lines:
                    category_match = line.startswith("Category: ")
                    if category_match:
                        current_category = line.split("Category: ")[1]
                        new_categories[current_category] = []
                    elif current_category and line.strip():
                        new_categories[current_category].append(line.strip())

                # Fetch existing categories and comments from the database
                cursor.execute("""
                SELECT Category.name, Comment.text
                FROM Category
                JOIN Comment ON Category.id = Comment.category_id
                WHERE Category.subject_id = ? AND Category.year_group_id = ?
                """, (subject_id, year_group_id))

                existing_comments = cursor.fetchall()
                existing_categories = {}
                for category, comment in existing_comments:
                    if category not in existing_categories:
                        existing_categories[category] = []
                    existing_categories[category].append(comment)

                # Create a prompt to merge existing and new categories and comments
                merge_prompt = (
                    "I have two sets of categories and comments for student reports. Please merge them, ensuring no more than 8 categories "
                    "and no more than 8 comments per category. If categories are similar, please merge them. Prioritize clarity and conciseness. "
                    "Please try and keep the order of the comments (ordered by ability and behaviour) and give priority to the New categories and comments. The finial category should be 'Targets' and have a list of potentional targets for these pupils.\n\n"
                    f"Existing categories and comments:\n\n{json.dumps(existing_categories, indent=2)}\n\n"
                    f"New categories and comments:\n\n{json.dumps(new_categories, indent=2)}\n\n"
                    "Format the output as follows:\nCategory: [Category Name]\n[Comment 1]\n[Comment 2]\n...\n"
                )

                # Call OpenAI to merge the existing and new categories and comments
                merge_response = client.chat.completions.create(
                    model='gpt-4',
                    messages=[{'role': 'user', 'content': merge_prompt}],
                    max_tokens=3500,
                    temperature=0.6
                )

                merged_text = merge_response.choices[0].message.content.strip()

                # Parse the merged categories and comments
                merged_categories = {}
                merged_lines = merged_text.split('\n')
                merged_current_category = None

                for line in merged_lines:
                    category_match = line.startswith("Category: ")
                    if category_match:
                        merged_current_category = line.split("Category: ")[1]
                        merged_categories[merged_current_category] = []
                    elif merged_current_category and line.strip():
                        merged_categories[merged_current_category].append(line.strip())

                # Replace the existing categories and comments with the merged ones
                cursor.execute("DELETE FROM Comment WHERE category_id IN (SELECT id FROM Category WHERE subject_id = ? AND year_group_id = ?)", (subject_id, year_group_id))
                cursor.execute("DELETE FROM Category WHERE subject_id = ? AND year_group_id = ?", (subject_id, year_group_id))

                for category_name, comments in merged_categories.items():
                    cursor.execute("INSERT INTO Category (name, subject_id, year_group_id) VALUES (?, ?, ?)", (category_name, subject_id, year_group_id))
                    category_id = cursor.lastrowid
                    for comment in comments:
                        cursor.execute("INSERT INTO Comment (text, category_id) VALUES (?, ?)", (comment, category_id))

                conn.commit()

                wx.MessageBox("Comments generated successfully", "Info", wx.OK | wx.ICON_INFORMATION)
                self.Destroy()
            except Exception as e:
                wx.MessageBox(f"Error generating comments: {str(e)}", "Error", wx.OK | wx.ICON_ERROR)
        else:
            wx.MessageBox("Please select both subject and year group, and enter reports", "Error", wx.OK | wx.ICON_ERROR)

class ExportDialog(wx.Dialog):
    def __init__(self, parent):
        super().__init__(parent, title="Export Comments", size=(400, 300))

        self.panel = wx.Panel(self)
        self.sizer = wx.BoxSizer(wx.VERTICAL)

        # Subject selection
        self.subject_label = wx.StaticText(self.panel, label="Select Subject:")
        self.sizer.Add(self.subject_label, 0, wx.ALL | wx.EXPAND, 5)
        self.subject_select = wx.ComboBox(self.panel, style=wx.CB_READONLY)
        self.sizer.Add(self.subject_select, 0, wx.ALL | wx.EXPAND, 5)

        # Year group selection
        self.year_group_label = wx.StaticText(self.panel, label="Select Year Group:")
        self.sizer.Add(self.year_group_label, 0, wx.ALL | wx.EXPAND, 5)
        self.year_group_select = wx.ComboBox(self.panel, style=wx.CB_READONLY)
        self.sizer.Add(self.year_group_select, 0, wx.ALL | wx.EXPAND, 5)

        # Export button
        self.export_button = wx.Button(self.panel, label="Export")
        self.sizer.Add(self.export_button, 0, wx.ALL | wx.CENTER, 5)
        self.export_button.Bind(wx.EVT_BUTTON, self.on_export)

        self.panel.SetSizer(self.sizer)

        # Load subjects and year groups
        self.load_subjects()
        self.load_year_groups()

    def load_subjects(self):
        subjects = fetch_subjects_to_display()
        self.subject_map = {subject[1]: subject[0] for subject in subjects}
        self.subject_select.Set([subject[1] for subject in subjects])

    def load_year_groups(self):
        year_groups = fetch_year_groups_to_display()
        self.year_group_map = {year_group[1]: year_group[0] for year_group in year_groups}
        self.year_group_select.Set([year_group[1] for year_group in year_groups])

    def on_export(self, event):
        subject_name = self.subject_select.GetValue()
        year_group_name = self.year_group_select.GetValue()

        if subject_name and year_group_name:
            subject_id = self.subject_map[subject_name]
            year_group_id = self.year_group_map[year_group_name]

            # Fetch categories and comments from the database
            cursor.execute("""
            SELECT Category.name, Comment.text
            FROM Category
            JOIN Comment ON Category.id = Comment.category_id
            WHERE Category.subject_id = ? AND Category.year_group_id = ?
            """, (subject_id, year_group_id))

            comments_data = cursor.fetchall()

            # Ask the user where to save the CSV file
            save_dialog = wx.FileDialog(self, "Save CSV file", wildcard="CSV files (*.csv)|*.csv",
                                        style=wx.FD_SAVE | wx.FD_OVERWRITE_PROMPT)
            if save_dialog.ShowModal() == wx.ID_OK:
                filename = save_dialog.GetPath()
                if not(filename.endswith(".csv")):
                    filename = filename + ".csv"

                # Write the data to a CSV file
                with open(filename, mode='w', newline='', encoding='utf-8') as file:
                    writer = csv.writer(file)
                    writer.writerow(["Category", "Comment"])
                    for category, comment in comments_data:
                        writer.writerow([category.strip(), comment.strip()])

                wx.MessageBox("Comments exported successfully", "Info", wx.OK | wx.ICON_INFORMATION)
                self.Destroy()
            else:
                save_dialog.Destroy()
        else:
            wx.MessageBox("Please select both subject and year group", "Error", wx.OK | wx.ICON_ERROR)

class ImportDialog(wx.Dialog):
    def __init__(self, parent):
        super().__init__(parent, title="Import Comments", size=(400, 300))

        self.panel = wx.Panel(self)
        self.sizer = wx.BoxSizer(wx.VERTICAL)

        # Subject selection
        self.subject_label = wx.StaticText(self.panel, label="Select Subject:")
        self.sizer.Add(self.subject_label, 0, wx.ALL | wx.EXPAND, 5)
        self.subject_select = wx.ComboBox(self.panel, style=wx.CB_READONLY)
        self.sizer.Add(self.subject_select, 0, wx.ALL | wx.EXPAND, 5)

        # Year group selection
        self.year_group_label = wx.StaticText(self.panel, label="Select Year Group:")
        self.sizer.Add(self.year_group_label, 0, wx.ALL | wx.EXPAND, 5)
        self.year_group_select = wx.ComboBox(self.panel, style=wx.CB_READONLY)
        self.sizer.Add(self.year_group_select, 0, wx.ALL | wx.EXPAND, 5)

        # Import button
        self.import_button = wx.Button(self.panel, label="Import")
        self.sizer.Add(self.import_button, 0, wx.ALL | wx.CENTER, 5)
        self.import_button.Bind(wx.EVT_BUTTON, self.on_import)

        self.panel.SetSizer(self.sizer)

        # Load subjects and year groups
        self.load_subjects()
        self.load_year_groups()

    def load_subjects(self):
        subjects = fetch_subjects_to_display()
        self.subject_map = {subject[1]: subject[0] for subject in subjects}
        self.subject_select.Set([subject[1] for subject in subjects])

    def load_year_groups(self):
        year_groups = fetch_year_groups_to_display()
        self.year_group_map = {year_group[1]: year_group[0] for year_group in year_groups}
        self.year_group_select.Set([year_group[1] for year_group in year_groups])

    def on_import(self, event):
        subject_name = self.subject_select.GetValue()
        year_group_name = self.year_group_select.GetValue()

        if subject_name and year_group_name:
            subject_id = self.subject_map[subject_name]
            year_group_id = self.year_group_map[year_group_name]

            # Ask the user to select the CSV file
            open_dialog = wx.FileDialog(self, "Open CSV file", wildcard="CSV files (*.csv)|*.csv",
                                        style=wx.FD_OPEN | wx.FD_FILE_MUST_EXIST)
            if open_dialog.ShowModal() == wx.ID_OK:
                filename = open_dialog.GetPath()

                try:
                    # Read the data from the CSV file
                    with open(filename, mode='r', encoding='utf-8') as file:
                        reader = csv.reader(file)
                        next(reader)  # Skip the header row
                        data = [(row[0].strip(), row[1].strip()) for row in reader]

                    # Clear existing categories and comments for the subject and year group
                    cursor.execute("DELETE FROM Comment WHERE category_id IN (SELECT id FROM Category WHERE subject_id = ? AND year_group_id = ?)", (subject_id, year_group_id))
                    cursor.execute("DELETE FROM Category WHERE subject_id = ? AND year_group_id = ?", (subject_id, year_group_id))

                    # Insert the new categories and comments
                    category_map = {}
                    for category_name, comment_text in data:
                        if category_name not in category_map:
                            cursor.execute("INSERT INTO Category (name, subject_id, year_group_id) VALUES (?, ?, ?)", (category_name, subject_id, year_group_id))
                            category_id = cursor.lastrowid
                            category_map[category_name] = category_id
                        else:
                            category_id = category_map[category_name]

                        cursor.execute("INSERT INTO Comment (text, category_id) VALUES (?, ?)", (comment_text, category_id))

                    conn.commit()

                    wx.MessageBox("Comments imported successfully", "Info", wx.OK | wx.ICON_INFORMATION)
                    self.Destroy()
                except Exception as e:
                    wx.MessageBox(f"Error importing comments: {str(e)}", "Error", wx.OK | wx.ICON_ERROR)
            else:
                open_dialog.Destroy()
        else:
            wx.MessageBox("Please select both subject and year group", "Error", wx.OK | wx.ICON_ERROR)


class Application(wx.Frame):
    def __init__(self):
        super().__init__(None, title="Comment Bank Selector", size=(800, 900))

        self.panel = wx.Panel(self)
        self.SetMinSize((600,600))
        
        self.CreateStatusBar() # A status bar at the bottom of the window
        
        # Setting up the menu
        filemenu = wx.Menu()
        
        # wx.ID_ABOUT and wx.ID_EXIT are standard IDs provided by wxWidgets.
        menuOpen = filemenu.Append(wx.ID_OPEN, "&Open", "Restore from backup")
        menuSave = filemenu.Append(wx.ID_SAVE, "&Save", "Save current comment bank")
        menuSaveAs = filemenu.Append(wx.ID_SAVEAS, "Save &As", "Save the all comments to backup")
        filemenu.AppendSeparator()
        menuAbout = filemenu.Append(wx.ID_ABOUT, "&About","Information about this program.")
        filemenu.AppendSeparator()
        menuExit = filemenu.Append(wx.ID_EXIT,"E&xit"," Terminate the program")
        
        settingsmenu = wx.Menu()
        menuYearSelect = settingsmenu.Append(wx.ID_ANY, "Select &Year Group(s)", "Select the year groups to focus on for the session")
        menuSubjectSelect = settingsmenu.Append(wx.ID_ANY, "Select &Subject(s)", "Select the subjects to focus on for the session")
        menuChangePrompt = settingsmenu.Append(wx.ID_ANY, "Change the AI Prompt", "Change the AI Prompt for a year group and subject combination")
        menuSaveSettings = settingsmenu.Append(wx.ID_ANY, "Save Current Settings", "Save any changes to the settings")

        commentsmenu = wx.Menu()
        menuGenerateComments = commentsmenu.Append(wx.ID_ANY, "&Generate Comments", "Use AI to generate comments from previous reports")
        menuEditCategories = commentsmenu.Append(wx.ID_ANY, "Edit Categories and Comments", "Edit the comments and categories for a year group and subject combination")
        menuImportComments = commentsmenu.Append(wx.ID_ANY, "&Import Comments", "Import comment bank for a year group and subject combination")
        menuExportComments = commentsmenu.Append(wx.ID_ANY, "&Export Comments", "Export the comments for one year group and subject combination")

        #creating the menubar
        menuBar = wx.MenuBar()
        menuBar.Append(filemenu,"&File") #adding the filemanu to the MenuBar
        menuBar.Append(settingsmenu, "&Settings")
        menuBar.Append(commentsmenu, "Edit &Comment Bank")
        self.SetMenuBar(menuBar) # Adding the menubar to the Frame content.
        
        self.Bind(wx.EVT_MENU, self.OnOpen, menuOpen)
        self.Bind(wx.EVT_MENU, self.OnSave, menuSave)
        self.Bind(wx.EVT_MENU, self.OnSaveAs, menuSaveAs)
        self.Bind(wx.EVT_MENU, self.OnImport, menuImportComments)
        self.Bind(wx.EVT_MENU, self.OnExport, menuExportComments)
        self.Bind(wx.EVT_MENU, self.OnAbout, menuAbout)
        self.Bind(wx.EVT_MENU, self.OnExit, menuExit)
        
        self.Bind(wx.EVT_MENU, self.OnGenerateComments, menuGenerateComments)
        self.Bind(wx.EVT_MENU, self.OnYearSelect, menuYearSelect)
        self.Bind(wx.EVT_MENU, self.OnSubjectSelect, menuSubjectSelect)
        self.Bind(wx.EVT_MENU, self.OnEditCategories, menuEditCategories)
        self.Bind(wx.EVT_MENU, self.OnChangePrompt, menuChangePrompt)
        self.Bind(wx.EVT_MENU, self.OnSaveSettings, menuSaveSettings)
        
        self.sizer = wx.BoxSizer(wx.VERTICAL)

        # Subject and Year Group selection side by side
        self.selection_sizer = wx.BoxSizer(wx.HORIZONTAL)

        self.subject_label = wx.StaticText(self.panel, label="Select Subject:")
        self.selection_sizer.Add(self.subject_label, 0, wx.ALL | wx.EXPAND, 5)
        self.subject_select = wx.ComboBox(self.panel, style=wx.CB_READONLY)
        self.selection_sizer.Add(self.subject_select, 1, wx.ALL | wx.EXPAND, 5)

        self.year_group_label = wx.StaticText(self.panel, label="Select Year Group:")
        self.selection_sizer.Add(self.year_group_label, 0, wx.ALL | wx.EXPAND, 5)
        self.year_group_select = wx.ComboBox(self.panel, style=wx.CB_READONLY)
        self.selection_sizer.Add(self.year_group_select, 1, wx.ALL | wx.EXPAND, 5)

        self.sizer.Add(self.selection_sizer, 0, wx.ALL | wx.EXPAND, 5)

        # Pupil name and pronouns side by side
        self.name_pronoun_sizer = wx.BoxSizer(wx.HORIZONTAL)

        self.name_label = wx.StaticText(self.panel, label="Pupil's First Name:")
        self.name_pronoun_sizer.Add(self.name_label, 0, wx.ALL | wx.EXPAND, 5)
        self.name_entry = wx.TextCtrl(self.panel)
        self.name_pronoun_sizer.Add(self.name_entry, 1, wx.ALL | wx.EXPAND, 5)

        self.pronouns_label = wx.StaticText(self.panel, label="Pupil's Pronouns:")
        self.name_pronoun_sizer.Add(self.pronouns_label, 0, wx.ALL | wx.EXPAND, 5)
        self.pronouns_entry = wx.TextCtrl(self.panel)
        self.name_pronoun_sizer.Add(self.pronouns_entry, 1, wx.ALL | wx.EXPAND, 5)

        self.sizer.Add(self.name_pronoun_sizer, 0, wx.ALL | wx.EXPAND, 5)

        # Categories and comments with scrollable area
        self.categories_box = wx.StaticBox(self.panel, label="Categories and Comments")
        self.categories_box_sizer = wx.StaticBoxSizer(self.categories_box, wx.VERTICAL)
        self.scroll = wx.ScrolledWindow(self.panel, -1, style=wx.TAB_TRAVERSAL | wx.VSCROLL | wx.HSCROLL)
        self.scroll.SetScrollRate(5, 5)
        self.categories_sizer = wx.BoxSizer(wx.VERTICAL)
        self.scroll.SetSizer(self.categories_sizer)
        self.categories_box_sizer.Add(self.scroll, 1, wx.ALL | wx.EXPAND, 5)
        self.sizer.Add(self.categories_box_sizer, 1, wx.ALL | wx.EXPAND, 5)


        # Additional comments
        self.additional_comments_label = wx.StaticText(self.panel, label="Additional Comments:")
        self.sizer.Add(self.additional_comments_label, 0, wx.ALL | wx.EXPAND, 5)
        self.additional_comments_text = wx.TextCtrl(self.panel, style=wx.TE_MULTILINE, size=(-1, 100))
        self.sizer.Add(self.additional_comments_text, 0, wx.ALL | wx.EXPAND, 5)

        # Generate report button
        self.generate_button = wx.Button(self.panel, label="Generate Report")
        self.sizer.Add(self.generate_button, 0, wx.ALL | wx.CENTER, 5)
        self.generate_button.Bind(wx.EVT_BUTTON, self.generate_report)

        # Report output
        self.report_text = wx.TextCtrl(self.panel, style=wx.TE_MULTILINE | wx.TE_READONLY, size=(-1, 150))
        self.sizer.Add(self.report_text, 0, wx.ALL | wx.EXPAND, 5)

        self.panel.SetSizer(self.sizer)

        # Load subjects and year groups
        self.load_subjects()
        self.load_year_groups()

        # Bind events
        self.subject_select.Bind(wx.EVT_COMBOBOX, self.load_categories_and_comments)
        self.year_group_select.Bind(wx.EVT_COMBOBOX, self.load_categories_and_comments)

        self.selected_comments = {}

    def OnExit(self, event):
        conn.commit()
        conn.close()
        self.Close(True) # close the frame
    
    def OnAbout(self, event):
        # A message dialog box with an OK button. wx.OK is a standard ID in wxWidgets.
        dlg = wx.MessageDialog( self, "A way if generating reports from comment banks", "About Report Generator", wx.OK)
        dlg.ShowModal() # show it
        dlg.Destroy() # finally destroy it when finished

    def OnOpen(self, event):
        """ Open a file """
        global conn
        global cursor
        self.dirname = ''
        dlg = wx.FileDialog(self, "Choose a file", self.dirname, "", "*.db", wx.FD_OPEN)
        conn.close()
        if dlg.ShowModal() == wx.ID_OK:
            self.filename = dlg.GetFilename()
            self.dirname = dlg.GetDirectory()
            shutil.copyfile(os.path.join(self.dirname, self.filename), 'app.db')
            conn = sqlite3.connect('app.db')
            cursor = conn.cursor()
            conn.commit()
            self.load_subjects()
            self.load_year_groups()
            self.categories_sizer.Clear(True)
            self.report_text.Clear()
            self.name_entry.SetValue("")
            self.pronouns_entry.SetValue("")
            self.additional_comments_text.SetValue("")
            self.Refresh()
            self.Update()
 
        dlg.Destroy()

    def OnSave(self, event):
        try:
            conn.commit()
            shutil.copyfile('app.db', 'app_backup.db')
            dlg = wx.MessageDialog(self, "Save Completed", "Save", wx.OK)
        except:
            dlg = wx.MessageDialog(self, "Save Failed (sorry)", "Save", wx.OK)
            
        dlg.ShowModal()
        dlg.Destroy

    def OnSaveAs(self, event):
        # Save a copy of the whole database
        conn.commit()
        #self.boxContent = self.control.GetValue()
        self.dirname = ''
        dlg = wx.FileDialog(self, "Save as", self.dirname, "", "*.db", wx.FD_SAVE | wx.FD_OVERWRITE_PROMPT)
        #if (dlg.ShowModal() == wx.ID_CANCEL):
        #    return
        if dlg.ShowModal() == wx.ID_OK:
            self.filename = dlg.GetFilename()
            if not(self.filename.endswith(".db")):
                self.filename = self.filename + ".db"
            self.dirname = dlg.GetDirectory()
            shutil.copyfile('app.db', os.path.join(self.dirname, self.filename))
        
        dlg.Destroy()

    def OnImport(self, events):
        dialog = ImportDialog(self)
        dialog.ShowModal()
        dialog.Destroy()

    
    def OnExport(self, events):
        dialog = ExportDialog(self)
        dialog.ShowModal()
        dialog.Destroy()
    
    
    def OnYearSelect(self, events):
        dialog = YearSelectDialog(self)
        dialog.ShowModal()
        self.load_year_groups()
        dialog.Destroy()
    
    def OnSubjectSelect(self, events):
        dialog = SubjectSelectDialog(self)
        dialog.ShowModal()
        self.load_subjects()
        dialog.Destroy()
    
    def OnEditCategories(self, events):
        pass

    def OnSaveSettings(self, events):
        pass
    
    def OnChangePrompt(self, events):
        dialog = ChangePromptDialog(self)
        dialog.ShowModal()
        dialog.Destroy()
    
    def OnGenerateComments(self, events):
        dialog = GenerateCommentsDialog(self)
        dialog.ShowModal()
        dialog.Destroy()

    # Load subjects into the subject selection combobox
    def load_subjects(self):
        subjects = fetch_subjects_to_display()
        self.subject_map = {subject[1]: subject[0] for subject in subjects}
        self.subject_select.Set([subject[1] for subject in subjects])

    # Load year groups into the year group selection combobox
    def load_year_groups(self):
        year_groups = fetch_year_groups_to_display()
        self.year_group_map = {year_group[1]: year_group[0] for year_group in year_groups}
        self.year_group_select.Set([year_group[1] for year_group in year_groups])

    # Load categories and comments based on selected subject and year group
    def load_categories_and_comments(self, event):
        subject_name = self.subject_select.GetValue()
        year_group_name = self.year_group_select.GetValue()
        if subject_name and year_group_name:
            subject_id = self.subject_map[subject_name]
            year_group_id = self.year_group_map[year_group_name]
            categories = fetch_categories(subject_id, year_group_id)
            self.categories_sizer.Clear(True)  # Clear existing categories
            self.comment_vars = {}
            for category in categories:
                category_name = category[1]
                category_id = category[0]
                comments = fetch_comments(category_id)
                category_label = wx.StaticText(self.scroll, label=f"{category_name}:")
                self.categories_sizer.Add(category_label, 0, wx.ALL | wx.EXPAND, 5)
                comment_select = wx.ComboBox(self.scroll, style=wx.CB_READONLY, size=(300, -1))
                comment_select.Set([comment[0] for comment in comments])
                self.categories_sizer.Add(comment_select, 0, wx.ALL | wx.EXPAND, 5)
                self.comment_vars[category_name.replace(' ', '_')] = comment_select
            self.scroll.Layout()  # Refresh the scrollable area layout
            self.panel.Layout()  # Refresh the main panel layout to accommodate new widgets
            self.scroll.FitInside()  # Ensure the scrollable area fits its contents

    # Generate report based on user input and display it
    def generate_report(self, event):
        name = self.name_entry.GetValue()
        pronouns = self.pronouns_entry.GetValue()
        additional_comments = self.additional_comments_text.GetValue().strip()
        subject_name = self.subject_select.GetValue()
        year_group_name = self.year_group_select.GetValue()
        if subject_name and year_group_name:
            subject_id = self.subject_map[subject_name]
            year_group_id = self.year_group_map[year_group_name]
            categories = {key: var.GetValue() for key, var in self.comment_vars.items()}
            report = generate_report(name, pronouns, subject_id, year_group_id, additional_comments, categories)
            self.report_text.SetValue(report)

            # Clear the pupil's first name and pronouns
            self.name_entry.SetValue("")
            self.pronouns_entry.SetValue("")
            self.additional_comments_text.SetValue("")

            # Reset the comments selection in the ComboBoxes
            for comment_var in self.comment_vars.values():
                comment_var.Clear()
            self.load_categories_and_comments(None)
        else:
            wx.MessageBox("Please select both subject and year group", "Error", wx.OK | wx.ICON_ERROR)

if __name__ == "__main__":
    app = wx.App(False)
    frame = Application()
    frame.Show()
    app.MainLoop()
