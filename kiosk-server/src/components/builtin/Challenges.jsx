import { useState, useEffect, useCallback } from 'react';
import { getChallengeComponent } from '../challenges';
import { useProfile } from '../../contexts/ProfileContext';
import AppIcon from '../AppIcon';

let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playCompletionJingle() {
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    // Ascending arpeggio: C5 → E5 → G5 → C6
    const notes = [523.25, 659.25, 783.99, 1046.50];
    const noteLen = 0.15;
    const gap = 0.1;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * (noteLen + gap));
      gain.gain.linearRampToValueAtTime(0.3, now + i * (noteLen + gap) + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * (noteLen + gap) + noteLen);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * (noteLen + gap));
      osc.stop(now + i * (noteLen + gap) + noteLen);
    });

    // Final shimmery chord
    const chordStart = now + notes.length * (noteLen + gap);
    [523.25, 659.25, 783.99, 1046.50].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, chordStart);
      gain.gain.exponentialRampToValueAtTime(0.001, chordStart + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(chordStart);
      osc.stop(chordStart + 0.8);
    });
  } catch (e) {
    // Audio not available — no-op
  }
}

export const meta = { key: 'challenges', name: 'Challenges', icon: '🏆', description: 'Earn bonus playtime', skipTracking: true };

function ChallengeListScreen({ challenges, bonusMinutes, onSelectChallenge }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex flex-col items-center justify-center p-8">
      <div className="text-center mb-12">
        <div className="text-6xl mb-4">🏆</div>
        <h1 className="text-4xl font-bold text-white mb-3">Challenges</h1>
        <div className="text-2xl text-emerald-400 font-semibold">
          Bonus Time Today: +{bonusMinutes} minutes
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-6 w-full px-8">
        {challenges.map((challenge) => {
          const hasLimit = challenge.max_completions_per_day > 0;
          const remaining = hasLimit ? challenge.max_completions_per_day - (challenge.today_completions || 0) : null;
          const exhausted = hasLimit && remaining <= 0;

          return (
            <button
              key={challenge.id}
              onClick={() => !exhausted && onSelectChallenge(challenge)}
              disabled={exhausted}
              className={`w-64 rounded-2xl p-8 text-center transition-all border ${
                exhausted
                  ? 'bg-slate-800/40 border-slate-700/50 opacity-60 cursor-not-allowed'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 hover:scale-105'
              }`}
            >
              <div className="text-5xl mb-4">
                <AppIcon icon={challenge.icon} className="inline-block w-12 h-12 object-cover rounded" />
              </div>
              <div className="text-xl font-bold text-white mb-2">{challenge.name}</div>
              <div className="text-slate-400">{challenge.description}</div>
              <div className="mt-3 text-emerald-400 font-semibold">+{challenge.reward_minutes} min</div>
              {hasLimit && (
                <div className={`mt-2 text-sm font-medium ${exhausted ? 'text-red-400' : 'text-slate-400'}`}>
                  {exhausted ? 'Completed for today' : `${remaining} remaining today`}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {challenges.length === 0 && (
        <p className="text-slate-500 text-lg">No challenges available right now.</p>
      )}
    </div>
  );
}

function Challenges() {
  const { profileId } = useProfile();
  const [activeChallenge, setActiveChallenge] = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [bonusMinutes, setBonusMinutes] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const profileParam = profileId ? `?profile=${profileId}` : '';
      const [challengesRes, bonusRes] = await Promise.all([
        fetch(`/api/challenges${profileParam}`),
        fetch(`/api/bonus-time${profileParam}`),
      ]);
      const challengesData = await challengesRes.json();
      const bonusData = await bonusRes.json();
      setChallenges(challengesData);
      setBonusMinutes(bonusData.today_bonus_minutes);
    } catch (err) {
      console.error('Failed to fetch challenge data:', err);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleComplete = useCallback(async () => {
    playCompletionJingle();
    try {
      const res = await fetch('/api/challenges/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge_id: activeChallenge?.id,
          profile_id: profileId,
        }),
      });
      const data = await res.json();
      if (data.today_bonus_minutes != null) {
        setBonusMinutes(data.today_bonus_minutes);
      }
      // Re-fetch challenges to update today_completions counts
      fetchData();
    } catch (err) {
      console.error('Failed to record challenge completion:', err);
    }
  }, [activeChallenge, profileId, fetchData]);

  const handleBack = useCallback(() => {
    setActiveChallenge(null);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-xl">Loading challenges...</div>
      </div>
    );
  }

  if (activeChallenge) {
    const ChallengeComponent = getChallengeComponent(activeChallenge.challenge_type);
    if (ChallengeComponent) {
      return (
        <ChallengeComponent
          config={activeChallenge.config || {}}
          reward={activeChallenge.reward_minutes}
          onComplete={handleComplete}
          onBack={handleBack}
        />
      );
    }
    // Unknown challenge type fallback
    setActiveChallenge(null);
  }

  return (
    <ChallengeListScreen
      challenges={challenges}
      bonusMinutes={bonusMinutes}
      onSelectChallenge={setActiveChallenge}
    />
  );
}

export default Challenges;
