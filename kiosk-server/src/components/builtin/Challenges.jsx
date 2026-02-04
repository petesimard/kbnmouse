import { useState, useEffect, useRef, useCallback } from 'react';

export const meta = { key: 'challenges', name: 'Challenges', icon: '🏆', description: 'Earn bonus playtime' };

const WORD_LIST = [
  'apple', 'banana', 'castle', 'dragon', 'elephant',
  'forest', 'guitar', 'happy', 'island', 'jungle',
  'kitten', 'lemon', 'mountain', 'night', 'ocean',
  'planet', 'queen', 'rabbit', 'sunset', 'tiger',
  'umbrella', 'village', 'window', 'yellow', 'zebra',
  'garden', 'rocket', 'pirate', 'magic', 'cloud',
  'bridge', 'dolphin', 'flower', 'giant', 'hero',
];

const TOTAL_PROBLEMS = 10;

function generateMathProblem() {
  const a = Math.floor(Math.random() * 90) + 10;
  const b = Math.floor(Math.random() * 90) + 10;
  return { a, b, answer: a + b };
}

function pickRandomWords(count) {
  const shuffled = [...WORD_LIST].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// --- Sub-screens ---

function ChallengeList({ bonusMinutes, reward, onSelectChallenge }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex flex-col items-center justify-center p-8">
      <div className="text-center mb-12">
        <div className="text-6xl mb-4">🏆</div>
        <h1 className="text-4xl font-bold text-white mb-3">Challenges</h1>
        <div className="text-2xl text-emerald-400 font-semibold">
          Bonus Time Today: +{bonusMinutes} minutes
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl w-full">
        <button
          onClick={() => onSelectChallenge('math')}
          className="bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-2xl p-8 text-center transition-all hover:scale-105"
        >
          <div className="text-5xl mb-4">➕</div>
          <div className="text-xl font-bold text-white mb-2">Math</div>
          <div className="text-slate-400">Solve {TOTAL_PROBLEMS} addition problems</div>
          <div className="mt-3 text-emerald-400 font-semibold">+{reward} min</div>
        </button>

        <button
          onClick={() => onSelectChallenge('typing')}
          className="bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-2xl p-8 text-center transition-all hover:scale-105"
        >
          <div className="text-5xl mb-4">⌨️</div>
          <div className="text-xl font-bold text-white mb-2">Typing</div>
          <div className="text-slate-400">Type {TOTAL_PROBLEMS} words correctly</div>
          <div className="mt-3 text-emerald-400 font-semibold">+{reward} min</div>
        </button>
      </div>
    </div>
  );
}

function MathChallenge({ reward, onComplete, onBack }) {
  const [problem, setProblem] = useState(generateMathProblem);
  const [input, setInput] = useState('');
  const [progress, setProgress] = useState(0);
  const [shake, setShake] = useState(false);
  const [done, setDone] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [problem]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    const guess = parseInt(input, 10);
    if (guess === problem.answer) {
      const next = progress + 1;
      if (next >= TOTAL_PROBLEMS) {
        setDone(true);
        onComplete('math', reward);
      } else {
        setProgress(next);
        setProblem(generateMathProblem());
        setInput('');
      }
    } else {
      setShake(true);
      setInput('');
      setTimeout(() => setShake(false), 500);
    }
  }, [input, problem, progress, reward, onComplete]);

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
        {progress + 1} / {TOTAL_PROBLEMS}
      </div>

      <div className={`text-7xl font-bold text-white mb-8 font-mono transition-transform ${shake ? 'animate-shake' : ''}`}>
        {problem.a} + {problem.b} = ?
      </div>

      <form onSubmit={handleSubmit} className="flex gap-4 items-center">
        <input
          ref={inputRef}
          type="number"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className={`w-40 text-4xl text-center font-mono py-3 rounded-xl bg-slate-800 text-white border-2 transition-colors outline-none ${
            shake ? 'border-red-500' : 'border-slate-600 focus:border-blue-500'
          }`}
          autoFocus
        />
        <button
          type="submit"
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white text-2xl font-medium rounded-xl transition-colors"
        >
          Check
        </button>
      </form>

      {/* Progress bar */}
      <div className="w-80 mt-10 bg-slate-800 rounded-full h-3">
        <div
          className="bg-emerald-500 h-3 rounded-full transition-all duration-300"
          style={{ width: `${(progress / TOTAL_PROBLEMS) * 100}%` }}
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
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
      `}</style>
    </div>
  );
}

function TypingChallenge({ reward, onComplete, onBack }) {
  const [words] = useState(() => pickRandomWords(TOTAL_PROBLEMS));
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
      if (next >= TOTAL_PROBLEMS) {
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
  }, [input, words, progress, reward, onComplete]);

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
        {progress + 1} / {TOTAL_PROBLEMS}
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

      {/* Progress bar */}
      <div className="w-80 mt-10 bg-slate-800 rounded-full h-3">
        <div
          className="bg-emerald-500 h-3 rounded-full transition-all duration-300"
          style={{ width: `${(progress / TOTAL_PROBLEMS) * 100}%` }}
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

// --- Main Component ---

function Challenges() {
  const [screen, setScreen] = useState('list');
  const [bonusMinutes, setBonusMinutes] = useState(0);
  const [reward, setReward] = useState(10);

  const fetchBonusTime = useCallback(async () => {
    try {
      const res = await fetch('/api/bonus-time');
      const data = await res.json();
      setBonusMinutes(data.today_bonus_minutes);
    } catch (err) {
      console.error('Failed to fetch bonus time:', err);
    }
  }, []);

  const fetchReward = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/challenge-bonus-minutes');
      const data = await res.json();
      setReward(data.minutes);
    } catch (err) {
      console.error('Failed to fetch challenge reward:', err);
    }
  }, []);

  useEffect(() => {
    fetchBonusTime();
    fetchReward();
  }, [fetchBonusTime, fetchReward]);

  const handleComplete = useCallback(async (challengeType, minutesAwarded) => {
    try {
      const res = await fetch('/api/challenges/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_type: challengeType, minutes_awarded: minutesAwarded }),
      });
      const data = await res.json();
      setBonusMinutes(data.today_bonus_minutes);
    } catch (err) {
      console.error('Failed to record challenge completion:', err);
    }
  }, []);

  const handleBack = useCallback(() => {
    setScreen('list');
  }, []);

  if (screen === 'math') {
    return <MathChallenge reward={reward} onComplete={handleComplete} onBack={handleBack} />;
  }
  if (screen === 'typing') {
    return <TypingChallenge reward={reward} onComplete={handleComplete} onBack={handleBack} />;
  }

  return (
    <ChallengeList
      bonusMinutes={bonusMinutes}
      reward={reward}
      onSelectChallenge={setScreen}
    />
  );
}

export default Challenges;
