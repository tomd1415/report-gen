const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

const OPENAI_API_KEY = 'your-openai-api-key-here';

app.post('/generate-report', async (req, res) => {
    const { name, pronouns, interestEngagement, independentStudy, programmingSkills, theoryUnderstanding, examPerformance, motivationFocus, problemSolving, classParticipation, targets } = req.body;

    const prompt = `
    Generate a comprehensive report for a Computer Science GCSE student.
    Name: ${name} (${pronouns})
    Interest and Engagement: ${interestEngagement}
    Independent Study: ${independentStudy}
    Programming Skills: ${programmingSkills}
    Theory Understanding: ${theoryUnderstanding}
    Exam Performance: ${examPerformance}
    Motivation and Focus: ${motivationFocus}
    Problem-Solving: ${problemSolving}
    Class Participation: ${classParticipation}
    Targets: ${targets}
    `;

    try {
        const response = await axios.post('https://api.openai.com/v1/engines/davinci-codex/completions', {
            prompt: prompt,
            max_tokens: 200,
            n: 1,
            stop: null,
            temperature: 0.7
        }, {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const report = response.data.choices[0].text.trim();
        res.json({ report });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error generating report');
    }
});

// Serve the HTML file from the public directory
app.use(express.static(path.join(__dirname, 'public')));

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

