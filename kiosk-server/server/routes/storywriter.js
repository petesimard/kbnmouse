import { Router } from 'express';
import { createOpenAIClient, handleOpenAIError } from '../utils/openai.js';

const router = Router();

// Generate a story prompt
router.get('/prompt', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const endpointUrl = process.env.OPENAI_ENDPOINT_URL;

  if (!apiKey) {
    return res.json({ error: 'api_key_missing' });
  }

  try {
    const openai = createOpenAIClient({ apiKey, endpointUrl });

    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a creative writing prompt generator for kids ages 6-12. Generate a single fun, imaginative story idea in 1-2 sentences. The idea should be easy to understand and inspire creativity. Do not include instructions — just the story idea itself.',
        },
        {
          role: 'user',
          content: 'Give me a story idea.',
        },
      ],
    });

    const prompt = completion.choices[0]?.message?.content?.trim() || '';
    res.json({ prompt });
  } catch (err) {
    handleOpenAIError(err, res, '[StoryWriter] prompt');
  }
});

// Evaluate a child's story
router.post('/evaluate', async (req, res) => {
  const { prompt, story } = req.body;
  if (!prompt || !story) {
    return res.status(400).json({ error: 'prompt and story are required' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const endpointUrl = process.env.OPENAI_ENDPOINT_URL;

  if (!apiKey) {
    return res.json({ error: 'api_key_missing' });
  }

  try {
    const openai = createOpenAIClient({ apiKey, endpointUrl });

    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content:
            'You evaluate stories written by children ages 6-12. Be very lenient and encouraging. Only fail a story if it is gibberish, mostly copies the prompt, or is completely unrelated to the story idea. Respond with JSON only: {"pass": true} or {"pass": false, "feedback": "a short, kind suggestion"}. No other text.',
        },
        {
          role: 'user',
          content: `Story idea: ${prompt}\n\nChild's story:\n${story}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '';

    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      // If we can't parse the response, default to pass
      result = { pass: true };
    }

    res.json({
      pass: !!result.pass,
      feedback: result.feedback || '',
    });
  } catch (err) {
    handleOpenAIError(err, res, '[StoryWriter] evaluate');
  }
});

export default router;
