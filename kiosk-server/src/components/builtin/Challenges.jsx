import { useState, useEffect, useCallback } from 'react';
import { getChallengeComponent } from '../challenges';
import { useProfile } from '../../contexts/ProfileContext';

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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl w-full">
        {challenges.map((challenge) => {
          const hasLimit = challenge.max_completions_per_day > 0;
          const remaining = hasLimit ? challenge.max_completions_per_day - (challenge.today_completions || 0) : null;
          const exhausted = hasLimit && remaining <= 0;

          return (
            <button
              key={challenge.id}
              onClick={() => !exhausted && onSelectChallenge(challenge)}
              disabled={exhausted}
              className={`rounded-2xl p-8 text-center transition-all border ${
                exhausted
                  ? 'bg-slate-800/40 border-slate-700/50 opacity-60 cursor-not-allowed'
                  : 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 hover:scale-105'
              }`}
            >
              <div className="text-5xl mb-4">{challenge.icon}</div>
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

  const handleComplete = useCallback(async (challengeType, minutesAwarded) => {
    try {
      const res = await fetch('/api/challenges/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge_type: challengeType,
          minutes_awarded: minutesAwarded,
          challenge_id: activeChallenge?.id,
          profile_id: profileId || null,
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
