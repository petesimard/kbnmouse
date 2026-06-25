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

function MeshFrame({ gameId, mesh, spin = true, className = '', interactive = true }) {
  const src = `/gamepreview/${gameId}?file=${encodeURIComponent(mesh.file)}&spin=${spin ? 1 : 0}&t=${mesh.updated_at}`;
  return (
    <iframe
      title={mesh.file}
      src={src}
      className={className}
      style={{ border: 'none', background: '#eef2f7', pointerEvents: interactive ? 'auto' : 'none' }}
    />
  );
}

export default function MeshesTab({ gameId, meshes }) {
  const [selected, setSelected] = useState(null);
  const [refinement, setRefinement] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (selected) {
      const fresh = meshes.find((m) => m.id === selected.id);
      if (fresh) setSelected(fresh);
    }
  }, [meshes]);

  const submit = async (e) => {
    e.preventDefault();
    if (!selected || !refinement.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await gamesApi.refineMesh(gameId, selected.id, refinement.trim());
      setRefinement('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (selected) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelected(null)} className="text-blue-400 hover:text-blue-300">&larr; Back to meshes</button>
        <div className="flex items-center gap-3">
          <h3 className="text-white font-mono">{selected.file}</h3>
          <StatusPill status={selected.status} />
        </div>
        {selected.status === 'ready' ? (
          <MeshFrame gameId={gameId} mesh={selected} className="w-full max-w-xl h-80 rounded-lg" />
        ) : (
          <div className="w-full max-w-xl h-80 grid place-items-center bg-slate-700 rounded-lg text-slate-400">{selected.status}…</div>
        )}

        {selected.textures?.length > 0 && (
          <div>
            <div className="text-slate-400 text-sm mb-2">Textures used by this mesh:</div>
            <div className="flex gap-2 flex-wrap">
              {selected.textures.map((file) => (
                <div key={file} className="flex items-center gap-2 bg-slate-800 px-2 py-1 rounded-lg">
                  <img src={`/customgames/${gameId}/${file}`} alt={file} className="w-7 h-7 object-cover rounded bg-slate-700" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                  <span className="text-slate-300 text-xs font-mono">{file.replace('textures/', '')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="text-slate-400 text-sm mb-1">Current description:</div>
          <div className="bg-slate-900/60 text-slate-200 text-sm p-3 rounded-lg">{selected.prompt || '(none)'}</div>
        </div>

        <form onSubmit={submit} className="space-y-2">
          <p className="text-slate-400 text-sm">Describe how to refine this mesh. The agent rewrites the mesh module integrating your feedback.</p>
          <input
            type="text"
            value={refinement}
            onChange={(e) => setRefinement(e.target.value)}
            placeholder="e.g., make it bigger, add wings, give it a hat..."
            className="w-full px-4 py-3 bg-slate-700 text-white placeholder:text-slate-500 rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={submitting || !refinement.trim()} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors">
            {submitting ? 'Submitting…' : 'Refine mesh'}
          </button>
        </form>
      </div>
    );
  }

  if (meshes.length === 0) {
    return <p className="text-slate-500">No meshes yet. They'll appear as the game is built.</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {meshes.map((m) => (
        <button key={m.id} onClick={() => setSelected(m)} className="bg-slate-800 hover:bg-slate-700 rounded-lg overflow-hidden text-left transition-colors">
          {m.status === 'ready' ? (
            <MeshFrame gameId={gameId} mesh={m} className="w-full h-32" interactive={false} />
          ) : (
            <div className="w-full h-32 grid place-items-center bg-slate-700 text-2xl">
              {m.status === 'generating' ? '⏳' : m.status === 'failed' ? '⚠️' : '…'}
            </div>
          )}
          <div className="p-2 flex items-center justify-between gap-2">
            <span className="text-slate-300 text-xs font-mono truncate">{m.file.replace('meshes/', '')}</span>
            <StatusPill status={m.status} />
          </div>
        </button>
      ))}
    </div>
  );
}
