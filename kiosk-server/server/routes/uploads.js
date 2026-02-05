import { Router } from 'express';
import { requirePin } from '../middleware/auth.js';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join, resolve, extname } from 'node:path';

const router = Router();

const UPLOADS_DIR = resolve('data/uploads');

// Ensure uploads directory exists
if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

// POST /api/admin/uploads - Upload an image (base64 in JSON body)
router.post('/api/admin/uploads', requirePin, (req, res) => {
  const { data, filename } = req.body;
  if (!data) {
    return res.status(400).json({ error: 'No image data provided' });
  }

  // Parse data URL: "data:image/png;base64,iVBOR..."
  const match = data.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) {
    return res.status(400).json({ error: 'Invalid image data format. Expected a base64 data URL.' });
  }

  const mimeType = match[1];
  const base64Data = match[2];
  const buffer = Buffer.from(base64Data, 'base64');

  // 1MB limit
  if (buffer.length > 1024 * 1024) {
    return res.status(400).json({ error: 'Image too large. Max 1MB.' });
  }

  // Determine extension from mime type
  const extMap = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/svg+xml': '.svg', 'image/webp': '.webp' };
  const ext = extMap[mimeType] || extname(filename || '') || '.png';

  const uniqueName = `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`;
  const filePath = join(UPLOADS_DIR, uniqueName);

  writeFileSync(filePath, buffer);

  res.json({ path: `/api/uploads/${uniqueName}` });
});

// GET /api/uploads/:filename - Serve uploaded files (public)
router.get('/api/uploads/:filename', (req, res) => {
  const filename = req.params.filename;

  // Prevent directory traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filePath = join(UPLOADS_DIR, filename);
  if (!existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.sendFile(filePath);
});

export default router;
