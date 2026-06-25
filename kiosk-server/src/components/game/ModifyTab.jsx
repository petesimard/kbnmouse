import { useState, useEffect } from 'react';
import { gamesApi } from './api.js';

export default function ModifyTab({ gameId, busy }) {
  const [desc, setDesc] = useState('');
  const [commits, setCommits] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const load = () => gamesApi.listCommits(gameId).then((c) => alive && setCommits(c)).catch(() => {});
    load();
    const iv = setInterval(load, 2500);
    return () => { alive = false; clearInterval(iv); };
  }, [gameId]);

  useEffect(() => {
    if (!selected?.jobId) { setSelectedJob(null); return; }
    let alive = true;
    gamesApi.getJob(gameId, selected.jobId).then((j) => alive && setSelectedJob(j)).catch(() => {});
    return () => { alive = false; };
  }, [gameId, selected?.jobId]);

  const submit = async (e) => {
    e.preventDefault();
    if (!desc.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await gamesApi.modify(gameId, desc.trim());
      setDesc('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const revert = async () => {
    if (!selected?.hash) return;
    try {
      await gamesApi.revert(gameId, selected.hash);
      setSelected(null);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-3">
        <textarea
          rows={3}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Describe what to change... (e.g., 'make the dinosaur green and faster')"
          className="w-full px-4 py-3 bg-slate-700 text-white placeholder:text-slate-500 rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500 resize-none"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button type="submit" disabled={submitting || busy || !desc.trim()} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors">
          {busy ? 'Wait for current job…' : submitting ? 'Submitting…' : 'Submit change'}
        </button>
      </form>

      <div>
        <h3 className="text-white font-bold mb-1">Previous changes</h3>
        <p className="text-slate-400 text-sm mb-3">Click a change to view details and optionally revert.</p>
        {commits.length === 0 ? (
          <p className="text-slate-500 text-sm">No changes yet.</p>
        ) : (
          <div className="space-y-2">
            {commits.map((c) => (
              <button
                key={c.hash}
                onClick={() => setSelected(c)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                  selected?.hash === c.hash ? 'bg-slate-700 border-blue-500' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-white text-sm truncate">{c.subject}</div>
                    <div className="text-slate-500 text-xs">{new Date(c.at).toLocaleString()}</div>
                  </div>
                  <span className="text-slate-500 text-xs font-mono">{c.hash.slice(0, 7)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="space-y-3 bg-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-white font-medium truncate">{selected.subject}</div>
              <div className="text-slate-500 text-xs">{new Date(selected.at).toLocaleString()}</div>
            </div>
            <button onClick={revert} disabled={busy} className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap">
              Revert this change
            </button>
          </div>
          <pre className="bg-slate-900/70 text-slate-300 text-xs p-3 rounded-lg max-h-64 overflow-auto whitespace-pre-wrap">
            {selectedJob ? (selectedJob.log || '(no log captured)') : selected.jobId ? 'Loading…' : '(no tool output for this commit)'}
          </pre>
        </div>
      )}
    </div>
  );
}
