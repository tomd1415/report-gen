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

  it('rejects missing pronouns', async () => {
    const missingPronouns = await request(app)
      .post('/generate-report')
      .send({
        pronouns: '',
        subjectId: 1,
        yearGroupId: 2
      });

    expect(missingPronouns.status).toBe(400);
    expect(missingPronouns.body.message).toMatch(/Pronouns are required/i);
  });

  it('accepts a name-free request and leaves the placeholder for the client', async () => {
    // The current browser redacts the pupil name itself and never sends it, so
    // the server must not require a name and must not attempt a swap-back.
    models.Prompt.findOne.mockResolvedValue(null);
    models.SubjectContext.findOne.mockResolvedValue(null);
    openai.responses.parse.mockResolvedValueOnce({
      output_parsed: {
        paragraphs: [
          'PUPIL_NAME has studied algebra.',
          'PUPIL_NAME shows consistent effort.',
          'PUPIL_NAME demonstrates problem-solving.',
          'PUPIL_NAME should focus on revision.'
        ]
      }
    });

    const response = await request(app)
      .post('/generate-report')
      .send({
        pronouns: 'they/them',
        subjectId: 1,
        yearGroupId: 2,
        additionalComments: 'PUPIL_NAME worked hard.'
      });

    expect(response.status).toBe(200);
    expect(response.body.paragraphs).toHaveLength(4);
    expect(response.body.report).toContain('PUPIL_NAME has studied algebra');
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

    openai.responses.parse
      .mockResolvedValueOnce({ output_parsed: { flagged: [] } })
      .mockResolvedValueOnce({
        output_parsed: { paragraphs },
        _request_id: 'req_test'
      });

    const response = await request(app)
      .post('/generate-report')
      .send({
        pronouns: 'they/them',
        subjectId: 1,
        yearGroupId: 2,
        additionalComments: 'Extra note.',
        'Strengths / achievements': ['Works well in groups', 'Shows creativity']
      });

    expect(response.status).toBe(200);
    expect(response.body.paragraphs).toHaveLength(4);
    // The placeholder is returned intact: the browser holds the name and
    // restores it. The server never sees a name to swap back.
    expect(response.body.report).toContain('PUPIL_NAME has studied algebra');
    expect(response.body.report).toContain('\n\n');

    const prompt = openai.responses.parse.mock.calls[1][0].input[0].content;
    expect(prompt).toContain('Subject description (context only; do not repeat in the report). This description will be printed immediately before the report:');
    expect(prompt).toContain('Mathematics focusing on algebra and geometry.');
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

    openai.responses.parse.mockResolvedValueOnce({
      output_parsed: { paragraphs: ['p1', 'p2', 'p3', 'p4'] }
    });

    const response = await request(app)
      .post('/generate-report')
      .send({
        pronouns: 'they/them',
        subjectId: 1,
        yearGroupId: 2,
        wordLimit: 180
      });

    expect(response.status).toBe(200);
    const prompt = openai.responses.parse.mock.calls[0][0].input[0].content;
    expect(prompt).toContain('Target length: about 180 words total.');
  });

  it('returns 502 when OpenAI produces no usable output', async () => {
    models.Prompt.findOne.mockResolvedValue(null);
    models.SubjectContext.findOne.mockResolvedValue(null);
    openai.responses.parse.mockResolvedValue({});

    const response = await request(app)
      .post('/generate-report')
      .send({
        pronouns: 'they/them',
        subjectId: 1,
        yearGroupId: 2
      });

    expect(response.status).toBe(502);
    expect(response.body.message).toMatch(/complete 4-paragraph report/i);
  });

  it('returns 502 when OpenAI returns an incomplete report', async () => {
    models.Prompt.findOne.mockResolvedValue(null);
    models.SubjectContext.findOne.mockResolvedValue(null);
    openai.responses.parse.mockResolvedValue({
      output_parsed: { paragraphs: ['p1', 'p2', 'p3'] }
    });

    const response = await request(app)
      .post('/generate-report')
      .send({
        pronouns: 'they/them',
        subjectId: 1,
        yearGroupId: 2
      });

    expect(response.status).toBe(502);
    expect(response.body.message).toMatch(/complete 4-paragraph report/i);
  });

  it('returns 422 when relevance flags a selected comment', async () => {
    models.Prompt.findOne.mockResolvedValue(null);
    models.SubjectContext.findOne.mockResolvedValue({
      subjectDescription: 'History curriculum overview.',
      wordLimit: null
    });

    openai.responses.parse.mockResolvedValueOnce({
      output_parsed: {
        flagged: [
          {
            category: 'Topics studied / knowledge / skills acquired',
            comment: '3D modelling',
            reason: 'Not in subject description'
          }
        ]
      }
    });

    const response = await request(app)
      .post('/generate-report')
      .send({
        pronouns: 'they/them',
        subjectId: 1,
        yearGroupId: 2,
        'Topics studied / knowledge / skills acquired': ['3D modelling']
      });

    expect(response.status).toBe(422);
    expect(response.body.flagged).toHaveLength(1);
    expect(openai.responses.parse).toHaveBeenCalledTimes(1);
  });

  it('skips the target placeholder comment in relevance checks', async () => {
    models.Prompt.findOne.mockResolvedValue(null);
    models.SubjectContext.findOne.mockResolvedValue({
      subjectDescription: 'Mathematics curriculum overview.',
      wordLimit: null
    });

    openai.responses.parse
      .mockResolvedValueOnce({ output_parsed: { flagged: [] } })
      .mockResolvedValueOnce({
        output_parsed: { paragraphs: ['p1', 'p2', 'p3', 'p4'] }
      });

    const response = await request(app)
      .post('/generate-report')
      .send({
        pronouns: 'they/them',
        subjectId: 1,
        yearGroupId: 2,
        'Areas for development / targets toward end-of-year Teacher Target': [
          '***Generate a target for this pupil and add to the report***',
          'Needs to check work carefully'
        ]
      });

    expect(response.status).toBe(200);
    const relevancePrompt = openai.responses.parse.mock.calls[0][0].input[0].content;
    expect(relevancePrompt).toContain('Needs to check work carefully');
    const commentsSection = relevancePrompt.split('Comments to review')[1] || '';
    expect(commentsSection).not.toContain('***Generate a target for this pupil and add to the report***');
  });

  it('includes strength focus in the generation prompt', async () => {
    models.Prompt.findOne.mockResolvedValue(null);
    models.SubjectContext.findOne.mockResolvedValue(null);

    openai.responses.parse.mockResolvedValueOnce({
      output_parsed: { paragraphs: ['p1', 'p2', 'p3', 'p4'] }
    });

    const response = await request(app)
      .post('/generate-report')
      .send({
        pronouns: 'they/them',
        subjectId: 1,
        yearGroupId: 2,
        strengthFocus: [{ topic: 'Fractions', level: 'strong' }]
      });

    expect(response.status).toBe(200);
    const prompt = openai.responses.parse.mock.calls[0][0].input[0].content;
    expect(prompt).toContain('Subject strength focus for paragraph 3 (include at least one): Fractions (strong)');
  });

  it('refuses a request that transmits a pupil name', async () => {
    // The legacy name-present path was retired once the name-free client was
    // verified end to end. Rejecting rather than ignoring means a stale client
    // fails loudly instead of quietly transmitting a name the server discards.
    const response = await request(app)
      .post('/generate-report')
      .send({
        name: 'Alex Morgan',
        pronouns: 'they/them',
        subjectId: 1,
        yearGroupId: 2
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/no longer accepts a pupil name/i);
    expect(openai.responses.parse).not.toHaveBeenCalled();
  });

  it('passes browser-redacted free text through to both prompts unchanged', async () => {
    models.Prompt.findOne.mockResolvedValue(null);
    // A subject description plus a non-empty selection triggers the relevance
    // call, so this covers the relevance prompt and the generation prompt.
    models.SubjectContext.findOne.mockResolvedValue({
      subjectDescription: 'Mathematics curriculum overview.',
      wordLimit: null
    });

    openai.responses.parse
      .mockResolvedValueOnce({ output_parsed: { flagged: [] } })
      .mockResolvedValueOnce({ output_parsed: { paragraphs: ['p1', 'p2', 'p3', 'p4'] } });

    const response = await request(app)
      .post('/generate-report')
      .send({
        pronouns: 'they/them',
        subjectId: 1,
        yearGroupId: 2,
        additionalComments: 'PUPIL_NAME improved a lot this term.',
        strengthFocus: [{ topic: 'PUPIL_NAME excels at fractions', level: 'confident' }]
      });

    expect(response.status).toBe(200);
    expect(openai.responses.parse).toHaveBeenCalledTimes(2);

    const relevancePrompt = openai.responses.parse.mock.calls[0][0].input[0].content;
    expect(relevancePrompt).toContain('PUPIL_NAME excels at fractions');

    const prompt = openai.responses.parse.mock.calls[1][0].input[0].content;
    expect(prompt).toContain('PUPIL_NAME improved a lot this term.');
    expect(prompt).toContain('Subject strength focus for paragraph 3 (include at least one): PUPIL_NAME excels at fractions (confident)');
  });

  it('rejects too many strength focus items', async () => {
    models.Prompt.findOne.mockResolvedValue(null);
    models.SubjectContext.findOne.mockResolvedValue(null);

    const response = await request(app)
      .post('/generate-report')
      .send({
        pronouns: 'they/them',
        subjectId: 1,
        yearGroupId: 2,
        strengthFocus: [
          { topic: 'Topic 1', level: 'strong' },
          { topic: 'Topic 2', level: 'strong' },
          { topic: 'Topic 3', level: 'strong' },
          { topic: 'Topic 4', level: 'strong' },
          { topic: 'Topic 5', level: 'strong' },
          { topic: 'Topic 6', level: 'strong' }
        ]
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/strength focus items/i);
    expect(openai.responses.parse).not.toHaveBeenCalled();
  });

  it('rejects too many selected comments for a category', async () => {
    models.Prompt.findOne.mockResolvedValue(null);
    models.SubjectContext.findOne.mockResolvedValue(null);

    const response = await request(app)
      .post('/generate-report')
      .send({
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
