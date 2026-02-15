import { Router } from 'express';
import OpenAI from 'openai';
import db from '../db.js';

const router = Router();

// Send message to chatbot (public - uses app's API key)
router.post('/message', async (req, res) => {
  const { app_id, messages } = req.body;
  if (!app_id || !messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'app_id and messages array are required' });
  }

  const appRecord = db.prepare('SELECT * FROM apps WHERE id = ?').get(app_id);
  if (!appRecord) {
    return res.status(404).json({ error: 'App not found' });
  }
  if (!appRecord.profile_id) {
    return res.status(404).json({ error: 'App not found' });
  }
  const profile = db.prepare('SELECT id FROM profiles WHERE id = ? AND account_id = ?').get(appRecord.profile_id, req.accountId);
  if (!profile) {
    return res.status(404).json({ error: 'App not found' });
  }

  const config = JSON.parse(appRecord.config || '{}');

  // Resolve API key and endpoint: per-app config overrides env vars
  const apiKey = config.openai_api_key || process.env.OPENAI_API_KEY;
  const endpointUrl = config.openai_endpoint_url || process.env.OPENAI_ENDPOINT_URL;

  if (!apiKey) {
    return res.json({ error: 'api_key_missing' });
  }

  try {
    const openai = new OpenAI({
      apiKey,
      ...(endpointUrl ? { baseURL: endpointUrl } : {}),
    });

    // Prepend system prompt if configured
    const systemPrompt = config.system_prompt ?? 'You are a friendly, helpful assistant for children. Keep your responses simple, age-appropriate, and encouraging. Avoid any inappropriate content, violence, or scary topics. Be patient and explain things in a way that is easy to understand. If asked about something inappropriate, politely redirect to a safer topic.';
    const model = config.model || 'gpt-5-mini';

    console.log('[ChatBot] Model:', model);
    console.log('[ChatBot] System prompt:', systemPrompt);

    const messagesWithSystem = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    const completion = await openai.chat.completions.create({
      model,
      messages: messagesWithSystem,
    });

    const response = completion.choices[0]?.message?.content || '';
    res.json({ response });
  } catch (err) {
    console.error('OpenAI API error:', err.message);
    if (err.status === 401) {
      return res.json({ error: 'api_key_invalid' });
    }
    res.status(500).json({ error: 'Failed to get response from AI' });
  }
});

export default router;
