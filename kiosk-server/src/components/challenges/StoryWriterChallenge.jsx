import { useState, useRef, useCallback } from 'react';
import { z } from 'zod';
import { field, registerConfigSchema, computeDefaults } from './schemas.js';

export const configSchema = {
  min_characters: field(z.number().int().min(20).max(2000).default(100), {
    label: 'Minimum Characters',
    description: 'Minimum number of characters the child must write',
    type: 'number',
    min: 20,
    max: 2000,
  }),
};

registerConfigSchema('story_writer', configSchema);

const DEFAULTS = computeDefaults(configSchema);

export default function StoryWriterChallenge({ config = {}, reward, onComplete, onBack }) {
  const minChars = config.min_characters || DEFAULTS.min_characters;

  const [state, setState] = useState('LOADING'); // LOADING | WRITING | SUBMITTING | REJECTED | DONE
  const [prompt, setPrompt] = useState('');
  const [story, setStory] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState(null);
  const textareaRef = useRef(null);

  // Fetch prompt on mount
  const hasFetched = useRef(false);
  if (!hasFetched.current) {
    hasFetched.current = true;
    fetch('/api/storywriter/prompt')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setPrompt(data.prompt);
        setState('WRITING');
      })
      .catch(() => {
        setError('network_error');
      });
  }

  const handleSubmit = useCallback(async () => {
    setState('SUBMITTING');
    try {
      const res = await fetch('/api/storywriter/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, story }),
      });
      const data = await res.json();
      if (data.error) {
        setFeedback(data.error);
        setState('REJECTED');
        return;
      }
      if (data.pass) {
        setState('DONE');
        onComplete('story_writer', reward);
      } else {
        setFeedback(data.feedback || 'Try to write more about the story idea.');
        setState('REJECTED');
      }
    } catch {
      setFeedback('Something went wrong. Please try again.');
      setState('REJECTED');
    }
  }, [prompt, story, reward, onComplete]);

  const canSubmit = story.length >= minChars && state !== 'SUBMITTING';

  // Error state (API key missing/invalid or network error)
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex flex-col items-center justify-center p-8">
        <div className="text-6xl mb-6">✏️</div>
        <h2 className="text-3xl font-bold text-white mb-4">Story Writer</h2>
        <p className="text-xl text-red-400 mb-8 text-center max-w-md">
          {error === 'api_key_missing'
            ? 'No AI API key is configured. Ask a parent to add one in Settings.'
            : error === 'api_key_invalid'
              ? 'The AI API key is invalid. Ask a parent to check Settings.'
              : 'Could not connect to the AI service. Please try again later.'}
        </p>
        <button
          onClick={onBack}
          className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white text-xl font-medium rounded-full transition-colors"
        >
          ← Back
        </button>
      </div>
    );
  }

  // Loading state
  if (state === 'LOADING') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex flex-col items-center justify-center p-8">
        <div className="text-6xl mb-6 animate-pulse">✏️</div>
        <p className="text-2xl text-slate-300">Thinking of a story idea...</p>
      </div>
    );
  }

  // Done state
  if (state === 'DONE') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 flex flex-col items-center justify-center p-8">
        <div className="text-6xl mb-6">🎉</div>
        <h2 className="text-4xl font-bold text-white mb-3">Great job!</h2>
        <p className="text-2xl text-emerald-400 mb-8">You earned +{reward} bonus minutes!</p>
        <button
          onClick={onBack}
          className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white text-xl font-medium rounded-full transition-colors"
        >
          Back to Challenges
        </button>
      </div>
    );
  }

  // Writing / Rejected / Submitting states
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex flex-col items-center p-8">
      <button
        onClick={onBack}
        className="absolute top-6 left-6 px-4 py-2 bg-slate-700/80 hover:bg-slate-600/80 text-slate-300 rounded-lg transition-colors"
      >
        ← Back
      </button>

      <div className="w-full max-w-2xl mt-16 flex flex-col items-center">
        <div className="text-5xl mb-4">✏️</div>
        <h2 className="text-3xl font-bold text-white mb-6">Story Writer</h2>

        <div className="w-full bg-slate-800/60 rounded-xl p-5 mb-6 border border-slate-700">
          <p className="text-sm text-slate-400 mb-1 uppercase tracking-wide font-medium">Story Idea</p>
          <p className="text-xl text-white leading-relaxed">{prompt}</p>
        </div>

        {state === 'REJECTED' && feedback && (
          <div className="w-full bg-amber-900/40 border border-amber-600/50 rounded-xl p-4 mb-4">
            <p className="text-amber-300 text-lg">{feedback}</p>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={story}
          onChange={(e) => setStory(e.target.value)}
          placeholder="Write your story here..."
          disabled={state === 'SUBMITTING'}
          className="w-full h-64 p-4 text-lg bg-slate-800 text-white border-2 border-slate-600 focus:border-blue-500 rounded-xl outline-none resize-none transition-colors disabled:opacity-50"
          autoFocus
        />

        <div className="w-full flex items-center justify-between mt-3 mb-6">
          <span className={`text-lg ${story.length >= minChars ? 'text-emerald-400' : 'text-slate-400'}`}>
            {story.length} / {minChars} characters
          </span>
          {state === 'SUBMITTING' && (
            <span className="text-slate-400 text-lg animate-pulse">Checking your story...</span>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="px-10 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xl font-medium rounded-full transition-colors"
        >
          Submit Story
        </button>
      </div>
    </div>
  );
}
