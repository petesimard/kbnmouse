import { useState, useEffect, useCallback, useRef } from 'react';
import { z } from 'zod';
import { field } from '../challenges/schemas.js';
import { useProfile } from '../../contexts/ProfileContext';

export const meta = {
  key: 'gamecreator',
  name: 'Game Creator',
  icon: '🎮',
  description: 'Create your own games!',
  skipTracking: true,
};

export const configSchema = {
  default_daily_limit: field(z.number().int().min(0).max(480).default(0), {
    label: 'Default Daily Limit for Created Games',
    description: 'Minutes per day for newly created games. 0 = no limit.',
    type: 'number',
    min: 0,
    max: 480,
  }),
  share_daily_limit: field(z.boolean().default(true), {
    label: 'Created games share daily limit',
    description: 'Time spent on one created game counts toward all created games.',
    type: 'boolean',
  }),
};

function StatusBadge({ status }) {
  if (status === 'generating') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
        <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        Generating
      </span>
    );
  }
  if (status === 'ready') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
        Ready
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
        Error
      </span>
    );
  }
  return null;
}

function GameCard({ game, onClick }) {
  const date = new Date(game.created_at).toLocaleDateString();
  return (
    <button
      onClick={onClick}
      className="bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 hover:scale-105 rounded-2xl p-6 text-left transition-all w-full"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-lg font-bold text-white truncate pr-2">{game.name}</h3>
        <StatusBadge status={game.status} />
      </div>
      {game.description && (
        <p className="text-slate-400 text-sm mb-3 line-clamp-2">{game.description}</p>
      )}
      <p className="text-slate-500 text-xs">Created {date}</p>
    </button>
  );
}

function CreateGameForm({ onSubmit, submitting }) {
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !prompt.trim()) return;
    onSubmit({ name: name.trim(), prompt: prompt.trim() });
    setName('');
    setPrompt('');
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-800 rounded-xl p-6 space-y-4">
      <h3 className="text-white font-bold text-lg">Create a New Game</h3>
      <div>
        <label className="block text-slate-400 text-sm mb-1">Game Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Awesome Game"
          className="w-full px-4 py-3 bg-slate-700 text-white placeholder:text-slate-500 rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500 text-lg"
          required
        />
      </div>
      <div>
        <label className="block text-slate-400 text-sm mb-1">Describe your game idea...</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="A platformer game where a cat jumps over obstacles to collect fish..."
          rows={4}
          className="w-full px-4 py-3 bg-slate-700 text-white placeholder:text-slate-500 rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500 text-lg resize-none"
          required
        />
      </div>
      <button
        type="submit"
        disabled={submitting || !name.trim() || !prompt.trim()}
        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors text-lg"
      >
        {submitting ? 'Creating...' : 'Create Game'}
      </button>
    </form>
  );
}

function GameCreator() {
  const { profileId } = useProfile();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  const fetchGames = useCallback(async () => {
    if (!profileId) return;
    try {
      const res = await fetch(`/api/games?profile=${profileId}`);
      if (!res.ok) throw new Error('Failed to fetch games');
      const data = await res.json();
      setGames(data);
      return data;
    } catch (err) {
      console.error('Failed to fetch games:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  // Poll while any game is generating
  useEffect(() => {
    const hasGenerating = games.some(g => g.status === 'generating');
    if (hasGenerating) {
      pollRef.current = setInterval(fetchGames, 3000);
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [games, fetchGames]);

  const handleCreate = async ({ name, prompt }) => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, prompt, profile_id: profileId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create game');
      }
      const created = await res.json();
      navigateToGame(created.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const navigateToGame = (gameId) => {
    const url = `/game/${gameId}`;
    if (window.kiosk?.content?.loadURL) {
      window.kiosk.content.loadURL(url);
    } else {
      window.location.href = url;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-xl">Loading games...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🎮</div>
          <h1 className="text-4xl font-bold text-white mb-3">My Games</h1>
        </div>

        <div className="flex justify-center mb-8">
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors text-xl"
          >
            {showForm ? 'Cancel' : '+ Create New Game'}
          </button>
        </div>

        {showForm && (
          <div className="mb-8">
            <CreateGameForm onSubmit={handleCreate} submitting={submitting} />
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-center">
            {error}
          </div>
        )}

        {games.length === 0 ? (
          <p className="text-slate-500 text-lg text-center">
            No games yet. Create your first game!
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {games.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                onClick={() => navigateToGame(game.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default GameCreator;
