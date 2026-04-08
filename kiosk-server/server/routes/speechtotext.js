import { Router } from 'express';
import { toFile } from 'openai';
import db from '../db.js';
import { createOpenAIClient, handleOpenAIError } from '../utils/openai.js';

const router = Router();

router.post('/transcribe', async (req, res) => {
  const { app_id, audio, mime_type } = req.body;
  if (!audio) {
    return res.status(400).json({ error: 'audio is required' });
  }

  // Resolve API key: per-app config → env var
  let apiKey = process.env.OPENAI_API_KEY;
  let endpointUrl = process.env.OPENAI_ENDPOINT_URL;

  if (app_id) {
    const appRecord = db.prepare('SELECT * FROM apps WHERE id = ?').get(app_id);
    if (appRecord) {
      if (appRecord.profile_id) {
        const profile = db.prepare('SELECT id FROM profiles WHERE id = ? AND account_id = ?').get(appRecord.profile_id, req.accountId);
        if (!profile) return res.status(404).json({ error: 'App not found' });
      }
      const config = JSON.parse(appRecord.config || '{}');
      apiKey = config.openai_api_key || apiKey;
      endpointUrl = config.openai_endpoint_url || endpointUrl;
    }
  }

  if (!apiKey) {
    return res.json({ error: 'api_key_missing' });
  }

  try {
    const openai = createOpenAIClient({ apiKey, endpointUrl });
    const buffer = Buffer.from(audio, 'base64');
    const isWav = mime_type === 'audio/wav';
    const filename = isWav ? 'audio.wav' : 'audio.webm';
    const type = isWav ? 'audio/wav' : 'audio/webm';
    const file = await toFile(buffer, filename, { type });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
    });

    res.json({ text: transcription.text });
  } catch (err) {
    handleOpenAIError(err, res, 'Speech-to-text');
  }
});

export default router;
