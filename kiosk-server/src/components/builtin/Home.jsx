import { useState, useEffect } from 'react';
import { useProfile } from '../../contexts/ProfileContext';

export const meta = { key: 'home', name: 'Home', icon: '🏠', description: 'Welcome home screen', skipTracking: true };

function Home() {
  const { profileId, profiles } = useProfile();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const currentProfile = profiles.find(p => p.id === profileId);
  const name = currentProfile?.name || 'Friend';

  const timeString = time.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const dateString = time.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex flex-col items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-8">{currentProfile?.icon || '👋'}</div>
        <h1 className="text-6xl font-bold text-white mb-6">
          Welcome {name}!
        </h1>
        <div className="text-8xl font-bold text-white font-mono mb-4">
          {timeString}
        </div>
        <div className="text-3xl text-slate-400">
          {dateString}
        </div>
      </div>
    </div>
  );
}

export default Home;
