import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import Modal from '../components/Modal';
import { gamesApi } from '../components/game/api.js';
import ModifyTab from '../components/game/ModifyTab.jsx';
import TexturesTab from '../components/game/TexturesTab.jsx';
import MeshesTab from '../components/game/MeshesTab.jsx';

const JOB_LABEL = {
  'create-game': 'Creating game',
  modify: 'Updating game',
  'refine-texture': 'Refining texture',
  'refine-mesh': 'Refining mesh',
  revert: 'Reverting change',
};

function describeStep(job, textures) {
  const ready = textures.filter((a) => a.status === 'ready').length;
  const total = textures.length;
  const generating = textures.find((a) => a.status === 'generating');
  if (job.status === 'queued') return { step: 'Queued — waiting for the current job…', ready, total };
  if (job.type === 'create-game' || job.type === 'modify') {
    if (generating) return { step: `Generating texture: ${generating.file}`, ready, total };
    return { step: 'Running the game agent…', ready, total };
  }
  if (job.type === 'refine-texture') return { step: 'Regenerating texture…', ready, total };
  if (job.type === 'refine-mesh') return { step: 'Rewriting mesh module…', ready, total };
  if (job.type === 'revert') return { step: 'Reverting change…', ready, total };
  return { step: job.description ?? '', ready, total };
}

function StatusBanner({ job, textures }) {
  if (!job) return null;
  const info = describeStep(job, textures);
  const showProgress = (job.type === 'create-game' || job.type === 'modify') && info.total > 0;
  const pct = info.total > 0 ? Math.round((info.ready / info.total) * 100) : 0;
  return (
    <div className="bg-slate-800 rounded-xl p-4 mb-6">
      <div className="flex items-center gap-3">
        <svg className="w-5 h-5 animate-spin text-yellow-400 shrink-0" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <div className="grow min-w-0">
          <span className="text-white font-medium">{JOB_LABEL[job.type] ?? job.type}</span>
          <span className="text-slate-400"> · {info.step}</span>
        </div>
        {showProgress && <div className="text-slate-300 text-sm whitespace-nowrap">{info.ready}/{info.total} textures</div>}
      </div>
      {showProgress && (
        <div className="mt-3 h-2 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-yellow-400 transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

function GameManage() {
  const { id } = useParams();
  const [game, setGame] = useState(null);
  const [textures, setTextures] = useState([]);
  const [meshes, setMeshes] = useState([]);
  const [tab, setTab] = useState('modify');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [showRename, setShowRename] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [togglingShare, setTogglingShare] = useState(false);
  const [activeProfileId, setActiveProfileId] = useState(null);

  useEffect(() => {
    fetch('/api/active-profile').then(r => r.json()).then(data => {
      if (data.profile_id) setActiveProfileId(data.profile_id);
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const [g, t, m] = await Promise.all([
        gamesApi.getGame(id),
        gamesApi.listTextures(id),
        gamesApi.listMeshes(id),
      ]);
      setGame(g); setTextures(t); setMeshes(m);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 1500);
    return () => clearInterval(iv);
  }, [load]);

  const navigate = (url) => {
    if (window.kiosk?.content?.loadURL) window.kiosk.content.loadURL(url);
    else window.location.href = url;
  };

  // Play launches the game as its own full-screen kiosk app. ?kiosk=1 makes the
  // server inject the Manage overlay that brings the child back here.
  const handlePlay = () => navigate(`/customgames/${id}/game.html?kiosk=1`);
  const handleBack = () => navigate('/kiosk/builtin/gamecreator');

  const handleShare = async () => {
    const playUrl = `${window.location.origin}/customgames/${id}/game.html`;
    const dataUrl = await QRCode.toDataURL(playUrl, { width: 512, margin: 2, color: { dark: '#ffffff', light: '#00000000' } });
    setQrDataUrl(dataUrl);
    setShowShare(true);
  };

  const handleRename = async () => {
    if (!renameValue.trim()) return;
    setRenaming(true);
    try {
      const res = await fetch(`/api/games/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      if (!res.ok) throw new Error('Failed to rename game');
      setGame(await res.json());
      setShowRename(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setRenaming(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/games/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete game');
      handleBack();
    } catch (err) {
      setError(err.message);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleToggleShare = async () => {
    setTogglingShare(true);
    try {
      const res = await fetch(`/api/games/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shared: !game.shared }),
      });
      if (!res.ok) throw new Error('Failed to update sharing');
      setGame(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setTogglingShare(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-xl">Loading game...</div>
      </div>
    );
  }

  if (error && !game) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex flex-col items-center justify-center gap-4">
        <p className="text-red-400 text-xl">{error || 'Game not found'}</p>
        <button onClick={handleBack} className="text-blue-400 hover:text-blue-300 underline text-lg">Back to My Games</button>
      </div>
    );
  }

  const isReady = game.status === 'ready';
  const isError = game.status === 'error';
  const isOwner = activeProfileId && game.profile_id === activeProfileId;
  const busy = !!game.activeJob;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 p-8">
      {showShare && (
        <Modal onClose={() => setShowShare(false)} className="p-6 max-w-sm mx-4 text-center space-y-4">
          <p className="text-white text-lg font-medium">Share "{game.name}"</p>
          <p className="text-slate-400 text-sm">Scan to play on another device</p>
          <img src={qrDataUrl} alt="QR Code" className="mx-auto w-72 h-72" />
          <button onClick={() => setShowShare(false)} className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">Close</button>
        </Modal>
      )}

      {showDeleteConfirm && (
        <Modal onClose={() => setShowDeleteConfirm(false)} className="p-6 max-w-sm mx-4 text-center space-y-4">
          <p className="text-white text-lg font-medium">Delete "{game.name}"?</p>
          <p className="text-slate-400 text-sm">This will permanently remove the game and all its files.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setShowDeleteConfirm(false)} className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">Cancel</button>
            <button onClick={handleDelete} disabled={deleting} className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors">
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}

      {showRename && (
        <Modal onClose={() => setShowRename(false)} className="p-6 max-w-sm mx-4 text-center space-y-4">
          <p className="text-white text-lg font-medium">Rename Game</p>
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="w-full px-4 py-3 bg-slate-700 text-white placeholder:text-slate-500 rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500 text-lg"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
          />
          <div className="flex gap-3 justify-center">
            <button onClick={() => setShowRename(false)} className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">Cancel</button>
            <button onClick={handleRename} disabled={renaming || !renameValue.trim()} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors">
              {renaming ? 'Renaming...' : 'Rename'}
            </button>
          </div>
        </Modal>
      )}

      <div className="max-w-3xl mx-auto">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={handleBack} className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-2 text-lg">&larr; Back to My Games</button>
          <div className="flex items-center gap-1">
            <button onClick={() => { setRenameValue(game.name); setShowRename(true); }} className="text-slate-500 hover:text-blue-400 transition-colors p-2" title="Rename game">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
            <button onClick={handleShare} className="text-slate-500 hover:text-blue-400 transition-colors p-2" title="Share game">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
            </button>
            <button onClick={() => setShowDeleteConfirm(true)} className="text-slate-500 hover:text-red-400 transition-colors p-2" title="Delete game">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        </div>

        {/* Title + Play */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-4">{game.name}</h1>
          {isError && <div className="text-red-400 text-lg mb-2">Something went wrong: {game.error_message || 'Unknown error'}</div>}
          {isReady && game.error_message && <div className="text-yellow-400 text-base mb-2">Last update failed: {game.error_message}</div>}
        </div>

        <StatusBanner job={game.activeJob} textures={textures} />

        <div className="flex justify-center mb-8">
          <button
            onClick={handlePlay}
            disabled={!isReady}
            className={`px-16 py-6 rounded-2xl text-3xl font-bold transition-all ${
              isReady ? 'bg-emerald-600 hover:bg-emerald-700 hover:scale-105 text-white shadow-lg shadow-emerald-600/30' : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            &#9654; PLAY
          </button>
        </div>

        {/* Share with other profiles */}
        {isOwner && (
          <div className="bg-slate-800 rounded-xl p-5 mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-white font-bold text-lg">Share with other profiles</h2>
              <p className="text-slate-400 text-sm mt-1">{game.shared ? 'This game appears in all profiles' : 'Only visible to this profile'}</p>
            </div>
            <button
              onClick={handleToggleShare}
              disabled={togglingShare}
              className={`relative w-14 h-8 rounded-full transition-colors ${game.shared ? 'bg-emerald-600' : 'bg-slate-600'} ${togglingShare ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${game.shared ? 'translate-x-6' : ''}`} />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-700 mb-6">
          {[['modify', 'Modify'], ['textures', 'Textures'], ['meshes', 'Meshes']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-5 py-2.5 font-medium transition-colors border-b-2 -mb-px ${
                tab === key ? 'text-white border-blue-500' : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'modify' && <ModifyTab gameId={id} busy={busy} />}
        {tab === 'textures' && <TexturesTab gameId={id} textures={textures} />}
        {tab === 'meshes' && <MeshesTab gameId={id} meshes={meshes} />}
      </div>
    </div>
  );
}

export default GameManage;
