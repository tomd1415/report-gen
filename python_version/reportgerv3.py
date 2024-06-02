import wx
import sqlite3
from openai import OpenAI
import os
import shutil

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
    UNIQUE(id, name)
)
''')

cursor.execute('''
CREATE TABLE IF NOT EXISTS YearGroup (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    UNIQUE(id, name)
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
        menuImportComments = filemenu.Append(wx.ID_ANY, "&Import Comments", "Import comment bank for a year group and subject combination")
        menuExportComments = filemenu.Append(wx.ID_ANY, "&Export Comments", "Export the comments for one year group and subject combination")
        filemenu.AppendSeparator()
        menuAbout = filemenu.Append(wx.ID_ABOUT, "&About","Information about this program.")
        filemenu.AppendSeparator()
        menuExit = filemenu.Append(wx.ID_EXIT,"E&xit"," Terminate the program")
        
        settingsmenu = wx.Menu()
        menuYearSelect = settingsmenu.Append(wx.ID_ANY, "Select &Year Group(s)", "Select the year groups to focus on for the session")
        menuSubjectSelect = settingsmenu.Append(wx.ID_ANY, "Select &Subject(s)", "Select the subjects to focus on for the session")
        menuEditCategories = settingsmenu.Append(wx.ID_ANY, "Edit Categories and Comments", "Edit the comments and categories for a year group and subject combination")
        menuSaveSettings = settingsmenu.Append(wx.ID_ANY, "Save Current Settings", "Save any changes to the settings")

        #creating the menubar
        menuBar = wx.MenuBar()
        menuBar.Append(filemenu,"&File") #adding the filemanu to the MenuBar
        menuBar.Append(settingsmenu, "&Settings")
        self.SetMenuBar(menuBar) # Adding the menubar to the Frame content.
        
        self.Bind(wx.EVT_MENU, self.OnOpen, menuOpen)
        self.Bind(wx.EVT_MENU, self.OnSave, menuSave)
        self.Bind(wx.EVT_MENU, self.OnSaveAs, menuSaveAs)
        self.Bind(wx.EVT_MENU, self.OnImport, menuImportComments)
        self.Bind(wx.EVT_MENU, self.OnExport, menuExportComments)
        self.Bind(wx.EVT_MENU, self.OnAbout, menuAbout)
        self.Bind(wx.EVT_MENU, self.OnExit, menuExit)
        
        self.Bind(wx.EVT_MENU, self.OnYearSelect, menuYearSelect)
        self.Bind(wx.EVT_MENU, self.OnSubjectSelect, menuSubjectSelect)
        self.Bind(wx.EVT_MENU, self.OnEditCategories, menuEditCategories)
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
        pass
    
    def OnExport(self, events):
        pass
    
    def OnYearSelect(self, events):
        pass
    
    def OnSubjectSelect(self, events):
        pass
    
    def OnEditCategories(self, events):
        pass

    def OnSaveSettings(self, events):
        pass

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
