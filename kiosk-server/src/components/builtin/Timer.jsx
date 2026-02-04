import { useState, useEffect, useCallback } from 'react';

export const meta = { key: 'timer', name: 'Timer', icon: '⏱️', description: 'Visual countdown timer' };

const PRESETS = [
  { label: '1 min', seconds: 60 },
  { label: '5 min', seconds: 300 },
  { label: '10 min', seconds: 600 },
  { label: '15 min', seconds: 900 },
  { label: '30 min', seconds: 1800 },
];

function Timer() {
  const [totalSeconds, setTotalSeconds] = useState(300);
  const [remainingSeconds, setRemainingSeconds] = useState(300);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progress = totalSeconds > 0 ? (remainingSeconds / totalSeconds) * 100 : 0;

  useEffect(() => {
    let interval;
    if (isRunning && remainingSeconds > 0) {
      interval = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            setIsComplete(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, remainingSeconds]);

  const handlePreset = useCallback((seconds) => {
    setTotalSeconds(seconds);
    setRemainingSeconds(seconds);
    setIsRunning(false);
    setIsComplete(false);
  }, []);

  const handleStart = () => {
    if (remainingSeconds > 0) {
      setIsRunning(true);
      setIsComplete(false);
    }
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setRemainingSeconds(totalSeconds);
    setIsRunning(false);
    setIsComplete(false);
  };

  const handleAddMinute = () => {
    setRemainingSeconds((prev) => prev + 60);
    setTotalSeconds((prev) => prev + 60);
  };

  // Color based on remaining time
  const getColor = () => {
    if (isComplete) return '#ef4444'; // red
    if (progress < 20) return '#f97316'; // orange
    if (progress < 50) return '#eab308'; // yellow
    return '#22c55e'; // green
  };

  // Circle calculations for SVG
  const radius = 140;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center transition-colors duration-500 ${
      isComplete ? 'bg-red-900' : 'bg-slate-900'
    }`}>
      {/* Timer display */}
      <div className="relative w-80 h-80">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 320 320">
          {/* Background circle */}
          <circle
            cx="160"
            cy="160"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="12"
          />
          {/* Progress circle */}
          <circle
            cx="160"
            cy="160"
            r={radius}
            fill="none"
            stroke={getColor()}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000"
          />
        </svg>

        {/* Time text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-7xl font-bold font-mono ${isComplete ? 'animate-pulse' : ''}`} style={{ color: getColor() }}>
            {formatTime(remainingSeconds)}
          </span>
          {isComplete && (
            <span className="text-2xl text-white mt-2 animate-bounce">Time's up!</span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-8 flex gap-4">
        {!isRunning ? (
          <button
            onClick={handleStart}
            disabled={remainingSeconds === 0}
            className="px-8 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white text-xl font-medium rounded-full transition-colors"
          >
            Start
          </button>
        ) : (
          <button
            onClick={handlePause}
            className="px-8 py-3 bg-yellow-600 hover:bg-yellow-700 text-white text-xl font-medium rounded-full transition-colors"
          >
            Pause
          </button>
        )}

        <button
          onClick={handleReset}
          className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white text-xl font-medium rounded-full transition-colors"
        >
          Reset
        </button>

        <button
          onClick={handleAddMinute}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xl font-medium rounded-full transition-colors"
        >
          +1 min
        </button>
      </div>

      {/* Presets */}
      <div className="mt-8 flex gap-3">
        {PRESETS.map((preset) => (
          <button
            key={preset.seconds}
            onClick={() => handlePreset(preset.seconds)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              totalSeconds === preset.seconds && remainingSeconds === preset.seconds
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default Timer;
