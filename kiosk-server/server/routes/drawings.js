import { Router } from 'express';
import db from '../db.js';
import { verifyProfileOwnership } from '../utils/profile.js';
import { createOpenAIClient, handleOpenAIError } from '../utils/openai.js';

const router = Router();

const STYLE_PROMPTS = {
  comic: 'Transform this children\'s drawing into a vibrant comic book illustration with bold outlines, halftone dots, and dynamic colors. Keep the same subject and composition.',
  anime: 'Transform this children\'s drawing into anime/manga art style with clean lines, expressive features, and cel-shading. Keep the same subject and composition.',
  realistic: 'Transform this children\'s drawing into a photorealistic rendering with natural lighting, textures, and depth. Keep the same subject and composition.',
  painting: 'Transform this children\'s drawing into a beautiful oil painting with visible brushstrokes, rich colors, and artistic composition. Keep the same subject and composition.',
};

// GET /api/drawings?profile=<id> — list drawings (thumbnails only, no full image_data)
router.get('/', (req, res) => {
  const profileId = req.query.profile;
  if (!profileId) {
    return res.status(400).json({ error: 'profile query param is required' });
  }
  if (!verifyProfileOwnership(profileId, req.accountId)) {
    return res.status(404).json({ error: 'Profile not found' });
  }
  const drawings = db.prepare(
    'SELECT id, name, thumbnail, created_at, updated_at FROM drawings WHERE profile_id = ? ORDER BY updated_at DESC'
  ).all(profileId);
  res.json(drawings);
});

// GET /api/drawings/:id — get full drawing (includes image_data)
router.get('/:id', (req, res) => {
  const drawing = db.prepare('SELECT * FROM drawings WHERE id = ?').get(req.params.id);
  if (!drawing) {
    return res.status(404).json({ error: 'Drawing not found' });
  }
  if (!verifyProfileOwnership(drawing.profile_id, req.accountId)) {
    return res.status(404).json({ error: 'Drawing not found' });
  }
  res.json(drawing);
});

// POST /api/drawings — save new drawing
router.post('/', (req, res) => {
  const { name, image_data, thumbnail, profile_id } = req.body;
  if (!name || !image_data || !profile_id) {
    return res.status(400).json({ error: 'name, image_data, and profile_id are required' });
  }
  if (!verifyProfileOwnership(profile_id, req.accountId)) {
    return res.status(404).json({ error: 'Profile not found' });
  }
  const result = db.prepare(
    'INSERT INTO drawings (name, profile_id, image_data, thumbnail) VALUES (?, ?, ?, ?)'
  ).run(name, profile_id, image_data, thumbnail || null);
  const drawing = db.prepare('SELECT id, name, thumbnail, created_at, updated_at FROM drawings WHERE id = ?').get(result.lastInsertRowid);
  res.json(drawing);
});

// PUT /api/drawings/:id — update existing drawing
router.put('/:id', (req, res) => {
  const drawing = db.prepare('SELECT * FROM drawings WHERE id = ?').get(req.params.id);
  if (!drawing) {
    return res.status(404).json({ error: 'Drawing not found' });
  }
  if (!verifyProfileOwnership(drawing.profile_id, req.accountId)) {
    return res.status(404).json({ error: 'Drawing not found' });
  }
  const { name, image_data, thumbnail } = req.body;
  db.prepare(
    'UPDATE drawings SET name = COALESCE(?, name), image_data = COALESCE(?, image_data), thumbnail = COALESCE(?, thumbnail), updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(name || null, image_data || null, thumbnail || null, req.params.id);
  const updated = db.prepare('SELECT id, name, thumbnail, created_at, updated_at FROM drawings WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/drawings/:id — delete drawing
router.delete('/:id', (req, res) => {
  const drawing = db.prepare('SELECT * FROM drawings WHERE id = ?').get(req.params.id);
  if (!drawing) {
    return res.status(404).json({ error: 'Drawing not found' });
  }
  if (!verifyProfileOwnership(drawing.profile_id, req.accountId)) {
    return res.status(404).json({ error: 'Drawing not found' });
  }
  db.prepare('DELETE FROM drawings WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/drawings/stylize — AI style transfer
router.post('/stylize', async (req, res) => {
  const { image_data, style, profile_id } = req.body;
  if (!image_data || !style || !profile_id) {
    return res.status(400).json({ error: 'image_data, style, and profile_id are required' });
  }
  if (!STYLE_PROMPTS[style]) {
    return res.status(400).json({ error: 'Invalid style' });
  }
  if (!verifyProfileOwnership(profile_id, req.accountId)) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const endpointUrl = process.env.OPENAI_ENDPOINT_URL;

  if (!apiKey) {
    return res.json({ error: 'api_key_missing' });
  }

  try {
    const openai = createOpenAIClient({ apiKey, endpointUrl });

    // Strip data URL prefix to get raw base64
    const base64 = image_data.replace(/^data:image\/\w+;base64,/, '');

    console.log('[Stylize] Applying style:', style);

    const response = await openai.responses.create({
      model: 'gpt-5',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_image',
              image_url: `data:image/png;base64,${base64}`,
            },
            {
              type: 'input_text',
              text: STYLE_PROMPTS[style],
            },
          ],
        },
      ],
      tools: [{ type: 'image_generation' }],
    });

    const imageOutput = response.output.find(o => o.type === 'image_generation_call');
    if (!imageOutput?.result) {
      return res.status(500).json({ error: 'generation_failed', message: 'No image was generated. Please try again.' });
    }
    res.json({ imageData: imageOutput.result });
  } catch (err) {
    handleOpenAIError(err, res, 'OpenAI stylize');
  }
});

export default router;
