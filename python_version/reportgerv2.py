import wx
import sqlite3
from openai import OpenAI
import os

# Set up OpenAI
client = OpenAI(api_key='sk-proj-NRXojKZoTDvNsFuhUH8WT3BlbkFJCbb0Gup2YMFD3iq8lRVS')

# Database setup
conn = sqlite3.connect('app.db')
cursor = conn.cursor()

# Create tables if they do not exist
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

class CategorySelectionDialog(wx.Dialog):
    def __init__(self, parent, subject_id, year_group_id):
        super().__init__(parent, title="Select Comments", size=(800, 700))
        self.subject_id = subject_id
        self.year_group_id = year_group_id
        self.comment_vars = {}

        sizer = wx.BoxSizer(wx.VERTICAL)

        categories = fetch_categories(subject_id, year_group_id)
        for category in categories:
            category_name = category[1]
            category_id = category[0]
            comments = fetch_comments(category_id)
            category_label = wx.StaticText(self, label=f"{category_name}:")
            sizer.Add(category_label, 0, wx.ALL | wx.EXPAND, 5)
            comment_select = wx.ComboBox(self, style=wx.CB_READONLY)
            comment_select.Set([comment[0] for comment in comments])
            sizer.Add(comment_select, 0, wx.ALL | wx.EXPAND, 5)
            self.comment_vars[category_name.replace(' ', '_')] = comment_select

        ok_button = wx.Button(self, label="OK")
        ok_button.Bind(wx.EVT_BUTTON, self.on_ok)
        sizer.Add(ok_button, 0, wx.ALL | wx.CENTER, 5)

        self.SetSizer(sizer)
        self.SetMinSize((400, 400))

    def on_ok(self, event):
        self.EndModal(wx.ID_OK)

class Application(wx.Frame):
    def __init__(self):
        super().__init__(None, title="Comment Bank Selector", size=(500, 600))

        panel = wx.Panel(self)
        sizer = wx.BoxSizer(wx.VERTICAL)

        # Subject selection
        self.subject_label = wx.StaticText(panel, label="Select Subject:")
        sizer.Add(self.subject_label, 0, wx.ALL | wx.EXPAND, 5)
        self.subject_select = wx.ComboBox(panel, style=wx.CB_READONLY)
        sizer.Add(self.subject_select, 0, wx.ALL | wx.EXPAND, 5)

        # Year group selection
        self.year_group_label = wx.StaticText(panel, label="Select Year Group:")
        sizer.Add(self.year_group_label, 0, wx.ALL | wx.EXPAND, 5)
        self.year_group_select = wx.ComboBox(panel, style=wx.CB_READONLY)
        sizer.Add(self.year_group_select, 0, wx.ALL | wx.EXPAND, 5)

        # Pupil name and pronouns
        self.name_label = wx.StaticText(panel, label="Pupil's First Name:")
        sizer.Add(self.name_label, 0, wx.ALL | wx.EXPAND, 5)
        self.name_entry = wx.TextCtrl(panel)
        sizer.Add(self.name_entry, 0, wx.ALL | wx.EXPAND, 5)

        self.pronouns_label = wx.StaticText(panel, label="Pupil's Pronouns:")
        sizer.Add(self.pronouns_label, 0, wx.ALL | wx.EXPAND, 5)
        self.pronouns_entry = wx.TextCtrl(panel)
        sizer.Add(self.pronouns_entry, 0, wx.ALL | wx.EXPAND, 5)

        # Additional comments
        self.additional_comments_label = wx.StaticText(panel, label="Additional Comments:")
        sizer.Add(self.additional_comments_label, 0, wx.ALL | wx.EXPAND, 5)
        self.additional_comments_text = wx.TextCtrl(panel, style=wx.TE_MULTILINE, size=(-1, 100))
        sizer.Add(self.additional_comments_text, 0, wx.ALL | wx.EXPAND, 5)

        # Generate report button
        self.generate_button = wx.Button(panel, label="Generate Report")
        sizer.Add(self.generate_button, 0, wx.ALL | wx.CENTER, 5)
        self.generate_button.Bind(wx.EVT_BUTTON, self.generate_report)

        # Report output
        self.report_text = wx.TextCtrl(panel, style=wx.TE_MULTILINE | wx.TE_READONLY, size=(-1, 150))
        sizer.Add(self.report_text, 0, wx.ALL | wx.EXPAND, 5)

        panel.SetSizer(sizer)

        # Load subjects and year groups
        self.load_subjects()
        self.load_year_groups()

        # Bind events
        self.subject_select.Bind(wx.EVT_COMBOBOX, self.show_category_dialog)
        self.year_group_select.Bind(wx.EVT_COMBOBOX, self.show_category_dialog)

        self.selected_comments = {}

    # Load subjects into the subject selection combobox
    def load_subjects(self):
        subjects = fetch_subjects()
        self.subject_map = {subject[1]: subject[0] for subject in subjects}
        self.subject_select.Set([subject[1] for subject in subjects])

    # Load year groups into the year group selection combobox
    def load_year_groups(self):
        year_groups = fetch_year_groups()
        self.year_group_map = {year_group[1]: year_group[0] for year_group in year_groups}
        self.year_group_select.Set([year_group[1] for year_group in year_groups])

    # Show the category selection dialog
    def show_category_dialog(self, event):
        subject_name = self.subject_select.GetValue()
        year_group_name = self.year_group_select.GetValue()
        if subject_name and year_group_name:
            subject_id = self.subject_map[subject_name]
            year_group_id = self.year_group_map[year_group_name]
            dialog = CategorySelectionDialog(self, subject_id, year_group_id)
            if dialog.ShowModal() == wx.ID_OK:
                self.selected_comments = {key: var.GetValue() for key, var in dialog.comment_vars.items()}
            dialog.Destroy()

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
            report = generate_report(name, pronouns, subject_id, year_group_id, additional_comments, self.selected_comments)
            self.report_text.SetValue(report)
        else:
            wx.MessageBox("Please select both subject and year group", "Error", wx.OK | wx.ICON_ERROR)

if __name__ == "__main__":
    app = wx.App(False)
    frame = Application()
    frame.Show()
    app.MainLoop()
