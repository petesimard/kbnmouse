import OpenAI from 'openai';

export function createOpenAIClient({ apiKey, endpointUrl }) {
  return new OpenAI({
    apiKey,
    ...(endpointUrl ? { baseURL: endpointUrl } : {}),
  });
}

export function handleOpenAIError(err, res, context = 'OpenAI API') {
  console.error(`${context} error:`, err.message);

  if (err.status === 401) {
    return res.json({ error: 'api_key_invalid' });
  }
  if (err.code === 'content_policy_violation' || err.message?.includes('content policy')) {
    return res.json({ error: 'content_policy', message: 'Your content was rejected due to content policy. Please try something different.' });
  }
  if (err.status === 429) {
    return res.json({ error: 'rate_limit', message: 'Too many requests. Please wait a moment and try again.' });
  }
  res.status(500).json({ error: 'generation_failed', message: `Failed to complete request. Please try again.` });
}
