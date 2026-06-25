import { Router } from 'express';
import { createOpenAIClient, handleOpenAIError } from '../utils/openai.js';

const router = Router();

// gpt-5-mini often wraps JSON in ```json fences or adds prose; extract the JSON object.
function parseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function getClient(res) {
  const apiKey = process.env.OPENAI_API_KEY;
  const endpointUrl = process.env.OPENAI_ENDPOINT_URL;
  if (!apiKey) {
    res.json({ error: 'api_key_missing' });
    return null;
  }
  return createOpenAIClient({ apiKey, endpointUrl });
}

// Generate a short story plus open-ended comprehension questions
router.post('/generate', async (req, res) => {
  const sentences = Math.min(Math.max(parseInt(req.body.sentences, 10) || 5, 2), 10);
  const numQuestions = Math.min(Math.max(parseInt(req.body.num_questions, 10) || 3, 1), 6);

  const openai = getClient(res);
  if (!openai) return;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: `You write short reading-comprehension stories for children ages 6-12. Write an original story exactly ${sentences} sentences long, with simple age-appropriate vocabulary. Then write ${numQuestions} open-ended comprehension questions that can be answered from the story (about characters, events, motivations, or details). Avoid yes/no questions. Respond with JSON only: {"story": "...", "questions": ["...", "..."]}. No other text.`,
        },
        { role: 'user', content: 'Generate a story and its questions.' },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '';
    const result = parseJson(raw);
    if (!result) {
      console.error('[ReadingComp] generate: unparseable response:', raw.slice(0, 200));
      return res.status(500).json({ error: 'generation_failed', message: 'Could not create a story. Please try again.' });
    }

    const questions = Array.isArray(result.questions) ? result.questions.filter((q) => typeof q === 'string') : [];
    if (!result.story || questions.length === 0) {
      return res.status(500).json({ error: 'generation_failed', message: 'Could not create a story. Please try again.' });
    }

    res.json({ story: result.story, questions });
  } catch (err) {
    handleOpenAIError(err, res, '[ReadingComp] generate');
  }
});

// Evaluate the child's answers against the story
router.post('/evaluate', async (req, res) => {
  const { story, items } = req.body;
  if (!story || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'story and items are required' });
  }

  const openai = getClient(res);
  if (!openai) return;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content:
            'You grade a child\'s reading-comprehension answers (ages 6-12). Be encouraging but require each answer to actually reflect understanding of the story. Accept correct answers in the child\'s own words; do not require exact wording. Mark an answer wrong if it is blank, gibberish, off-topic, or factually contradicts the story. For a wrong answer, the "reason" must be a short, kind hint that guides the child WITHOUT revealing or stating the correct answer — point them to the part of the story to re-read or the kind of detail to look for, but never include the actual answer. For each question return a result in the SAME order. Respond with JSON only: {"results": [{"correct": true} | {"correct": false, "reason": "..."}]}. No other text.',
        },
        {
          role: 'user',
          content: `Story:\n${story}\n\nAnswers:\n${items
            .map((it, i) => `${i + 1}. Question: ${it.question}\n   Answer: ${it.answer || '(blank)'}`)
            .join('\n')}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '';
    const parsed = parseJson(raw);
    if (!parsed) {
      console.error('[ReadingComp] evaluate: unparseable response:', raw.slice(0, 200));
      return res.status(500).json({ error: 'evaluation_failed', message: 'Could not check your answers. Please try again.' });
    }

    const results = (Array.isArray(parsed.results) ? parsed.results : []).map((r) => ({
      correct: !!r.correct,
      reason: r.correct ? '' : r.reason || 'Take another look at the story and try again.',
    }));

    res.json({ results, passed: results.length === items.length && results.every((r) => r.correct) });
  } catch (err) {
    handleOpenAIError(err, res, '[ReadingComp] evaluate');
  }
});

export default router;
