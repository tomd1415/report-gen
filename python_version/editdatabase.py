import sqlite3

conn = sqlite3.connect('app.db')
cursor = conn.cursor()

cursor.execute('''
INSERT INTO Prompt (subject_id, year_group_id, prompt_part)
    VALUES( 1, 1, 'Generate a concision school report for a pupil. This is for Computing lessons and I would like it to be friendly and formal. I would like it to be between 100 and 170 words long and flow nicely with no repetition. Below are categories and comments to base the report on. There should be no headings on the report. It could have up to 3 paragraphs if necessary. Finish the report with **TEST COMPLETE**')
''')

conn.commit()
