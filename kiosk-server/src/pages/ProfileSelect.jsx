import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchProfiles, verifyProfilePin } from '../api/profiles';
import { useProfile } from '../contexts/ProfileContext';

function PinEntry({ profile, onSuccess, onCancel }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(null);
  const [locked, setLocked] = useState(false);

  const submit = useCallback(async (value) => {
    if (value.length !== 4) return;
    setLocked(true);
    setError(null);
    const result = await verifyProfilePin(profile.id, value);
    if (result.success) {
      onSuccess();
    } else {
      setError('Incorrect PIN');
      setTimeout(() => {
        setPin('');
        setError(null);
        setLocked(false);
      }, 3000);
    }
  }, [profile.id, onSuccess]);

  const addDigit = useCallback((d) => {
    if (locked) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) submit(next);
  }, [pin, locked, submit]);

  const backspace = useCallback(() => {
    if (locked) return;
    setPin((p) => p.slice(0, -1));
  }, [locked]);

  useEffect(() => {
    function onKey(e) {
      if (locked) return;
      if (e.key >= '0' && e.key <= '9') addDigit(e.key);
      else if (e.key === 'Backspace') backspace();
      else if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [addDigit, backspace, onCancel, locked]);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-5xl mb-1">{profile.icon}</div>
      <h2 className="text-2xl font-bold text-white">{profile.name}</h2>
      <p className="text-slate-400">Enter PIN</p>

      {/* PIN dots */}
      <div className="flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-5 h-5 rounded-full border-2 transition-colors ${
              i < pin.length
                ? error ? 'bg-red-500 border-red-500' : 'bg-white border-white'
                : 'border-slate-500'
            }`}
          />
        ))}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            onClick={() => addDigit(String(n))}
            disabled={locked}
            className="w-16 h-16 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-2xl font-semibold transition-colors disabled:opacity-50"
          >
            {n}
          </button>
        ))}
        <div />
        <button
          onClick={() => addDigit('0')}
          disabled={locked}
          className="w-16 h-16 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-2xl font-semibold transition-colors disabled:opacity-50"
        >
          0
        </button>
        <button
          onClick={backspace}
          disabled={locked}
          className="w-16 h-16 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xl transition-colors disabled:opacity-50 flex items-center justify-center"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l7-7 11 0 0 14-11 0z" />
          </svg>
        </button>
      </div>

      <button
        onClick={onCancel}
        className="mt-2 px-6 py-2 text-slate-400 hover:text-white transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}

export default function ProfileSelect() {
  const navigate = useNavigate();
  const { selectProfile } = useProfile();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pinProfile, setPinProfile] = useState(null);

  useEffect(() => {
    fetchProfiles()
      .then(setProfiles)
      .catch((err) => console.error('Failed to load profiles:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = (profile) => {
    if (profile.has_pin) {
      setPinProfile(profile);
    } else {
      selectProfile(profile.id);
      navigate('/kiosk/test-content');
    }
  };

  const handlePinSuccess = () => {
    selectProfile(pinProfile.id);
    navigate('/kiosk/test-content');
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
      {pinProfile ? (
        <PinEntry
          profile={pinProfile}
          onSuccess={handlePinSuccess}
          onCancel={() => setPinProfile(null)}
        />
      ) : (
        <>
          <h1 className="text-4xl font-bold text-white mb-2">Who's Playing?</h1>
          <p className="text-slate-400 mb-10 text-lg">Select your profile</p>

          <div className="flex gap-6 justify-center">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => handleSelect(profile)}
                className="bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-2xl p-6 text-center transition-all hover:scale-105 hover:border-blue-500"
              >
                <div className="text-5xl mb-3">{profile.icon}</div>
                <div className="text-lg font-semibold text-white">{profile.name}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
