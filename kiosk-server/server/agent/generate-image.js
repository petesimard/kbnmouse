#!/usr/bin/env node
// Standalone script for generating images using Google Gemini (Nano Banana)
// Usage: node generate-image.js <google_api_key> "<prompt>" "<output_path>"

import { GoogleGenerativeAI } from '@google/generative-ai';
import { writeFile } from 'fs/promises';

const [,, apiKey, prompt, outputPath] = process.argv;

if (!apiKey || !prompt || !outputPath) {
  console.error('Usage: node generate-image.js <google_api_key> "<prompt>" "<output_path>"');
  process.exit(1);
}

try {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  });

  const result = await model.generateContent(prompt);
  const response = result.response;

  // Find the image part in the response
  let saved = false;
  for (const candidate of response.candidates || []) {
    for (const part of candidate.content?.parts || []) {
      if (part.inlineData) {
        const imageData = Buffer.from(part.inlineData.data, 'base64');
        await writeFile(outputPath, imageData);
        console.log(outputPath);
        saved = true;
        break;
      }
    }
    if (saved) break;
  }

  if (!saved) {
    console.error('No image was generated in the response');
    process.exit(1);
  }
} catch (err) {
  console.error('Image generation failed:', err.message);
  process.exit(1);
}
