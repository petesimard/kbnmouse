import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';

function GameManage() {
  const { id } = useParams();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatePrompt, setUpdatePrompt] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const pollRef = useRef(null);

  const fetchGame = useCallback(async () => {
    try {
      const res = await fetch(`/api/games/${id}`);
      if (!res.ok) throw new Error('Failed to fetch game');
      const data = await res.json();
      setGame(data);
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchGame();
  }, [fetchGame]);

  // Poll while generating
  useEffect(() => {
    if (game && game.status === 'generating') {
      pollRef.current = setInterval(fetchGame, 3000);
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [game, fetchGame]);

  const handlePlay = () => {
    // ?kiosk=1 triggers the server-injected Back button overlay.
    // Shared QR URLs omit this param, so shared games won't show it.
    const url = `/customgames/${id}/index.html?kiosk=1`;
    if (window.kiosk?.content?.loadURL) {
      window.kiosk.content.loadURL(url);
    } else {
      window.location.href = url;
    }
  };

  const handleBack = () => {
    const url = '/kiosk/builtin/gamecreator';
    if (window.kiosk?.content?.loadURL) {
      window.kiosk.content.loadURL(url);
    } else {
      window.location.href = url;
    }
  };

  const handleShare = async () => {
    const playUrl = `${window.location.origin}/customgames/${id}/index.html`;
    const dataUrl = await QRCode.toDataURL(playUrl, { width: 512, margin: 2, color: { dark: '#ffffff', light: '#00000000' } });
    setQrDataUrl(dataUrl);
    setShowShare(true);
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

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!updatePrompt.trim()) return;
    setUpdating(true);
    setUpdateError('');
    try {
      const res = await fetch(`/api/games/${id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: updatePrompt.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update game');
      }
      setUpdatePrompt('');
      await fetchGame();
    } catch (err) {
      setUpdateError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-xl">Loading game...</div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex flex-col items-center justify-center gap-4">
        <p className="text-red-400 text-xl">{error || 'Game not found'}</p>
        <button
          onClick={handleBack}
          className="text-blue-400 hover:text-blue-300 underline text-lg"
        >
          Back to My Games
        </button>
      </div>
    );
  }

  const isGenerating = game.status === 'generating';
  const isReady = game.status === 'ready';
  const isError = game.status === 'error';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 p-8 relative">
      {/* Share QR overlay */}
      {showShare && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowShare(false)}>
          <div className="bg-slate-800 rounded-2xl p-6 max-w-sm mx-4 text-center space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-white text-lg font-medium">Share "{game.name}"</p>
            <p className="text-slate-400 text-sm">Scan to play on another device</p>
            <img src={qrDataUrl} alt="QR Code" className="mx-auto w-72 h-72" />
            <button
              onClick={() => setShowShare(false)}
              className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation overlay */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-sm mx-4 text-center space-y-4">
            <p className="text-white text-lg font-medium">Delete "{game.name}"?</p>
            <p className="text-slate-400 text-sm">This will permanently remove the game and all its files.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        {/* Top bar: back + delete */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handleBack}
            className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-2 text-lg"
          >
            &larr; Back to My Games
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={handleShare}
              className="text-slate-500 hover:text-blue-400 transition-colors p-2"
              title="Share game"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-slate-500 hover:text-red-400 transition-colors p-2"
              title="Delete game"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Game title + status */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">{game.name}</h1>
          {isGenerating && (
            <div className="inline-flex items-center gap-2 text-yellow-400 text-lg">
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Generating your game...
            </div>
          )}
          {isReady && (
            <div className="text-emerald-400 text-lg font-medium">
              Your game is ready to play!
            </div>
          )}
          {isError && (
            <div className="text-red-400 text-lg">
              Something went wrong: {game.error_message || 'Unknown error'}
            </div>
          )}
          {isReady && game.error_message && (
            <div className="text-yellow-400 text-base mt-2">
              Update failed: {game.error_message}
            </div>
          )}
        </div>

        {/* PLAY button */}
        <div className="flex justify-center mb-12">
          <button
            onClick={handlePlay}
            disabled={!isReady}
            className={`px-16 py-6 rounded-2xl text-3xl font-bold transition-all ${
              isReady
                ? 'bg-emerald-600 hover:bg-emerald-700 hover:scale-105 text-white shadow-lg shadow-emerald-600/30'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            &#9654; PLAY
          </button>
        </div>

        {/* Update Game section */}
        <div className="bg-slate-800 rounded-xl p-6">
          <h2 className="text-white font-bold text-xl mb-4">Update Game</h2>
          <form onSubmit={handleUpdate} className="space-y-4">
            <textarea
              value={updatePrompt}
              onChange={(e) => setUpdatePrompt(e.target.value)}
              placeholder="What would you like to change?"
              rows={3}
              className="w-full px-4 py-3 bg-slate-700 text-white placeholder:text-slate-500 rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500 text-lg resize-none"
              required
            />
            {updateError && (
              <p className="text-red-400 text-sm">{updateError}</p>
            )}
            <button
              type="submit"
              disabled={updating || !updatePrompt.trim() || isGenerating}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors text-lg"
            >
              {updating ? 'Updating...' : 'Update Game'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default GameManage;
