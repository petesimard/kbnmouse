import fs from 'fs/promises';

// Generate a PNG via OpenAI's image API and write it to disk.
// apiKey comes from the OPENAI_API_KEY environment variable.
export async function generateImage({ prompt, outputPath, apiKey, size = '1024x1024' }) {
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-image-1.5',
      prompt,
      n: 1,
      size,
      output_format: 'png',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI image API ${res.status}: ${body.slice(0, 500)}`);
  }

  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error('No image data in OpenAI response');
  await fs.writeFile(outputPath, Buffer.from(b64, 'base64'));
}
