import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchProfiles, setActiveProfile } from '../api/profiles';

export default function ProfileSelect() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfiles()
      .then(setProfiles)
      .catch((err) => console.error('Failed to load profiles:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = async (id) => {
    await setActiveProfile(id);
    navigate('/test-content');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold text-white mb-2">Who's Playing?</h1>
      <p className="text-slate-400 mb-10 text-lg">Select your profile</p>

      <div className="flex gap-6 justify-center">
        {profiles.map((profile) => (
          <button
            key={profile.id}
            onClick={() => handleSelect(profile.id)}
            className="bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-2xl p-6 text-center transition-all hover:scale-105 hover:border-blue-500"
          >
            <div className="text-5xl mb-3">{profile.icon}</div>
            <div className="text-lg font-semibold text-white">{profile.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
