import { Router } from 'express';
import OpenAI from 'openai';
import db from '../db.js';

const router = Router();

// Generate image (public - uses app's API key)
router.post('/generate', async (req, res) => {
  const { app_id, prompt } = req.body;
  if (!app_id || !prompt) {
    return res.status(400).json({ error: 'app_id and prompt are required' });
  }

  const appRecord = db.prepare('SELECT * FROM apps WHERE id = ?').get(app_id);
  if (!appRecord) {
    return res.status(404).json({ error: 'App not found' });
  }

  const config = JSON.parse(appRecord.config || '{}');

  // Resolve API key and endpoint: per-app config overrides global settings
  const globalApiKey = db.prepare("SELECT value FROM settings WHERE key = 'openai_api_key'").get()?.value;
  const globalEndpoint = db.prepare("SELECT value FROM settings WHERE key = 'openai_endpoint_url'").get()?.value;

  const apiKey = config.openai_api_key || globalApiKey;
  const endpointUrl = config.openai_endpoint_url || globalEndpoint;

  if (!apiKey) {
    return res.json({ error: 'api_key_missing' });
  }

  try {
    const openai = new OpenAI({
      apiKey,
      ...(endpointUrl ? { baseURL: endpointUrl } : {}),
    });

    const size = config.image_size || '1024x1024';
    const quality = config.image_quality || 'standard';
    const style = config.image_style || 'vivid';

    console.log('[ImageGen] Generating image with DALL-E 3');
    console.log('[ImageGen] Size:', size, 'Quality:', quality, 'Style:', style);
    console.log('[ImageGen] Prompt:', prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''));

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size,
      quality,
      style,
      response_format: 'b64_json',
    });

    const imageData = response.data[0].b64_json;
    const revisedPrompt = response.data[0].revised_prompt;

    res.json({ imageData, revisedPrompt });
  } catch (err) {
    console.error('OpenAI API error:', err.message);

    if (err.status === 401) {
      return res.json({ error: 'api_key_invalid' });
    }

    if (err.code === 'content_policy_violation' || err.message?.includes('content policy')) {
      return res.json({ error: 'content_policy', message: 'Your prompt was rejected due to content policy. Please try a different prompt.' });
    }

    if (err.status === 429) {
      return res.json({ error: 'rate_limit', message: 'Too many requests. Please wait a moment and try again.' });
    }

    res.status(500).json({ error: 'generation_failed', message: 'Failed to generate image. Please try again.' });
  }
});

export default router;
