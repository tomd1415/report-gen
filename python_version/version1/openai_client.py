from openai import OpenAI
import csv

# Set up OpenAI
openai_client = OpenAI(api_key='sk-proj-NRXojKZoTDvNsFuhUH8WT3BlbkFJCbb0Gup2YMFD3iq8lRVS')

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

    response = openai_client.chat.completions.create(model="gpt-4o",
                                              messages=[{"role": "system", "content": "You are a helpful assistant."}, {"role": "user", "content": prompt}],
                                              max_tokens=500,
                                              temperature=0.7)

    report = response.choices[0].message.content.strip()
    return report.replace(placeholder, name)
