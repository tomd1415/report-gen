import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

// Initialize Express
const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Configure OpenAI API
const openai = new OpenAI({
  apiKey: 'sk-proj-NRXojKZoTDvNsFuhUH8WT3BlbkFJCbb0Gup2YMFD3iq8lRVS'
});

app.post('/generate-report', async (req, res) => {
  const { name, pronouns, interestEngagement, independentStudy, programmingSkills, theoryUnderstanding, examPerformance, motivationFocus, problemSolving, classParticipation, targets, additionalComments } = req.body;
  
  let prompt = `
  Generate a comprehensive report for a Computer Science GCSE student. This should be written in a friendly but formal way and flow well. I do not want any headings and is should be concise and avoid repitition. Please use the information below:
  Puupil name: ${name} Pupils pronouns ${pronouns}

  `;
  if (interestEngagement) {
    prompt += `Interest and Engagement: ${interestEngagement}\n`;
  }
  if (independentStudy) {
    prompt += `Independent Study: ${independentStudy}\n`;
  }
  if (programmingSkills) {
    prompt += `Programming Skills: ${programmingSkills}\n`;
  }
  if (theoryUnderstanding) {
    prompt += `Theory Understanding: ${theoryUnderstanding}\n`;
  }
  if (examPerformance) {
    prompt += `Exam Performance: ${examPerformance}\n`;
  }
  if (motivationFocus) {
    prompt += `Motivation and Focus: ${motivationFocus}\n`;
  }
  if (problemSolving) {
    prompt += `Problem-Solving: ${problemSolving}\n`;
  }
  if (classParticipation) {
    prompt += `Class Participation: ${classParticipation}\n`;
  }
  if (additionalComments) {
    prompt += `Please weave in these Additional Comments: ${additionalComments}\n`;
  }
  prompt += `Pupils targets: ${targets}\n`;
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.7
    });

    const report = response.choices[0].message.content.trim();
    res.json({ report });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating report');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

