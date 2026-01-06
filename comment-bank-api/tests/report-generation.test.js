import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerRoutes } from '../src/routes/index.js';

const createTestApp = ({ models, openai }) => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = { user: { id: 1, username: 'test', isAdmin: true } };
    next();
  });
  registerRoutes(app, { models, openai });
  return app;
};

describe('generate-report', () => {
  let openai;
  let models;
  let app;

  beforeEach(() => {
    openai = {
      responses: {
        parse: vi.fn()
      }
    };
    models = {
      Prompt: { findOne: vi.fn() },
      SubjectContext: { findOne: vi.fn() }
    };
    app = createTestApp({ models, openai });
  });

  it('rejects missing name or pronouns', async () => {
    const missingName = await request(app)
      .post('/generate-report')
      .send({
        name: '',
        pronouns: 'they/them',
        subjectId: 1,
        yearGroupId: 2
      });

    expect(missingName.status).toBe(400);
    expect(missingName.body.message).toMatch(/Name and pronouns are required/i);

    const missingPronouns = await request(app)
      .post('/generate-report')
      .send({
        name: 'Alex',
        pronouns: '',
        subjectId: 1,
        yearGroupId: 2
      });

    expect(missingPronouns.status).toBe(400);
    expect(missingPronouns.body.message).toMatch(/Name and pronouns are required/i);
  });

  it('builds a 4-paragraph report and replaces placeholders', async () => {
    const paragraphs = [
      'PUPIL_NAME has studied algebra and geometry.',
      'PUPIL_NAME shows consistent effort and attendance.',
      'PUPIL_NAME demonstrates strong problem-solving.',
      'PUPIL_NAME should focus on revision targets.'
    ];

    models.Prompt.findOne.mockResolvedValue({ promptPart: 'Custom base prompt.' });
    models.SubjectContext.findOne.mockResolvedValue({
      subjectDescription: 'Mathematics focusing on algebra and geometry.',
      wordLimit: 140
    });

    openai.responses.parse.mockResolvedValue({
      output_parsed: { paragraphs },
      _request_id: 'req_test'
    });

    const response = await request(app)
      .post('/generate-report')
      .send({
        name: 'Alex',
        pronouns: 'they/them',
        subjectId: 1,
        yearGroupId: 2,
        additionalComments: 'Extra note.',
        'Strengths / achievements': ['Works well in groups', 'Shows creativity']
      });

    expect(response.status).toBe(200);
    expect(response.body.paragraphs).toHaveLength(4);
    expect(response.body.report).toContain('Alex has studied algebra');
    expect(response.body.report).toContain('\n\n');
    expect(response.body.report).not.toContain('PUPIL_NAME');

    const prompt = openai.responses.parse.mock.calls[0][0].input[0].content;
    expect(prompt).toContain('Subject description (context only; do not repeat in the report): Mathematics focusing on algebra and geometry.');
    expect(prompt).toContain('Target length: about 140 words total.');
    expect(prompt).toContain('Strengths / achievements: Works well in groups; Shows creativity');
    expect(prompt).toContain('PUPIL_NAME');
    expect(prompt).not.toContain('Alex');
  });

  it('prefers an explicit word limit over the subject default', async () => {
    models.Prompt.findOne.mockResolvedValue({ promptPart: 'Base prompt.' });
    models.SubjectContext.findOne.mockResolvedValue({
      subjectDescription: 'Science curriculum overview.',
      wordLimit: 140
    });

    openai.responses.parse.mockResolvedValue({
      output_parsed: { paragraphs: ['p1', 'p2', 'p3', 'p4'] }
    });

    const response = await request(app)
      .post('/generate-report')
      .send({
        name: 'Alex',
        pronouns: 'they/them',
        subjectId: 1,
        yearGroupId: 2,
        wordLimit: 180
      });

    expect(response.status).toBe(200);
    const prompt = openai.responses.parse.mock.calls[0][0].input[0].content;
    expect(prompt).toContain('Target length: about 180 words total.');
  });

  it('returns 500 when OpenAI produces no usable output', async () => {
    models.Prompt.findOne.mockResolvedValue(null);
    models.SubjectContext.findOne.mockResolvedValue(null);
    openai.responses.parse.mockResolvedValue({});

    const response = await request(app)
      .post('/generate-report')
      .send({
        name: 'Alex',
        pronouns: 'they/them',
        subjectId: 1,
        yearGroupId: 2
      });

    expect(response.status).toBe(500);
  });

  it('rejects too many selected comments for a category', async () => {
    models.Prompt.findOne.mockResolvedValue(null);
    models.SubjectContext.findOne.mockResolvedValue(null);

    const response = await request(app)
      .post('/generate-report')
      .send({
        name: 'Alex',
        pronouns: 'they/them',
        subjectId: 1,
        yearGroupId: 2,
        'Strengths / achievements': [
          'Comment 1',
          'Comment 2',
          'Comment 3',
          'Comment 4',
          'Comment 5',
          'Comment 6',
          'Comment 7',
          'Comment 8',
          'Comment 9'
        ]
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/Too many comments selected/i);
    expect(openai.responses.parse).not.toHaveBeenCalled();
  });
});
