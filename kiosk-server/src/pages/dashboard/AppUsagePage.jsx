import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { fetchUsageSummary } from '../../api/apps';
import { UnauthorizedError } from '../../api/apps';

function formatDuration(seconds) {
  if (seconds === 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function AppUsagePage() {
  const { logout, dashboardProfileId } = useOutletContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const result = await fetchUsageSummary(dashboardProfileId);
        setData(result);
      } catch (err) {
        if (err instanceof UnauthorizedError) {
          logout();
        } else {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [logout, dashboardProfileId]);

  if (loading) {
    return <div className="text-center py-12 text-slate-400">Loading usage data...</div>;
  }

  if (error) {
    return <div className="text-center py-12 text-red-400">Error: {error}</div>;
  }

  // Filter to only apps with usage
  const appsWithUsage = data.apps.filter(app =>
    app.daily.some(d => d.seconds > 0)
  );

  // Find max seconds across all data for scaling bars
  const maxSeconds = Math.max(
    1,
    ...appsWithUsage.flatMap(app => app.daily.map(d => d.seconds))
  );

  if (appsWithUsage.length === 0) {
    return (
      <div className="text-center py-16">
        <svg className="w-16 h-16 mx-auto text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <h3 className="text-lg font-medium text-slate-400 mb-2">No usage data yet</h3>
        <p className="text-slate-500 text-sm">App usage will appear here once apps are used.</p>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-lg font-medium text-white mb-6">App Usage — Last 7 Days</h2>

      <div className="space-y-8">
        {appsWithUsage.map(app => {
          const totalSeconds = app.daily.reduce((sum, d) => sum + d.seconds, 0);
          return (
            <div key={app.id} className="bg-slate-800 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{app.icon}</span>
                <h3 className="text-white font-medium">{app.name}</h3>
                <span className="text-slate-400 text-sm ml-auto">
                  Total: {formatDuration(totalSeconds)}
                </span>
              </div>

              <div className="space-y-2">
                {app.daily.map(day => (
                  <div key={day.date} className="flex items-center gap-3">
                    <span className="text-slate-400 text-xs w-28 text-right flex-shrink-0">
                      {formatDateLabel(day.date)}
                    </span>
                    <div className="flex-1 bg-slate-700 rounded-full h-5 overflow-hidden">
                      {day.seconds > 0 && (
                        <div
                          className="bg-blue-500 h-full rounded-full transition-all"
                          style={{ width: `${Math.max(2, (day.seconds / maxSeconds) * 100)}%` }}
                        />
                      )}
                    </div>
                    <span className="text-slate-400 text-xs w-16 flex-shrink-0">
                      {day.seconds > 0 ? formatDuration(day.seconds) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
