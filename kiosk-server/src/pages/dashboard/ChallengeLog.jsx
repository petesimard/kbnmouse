import { useState, useEffect, useCallback } from 'react';
import { fetchChallengeCompletions, UnauthorizedError } from '../../api/challenges';

export default function ChallengeLog({ profileId, onUnauthorized }) {
  const [completions, setCompletions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchChallengeCompletions(profileId);
      setCompletions(data);
    } catch (err) {
      if (err instanceof UnauthorizedError && onUnauthorized) {
        onUnauthorized();
      }
    } finally {
      setLoading(false);
    }
  }, [profileId, onUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };

  if (loading) {
    return <div className="text-center py-12 text-slate-400">Loading completion log...</div>;
  }

  if (completions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">📋</div>
        <p className="text-slate-400">No challenges completed yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {completions.map((c) => (
        <div
          key={c.id}
          className="flex items-center justify-between bg-slate-800/50 rounded-lg px-4 py-3"
        >
          <div className="min-w-0">
            <div className="text-white font-medium truncate">
              {c.challenge_name || c.challenge_type}
            </div>
            <div className="text-slate-400 text-sm">
              {formatDate(c.completed_at)} at {formatTime(c.completed_at)}
            </div>
          </div>
          <div className="ml-4 shrink-0 px-3 py-1 bg-green-600/20 text-green-400 rounded-full text-sm font-medium">
            +{c.minutes_awarded} min
          </div>
        </div>
      ))}
    </div>
  );
}
