import { useState, useEffect, useRef, useCallback } from 'react';

const DEFAULT_TOTAL = 10;
const DEFAULT_MIN = 10;
const DEFAULT_MAX = 99;

function generateMathProblem(min, max) {
  const a = Math.floor(Math.random() * (max - min + 1)) + min;
  const b = Math.floor(Math.random() * (max - min + 1)) + min;
  return { a, b, answer: a + b };
}

export default function MathChallenge({ config = {}, reward, onComplete, onBack }) {
  const totalProblems = config.total_problems || DEFAULT_TOTAL;
  const minNum = config.min_number || DEFAULT_MIN;
  const maxNum = config.max_number || DEFAULT_MAX;

  const [problem, setProblem] = useState(() => generateMathProblem(minNum, maxNum));
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
      if (next >= totalProblems) {
        setDone(true);
        onComplete('math', reward);
      } else {
        setProgress(next);
        setProblem(generateMathProblem(minNum, maxNum));
        setInput('');
      }
    } else {
      setShake(true);
      setInput('');
      setTimeout(() => setShake(false), 500);
    }
  }, [input, problem, progress, reward, onComplete, totalProblems, minNum, maxNum]);

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
        {progress + 1} / {totalProblems}
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

      <div className="w-80 mt-10 bg-slate-800 rounded-full h-3">
        <div
          className="bg-emerald-500 h-3 rounded-full transition-all duration-300"
          style={{ width: `${(progress / totalProblems) * 100}%` }}
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
