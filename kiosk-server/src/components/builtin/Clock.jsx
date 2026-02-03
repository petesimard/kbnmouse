import { useState, useEffect } from 'react';

function Clock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const hours = time.getHours();
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

  const formatTime = (num) => num.toString().padStart(2, '0');

  const dateString = time.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex flex-col items-center justify-center">
      {/* Digital Clock */}
      <div className="text-center">
        <div className="text-[12rem] font-bold text-white tracking-tight leading-none font-mono">
          {formatTime(hours)}:{formatTime(minutes)}
          <span className="text-6xl text-blue-400 ml-4">{formatTime(seconds)}</span>
        </div>
        <div className="text-3xl text-slate-400 mt-4">{dateString}</div>
      </div>

      {/* Analog Clock */}
      <div className="mt-16 relative w-64 h-64">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          {/* Clock face */}
          <circle
            cx="100"
            cy="100"
            r="95"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="2"
          />

          {/* Hour markers */}
          {[...Array(12)].map((_, i) => {
            const angle = (i * 30 - 90) * (Math.PI / 180);
            const x1 = 100 + 80 * Math.cos(angle);
            const y1 = 100 + 80 * Math.sin(angle);
            const x2 = 100 + 90 * Math.cos(angle);
            const y2 = 100 + 90 * Math.sin(angle);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="white"
                strokeWidth={i % 3 === 0 ? 3 : 1}
                opacity={0.6}
              />
            );
          })}

          {/* Hour hand */}
          <line
            x1="100"
            y1="100"
            x2={100 + 50 * Math.cos(((hours % 12 + minutes / 60) * 30 - 90) * (Math.PI / 180))}
            y2={100 + 50 * Math.sin(((hours % 12 + minutes / 60) * 30 - 90) * (Math.PI / 180))}
            stroke="white"
            strokeWidth="4"
            strokeLinecap="round"
          />

          {/* Minute hand */}
          <line
            x1="100"
            y1="100"
            x2={100 + 70 * Math.cos((minutes * 6 - 90) * (Math.PI / 180))}
            y2={100 + 70 * Math.sin((minutes * 6 - 90) * (Math.PI / 180))}
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Second hand */}
          <line
            x1="100"
            y1="100"
            x2={100 + 75 * Math.cos((seconds * 6 - 90) * (Math.PI / 180))}
            y2={100 + 75 * Math.sin((seconds * 6 - 90) * (Math.PI / 180))}
            stroke="#60a5fa"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Center dot */}
          <circle cx="100" cy="100" r="6" fill="white" />
        </svg>
      </div>
    </div>
  );
}

export default Clock;
