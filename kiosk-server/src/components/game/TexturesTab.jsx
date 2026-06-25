import { useState, useEffect } from 'react';
import { gamesApi } from './api.js';

const STATUS_STYLE = {
  ready: 'bg-emerald-500/20 text-emerald-400',
  generating: 'bg-yellow-500/20 text-yellow-400',
  pending: 'bg-slate-600/40 text-slate-300',
  failed: 'bg-red-500/20 text-red-400',
};

function StatusPill({ status }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[status] || STATUS_STYLE.pending}`}>
      {status}
    </span>
  );
}

export default function TexturesTab({ gameId, textures }) {
  const [selected, setSelected] = useState(null);
  const [refinement, setRefinement] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Keep the open texture in sync with polled data.
  useEffect(() => {
    if (selected) {
      const fresh = textures.find((a) => a.id === selected.id);
      if (fresh) setSelected(fresh);
    }
  }, [textures]);

  const submit = async (e) => {
    e.preventDefault();
    if (!selected || !refinement.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await gamesApi.refineTexture(gameId, selected.id, refinement.trim());
      setRefinement('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (selected) {
    const src = `/customgames/${gameId}/${selected.file}?t=${selected.updated_at}`;
    return (
      <div className="space-y-4">
        <button onClick={() => setSelected(null)} className="text-blue-400 hover:text-blue-300">&larr; Back to textures</button>
        <div className="flex items-center gap-3">
          <h3 className="text-white font-mono">{selected.file}</h3>
          <StatusPill status={selected.status} />
        </div>
        {selected.status === 'ready' ? (
          <img src={src} alt={selected.file} className="w-64 h-64 object-cover rounded-lg bg-slate-700" />
        ) : (
          <div className="w-64 h-64 grid place-items-center bg-slate-700 rounded-lg text-slate-400">Generating…</div>
        )}
        <div>
          <div className="text-slate-400 text-sm mb-1">Current prompt:</div>
          <div className="bg-slate-900/60 text-slate-200 text-sm p-3 rounded-lg">{selected.prompt}</div>
        </div>
        <form onSubmit={submit} className="space-y-2">
          <p className="text-slate-400 text-sm">Describe how to refine this texture. Your input is merged with the existing prompt.</p>
          <input
            type="text"
            value={refinement}
            onChange={(e) => setRefinement(e.target.value)}
            placeholder="e.g., make it more colorful, change to nighttime, add stars..."
            className="w-full px-4 py-3 bg-slate-700 text-white placeholder:text-slate-500 rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={submitting || !refinement.trim()} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors">
            {submitting ? 'Submitting…' : 'Refine and regenerate'}
          </button>
        </form>
      </div>
    );
  }

  if (textures.length === 0) {
    return <p className="text-slate-500">No textures yet. They'll appear as the game is built.</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {textures.map((a) => (
        <button key={a.id} onClick={() => setSelected(a)} className="bg-slate-800 hover:bg-slate-700 rounded-lg overflow-hidden text-left transition-colors">
          {a.status === 'ready' ? (
            <img src={`/customgames/${gameId}/${a.file}?t=${a.updated_at}`} alt={a.file} className="w-full h-32 object-cover bg-slate-700" />
          ) : (
            <div className="w-full h-32 grid place-items-center bg-slate-700 text-2xl">
              {a.status === 'generating' ? '⏳' : a.status === 'failed' ? '⚠️' : '…'}
            </div>
          )}
          <div className="p-2 flex items-center justify-between gap-2">
            <span className="text-slate-300 text-xs font-mono truncate">{a.file.replace('textures/', '')}</span>
            <StatusPill status={a.status} />
          </div>
        </button>
      ))}
    </div>
  );
}
