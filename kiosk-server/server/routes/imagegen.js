import { Router } from 'express';
import db from '../db.js';
import { createOpenAIClient, handleOpenAIError } from '../utils/openai.js';

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
    const openai = createOpenAIClient({ apiKey, endpointUrl });

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
    handleOpenAIError(err, res, 'OpenAI API');
  }
});

export default router;
