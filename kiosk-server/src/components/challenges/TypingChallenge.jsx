import { useState, useEffect, useRef, useCallback } from 'react';
import { z } from 'zod';
import { field, registerConfigSchema, computeDefaults } from './schemas.js';

export const configSchema = {
  difficulty: field(z.enum(['easy', 'medium', 'hard']).default('medium'), {
    label: 'Difficulty',
    description: 'Easy = short words, Medium = common words, Hard = longer words',
    type: 'select',
    options: [
      { value: 'easy', label: 'Easy' },
      { value: 'medium', label: 'Medium' },
      { value: 'hard', label: 'Hard' },
    ],
  }),
  total_words: field(z.number().int().min(1).max(50).default(10), {
    label: 'Number of Words',
    description: 'How many words to type correctly',
    type: 'number',
    min: 1,
    max: 50,
  }),
};

registerConfigSchema('typing', configSchema);

const TYPING_DEFAULTS = computeDefaults(configSchema);

const WORD_LISTS = {
  easy: [
    'cat', 'dog', 'sun', 'hat', 'cup', 'red', 'big', 'run', 'hop', 'sit',
    'bed', 'box', 'car', 'fish', 'ball', 'tree', 'book', 'hand', 'star', 'moon',
    'bird', 'frog', 'cake', 'rain', 'snow', 'door', 'egg', 'milk', 'sock', 'toy',
    'bus', 'pen', 'pig', 'bee', 'ant', 'cow', 'fox', 'hen', 'jam', 'log',
    'map', 'net', 'nut', 'pot', 'rug', 'van', 'web', 'bat', 'bug', 'zip',
  ],
  medium: [
    'apple', 'banana', 'castle', 'dragon', 'forest', 'guitar', 'happy', 'island',
    'jungle', 'kitten', 'lemon', 'night', 'ocean', 'planet', 'queen', 'rabbit',
    'sunset', 'tiger', 'village', 'window', 'yellow', 'zebra', 'garden', 'rocket',
    'pirate', 'magic', 'cloud', 'bridge', 'dolphin', 'flower', 'giant', 'hero',
    'monkey', 'pepper', 'silver', 'travel', 'wonder', 'basket', 'candle', 'desert',
    'frozen', 'golden', 'market', 'puzzle', 'rescue', 'thunder', 'valley', 'bubble',
    'orange', 'stream',
  ],
  hard: [
    'adventure', 'butterfly', 'chocolate', 'dinosaur', 'elephant', 'fantastic',
    'giraffe', 'happiness', 'important', 'jellyfish', 'kangaroo', 'lightning',
    'mushroom', 'notebook', 'orchestra', 'pineapple', 'question', 'rectangle',
    'snowflake', 'treasure', 'umbrella', 'volleyball', 'waterfall', 'xylophone',
    'yesterday', 'astronaut', 'beautiful', 'carpenter', 'dangerous', 'furniture',
    'invisible', 'knowledge', 'landscape', 'marvelous', 'nightmare', 'parachute',
    'raspberry', 'submarine', 'telephone', 'wonderful', 'cardboard', 'discovery',
    'education', 'crocodile', 'breakfast', 'halloween', 'newspaper', 'structure',
    'community', 'trampoline',
  ],
};

function pickRandomWords(count, difficulty) {
  const list = WORD_LISTS[difficulty] || WORD_LISTS.medium;
  const shuffled = [...list].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export default function TypingChallenge({ config = {}, reward, onComplete, onBack }) {
  const totalWords = config.total_words || TYPING_DEFAULTS.total_words;
  const difficulty = config.difficulty || TYPING_DEFAULTS.difficulty;

  const [words] = useState(() => pickRandomWords(totalWords, difficulty));
  const [input, setInput] = useState('');
  const [progress, setProgress] = useState(0);
  const [shake, setShake] = useState(false);
  const [done, setDone] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [progress]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (input.trim().toLowerCase() === words[progress].toLowerCase()) {
      const next = progress + 1;
      if (next >= totalWords) {
        setDone(true);
        onComplete('typing', reward);
      } else {
        setProgress(next);
        setInput('');
      }
    } else {
      setShake(true);
      setInput('');
      setTimeout(() => setShake(false), 500);
    }
  }, [input, words, progress, reward, onComplete, totalWords]);

  if (done) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex flex-col items-center justify-center p-8">
      <button
        onClick={onBack}
        className="absolute top-6 left-6 px-4 py-2 bg-slate-700/80 hover:bg-slate-600/80 text-slate-300 rounded-lg transition-colors"
      >
        ← Back
      </button>

      <div className="text-slate-400 text-xl mb-8">
        {progress + 1} / {totalWords}
      </div>

      <div className={`text-7xl font-bold text-white mb-8 transition-transform ${shake ? 'animate-shake' : ''}`}>
        {words[progress]}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-4 items-center">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className={`w-64 text-4xl text-center py-3 rounded-xl bg-slate-800 text-white border-2 transition-colors outline-none ${
            shake ? 'border-red-500' : 'border-slate-600 focus:border-blue-500'
          }`}
          autoComplete="off"
          autoFocus
        />
        <button
          type="submit"
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white text-2xl font-medium rounded-xl transition-colors"
        >
          Check
        </button>
      </form>

      <div className="w-80 mt-10 bg-slate-800 rounded-full h-3">
        <div
          className="bg-emerald-500 h-3 rounded-full transition-all duration-300"
          style={{ width: `${(progress / totalWords) * 100}%` }}
        />
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-10px); }
          80% { transform: translateX(10px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
}
