import { Router } from 'express';
import OpenAI from 'openai';
import db from '../db.js';

const router = Router();

function getOpenAIConfig() {
  const apiKey = db.prepare("SELECT value FROM settings WHERE key = 'openai_api_key'").get()?.value;
  const endpointUrl = db.prepare("SELECT value FROM settings WHERE key = 'openai_endpoint_url'").get()?.value;
  return { apiKey, endpointUrl };
}

// Generate a story prompt
router.get('/prompt', async (req, res) => {
  const { apiKey, endpointUrl } = getOpenAIConfig();

  if (!apiKey) {
    return res.json({ error: 'api_key_missing' });
  }

  try {
    const openai = new OpenAI({
      apiKey,
      ...(endpointUrl ? { baseURL: endpointUrl } : {}),
    });

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
    console.error('[StoryWriter] prompt error:', err.message);
    if (err.status === 401) {
      return res.json({ error: 'api_key_invalid' });
    }
    res.status(500).json({ error: 'Failed to generate story prompt' });
  }
});

// Evaluate a child's story
router.post('/evaluate', async (req, res) => {
  const { prompt, story } = req.body;
  if (!prompt || !story) {
    return res.status(400).json({ error: 'prompt and story are required' });
  }

  const { apiKey, endpointUrl } = getOpenAIConfig();

  if (!apiKey) {
    return res.json({ error: 'api_key_missing' });
  }

  try {
    const openai = new OpenAI({
      apiKey,
      ...(endpointUrl ? { baseURL: endpointUrl } : {}),
    });

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
    console.error('[StoryWriter] evaluate error:', err.message);
    if (err.status === 401) {
      return res.json({ error: 'api_key_invalid' });
    }
    res.status(500).json({ error: 'Failed to evaluate story' });
  }
});

export default router;
