import { useState, useRef, useCallback } from 'react';
import { z } from 'zod';
import { field, registerConfigSchema, computeDefaults } from './schemas.js';

export const configSchema = {
  sentences: field(z.number().int().min(2).max(10).default(5), {
    label: 'Story Length (sentences)',
    description: 'How many sentences long the generated story should be',
    type: 'number',
    min: 2,
    max: 10,
  }),
  num_questions: field(z.number().int().min(1).max(6).default(3), {
    label: 'Number of Questions',
    description: 'How many comprehension questions to ask',
    type: 'number',
    min: 1,
    max: 6,
  }),
};

registerConfigSchema('reading_comprehension', configSchema);

const DEFAULTS = computeDefaults(configSchema);

export default function ReadingComprehension({ config = {}, reward, onComplete, onBack }) {
  const sentences = config.sentences || DEFAULTS.sentences;
  const numQuestions = config.num_questions || DEFAULTS.num_questions;

  const [state, setState] = useState('LOADING'); // LOADING | ANSWERING | SUBMITTING | DONE
  const [story, setStory] = useState('');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [results, setResults] = useState([]); // per-question { correct, reason }
  const [error, setError] = useState(null);

  const hasFetched = useRef(false);
  if (!hasFetched.current) {
    hasFetched.current = true;
    fetch('/api/readingcomp/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentences, num_questions: numQuestions }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setStory(data.story);
        setQuestions(data.questions);
        setAnswers(data.questions.map(() => ''));
        setState('ANSWERING');
      })
      .catch(() => setError('network_error'));
  }

  const handleSubmit = useCallback(async () => {
    setState('SUBMITTING');
    try {
      const res = await fetch('/api/readingcomp/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story,
          items: questions.map((q, i) => ({ question: q, answer: answers[i] })),
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setResults(data.results);
      if (data.passed) {
        setState('DONE');
        onComplete('reading_comprehension', reward);
      } else {
        setState('ANSWERING');
      }
    } catch {
      setState('ANSWERING');
      setResults(questions.map(() => ({ correct: false, reason: 'Something went wrong. Please try again.' })));
    }
  }, [story, questions, answers, reward, onComplete]);

  const allAnswered = answers.every((a) => a.trim().length > 0);
  const canSubmit = allAnswered && state !== 'SUBMITTING';

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex flex-col items-center justify-center p-8">
        <div className="text-6xl mb-6">📖</div>
        <h2 className="text-3xl font-bold text-white mb-4">Reading Comprehension</h2>
        <p className="text-xl text-red-400 mb-8 text-center max-w-md">
          Could not connect to the AI service. Please try again later.
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

  if (state === 'LOADING') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex flex-col items-center justify-center p-8">
        <div className="text-6xl mb-6 animate-pulse">📖</div>
        <p className="text-2xl text-slate-300">Writing a story for you...</p>
      </div>
    );
  }

  if (state === 'DONE') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 flex flex-col items-center justify-center p-8">
        <div className="text-6xl mb-6">🎉</div>
        <h2 className="text-4xl font-bold text-white mb-3">Great reading!</h2>
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

  const hasFeedback = results.length > 0;

  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex flex-col p-6 overflow-hidden">
      <div className="flex items-center gap-4 mb-3 shrink-0">
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-700/80 hover:bg-slate-600/80 text-slate-300 rounded-lg transition-colors"
        >
          ← Back
        </button>
        <span className="text-3xl">📖</span>
        <h2 className="text-2xl font-bold text-white">Reading Comprehension</h2>
      </div>

      <div className="w-full max-w-3xl mx-auto flex flex-col min-h-0 flex-1 overflow-y-auto">
        <div className="w-full bg-slate-800/60 rounded-xl p-4 mb-4 border border-slate-700 shrink-0">
          <p className="text-sm text-slate-400 mb-1 uppercase tracking-wide font-medium">Story</p>
          <p className="text-lg text-white leading-relaxed">{story}</p>
        </div>

        {hasFeedback && results.every((r) => r.correct) === false && (
          <div className="w-full bg-amber-900/40 border border-amber-600/50 rounded-xl p-3 mb-4 shrink-0">
            <p className="text-amber-300">Some answers need another look. Fix the ones marked below and try again.</p>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {questions.map((q, i) => {
            const result = results[i];
            const wrong = result && !result.correct;
            const correct = result && result.correct;
            return (
              <div key={i} className="w-full">
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-lg font-bold text-indigo-300 shrink-0">{i + 1}.</span>
                  <p className="text-lg text-white">{q}</p>
                  {correct && <span className="text-emerald-400 text-xl shrink-0">✓</span>}
                </div>
                <textarea
                  value={answers[i]}
                  onChange={(e) => {
                    const next = [...answers];
                    next[i] = e.target.value;
                    setAnswers(next);
                  }}
                  disabled={state === 'SUBMITTING' || correct}
                  placeholder="Type your answer here..."
                  rows={2}
                  className={`w-full p-3 text-lg bg-slate-800 text-white border-2 rounded-xl outline-none resize-none transition-colors disabled:opacity-60 ${
                    wrong ? 'border-amber-500 focus:border-amber-400' : correct ? 'border-emerald-600' : 'border-slate-600 focus:border-blue-500'
                  }`}
                />
                {wrong && <p className="text-amber-300 mt-1 ml-1">{result.reason}</p>}
              </div>
            );
          })}
        </div>

        <div className="w-full flex items-center justify-end gap-4 mt-4 pb-2 shrink-0">
          {state === 'SUBMITTING' && <span className="text-slate-400 text-lg animate-pulse">Checking your answers...</span>}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-8 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white text-lg font-medium rounded-full transition-colors"
          >
            Submit Answers
          </button>
        </div>
      </div>
    </div>
  );
}
