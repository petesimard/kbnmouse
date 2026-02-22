import { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { fetchKiosks, claimPairingCode, deleteKiosk, fetchServerVersion, updateKiosk } from '../../api/auth';

export default function KiosksPage() {
  const { logout } = useOutletContext();
  const [kiosks, setKiosks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [kioskName, setKioskName] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [serverHash, setServerHash] = useState(null);
  const [updatingKiosks, setUpdatingKiosks] = useState(new Set());
  const pollRef = useRef(null);
  const wsRef = useRef(null);

  const loadKiosks = useCallback(async () => {
    try {
      const data = await fetchKiosks();
      setKiosks(data);
    } catch (err) {
      if (err.name === 'UnauthorizedError') {
        logout();
        return;
      }
      console.error('Failed to load kiosks:', err);
    } finally {
      setLoading(false);
    }
  }, [logout]);

  const loadServerVersion = useCallback(async () => {
    try {
      const data = await fetchServerVersion();
      setServerHash(data.hash);
    } catch (err) {
      if (err.name === 'UnauthorizedError') {
        logout();
        return;
      }
      console.error('Failed to load server version:', err);
    }
  }, [logout]);

  // WebSocket for real-time kiosk status updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    function connect() {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'kiosk_status_change') {
            setKiosks(prev => prev.map(k =>
              k.id === msg.kioskId
                ? { ...k, connected: msg.connected, git_hash: msg.connected ? k.git_hash : null }
                : k
            ));
          }
          if (msg.type === 'kiosk_version') {
            setKiosks(prev => prev.map(k =>
              k.id === msg.kioskId
                ? { ...k, git_hash: msg.gitHash }
                : k
            ));
          }
          if (msg.type === 'kiosk_update_status') {
            if (msg.status === 'updating') {
              setUpdatingKiosks(prev => new Set([...prev, msg.kioskId]));
            } else if (msg.status === 'restarting' || msg.status === 'error') {
              setUpdatingKiosks(prev => {
                const next = new Set(prev);
                next.delete(msg.kioskId);
                return next;
              });
              if (msg.status === 'error') {
                setError(`Kiosk update failed: ${msg.error || 'Unknown error'}`);
              }
            }
          }
        } catch {}
      };

      ws.onclose = () => {
        wsRef.current = null;
        setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    loadKiosks();
    loadServerVersion();
  }, [loadKiosks, loadServerVersion]);

  // Poll kiosks while any are updating
  useEffect(() => {
    if (updatingKiosks.size > 0) {
      pollRef.current = setInterval(loadKiosks, 5000);
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [updatingKiosks.size, loadKiosks]);

  const handleClaim = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (code.length !== 5 || !/^\d{5}$/.test(code)) {
      setError('Please enter a valid 5-digit pairing code');
      return;
    }
    setClaiming(true);
    try {
      await claimPairingCode(code, kioskName || 'Kiosk');
      setSuccess('Kiosk paired successfully!');
      setCode('');
      setKioskName('');
      loadKiosks();
    } catch (err) {
      setError(err.message || 'Failed to pair kiosk');
    } finally {
      setClaiming(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteKiosk(id);
      setKiosks(kiosks.filter(k => k.id !== id));
    } catch (err) {
      if (err.name === 'UnauthorizedError') {
        logout();
        return;
      }
      setError(err.message || 'Failed to remove kiosk');
    }
  };

  const handleUpdate = async (id) => {
    setError('');
    setUpdatingKiosks(prev => new Set([...prev, id]));
    try {
      await updateKiosk(id);
    } catch (err) {
      setUpdatingKiosks(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (err.name === 'UnauthorizedError') {
        logout();
        return;
      }
      setError(err.message || 'Failed to send update command');
    }
  };

  function getVersionStatus(kiosk) {
    if (!kiosk.connected) {
      return { label: 'Offline', color: 'text-slate-500', dot: 'bg-slate-500' };
    }
    if (updatingKiosks.has(kiosk.id)) {
      return { label: 'Updating...', color: 'text-amber-400', dot: 'bg-amber-400', updating: true };
    }
    if (!kiosk.git_hash || !serverHash) {
      return { label: 'Connected', color: 'text-emerald-400', dot: 'bg-emerald-400' };
    }
    if (kiosk.git_hash === serverHash) {
      return { label: 'Up to date', color: 'text-emerald-400', dot: 'bg-emerald-400' };
    }
    return { label: 'Update available', color: 'text-amber-400', dot: 'bg-amber-400', canUpdate: true };
  }

  return (
    <>
      <h2 className="text-lg font-medium text-white mb-6">Kiosks</h2>

      <div className="space-y-8">
        {/* Pair a kiosk */}
        <div className="bg-slate-800 rounded-xl p-5">
          <h3 className="text-white font-medium mb-2">Pair a Kiosk</h3>
          <p className="text-slate-400 text-sm mb-4">
            Enter the 5-digit code displayed on the kiosk screen to register it.
          </p>
          <form onSubmit={handleClaim} className="flex flex-col sm:flex-row gap-3 max-w-lg">
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, '').slice(0, 5));
                setError('');
              }}
              placeholder="12345"
              className="px-4 py-2 bg-slate-700 text-white text-center text-xl tracking-[0.3em] rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 w-36 font-mono"
              disabled={claiming}
            />
            <input
              type="text"
              value={kioskName}
              onChange={(e) => setKioskName(e.target.value)}
              placeholder="Kiosk name (optional)"
              className="px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1"
              disabled={claiming}
            />
            <button
              type="submit"
              disabled={claiming || code.length !== 5}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              {claiming ? 'Pairing...' : 'Pair'}
            </button>
          </form>
          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
          {success && <p className="text-emerald-400 text-sm mt-3">{success}</p>}
        </div>

        <div className="bg-blue-900/30 border border-blue-700/40 rounded-xl p-4">
          <p className="text-slate-300 text-sm">
            You can install the kbnmouse client software on any compatible Linux system to turn it into a kiosk for your kids.{' '}
            <a
              href="https://github.com/petesimard/kbnmouse?tab=readme-ov-file#quick-install"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              Follow the installation guide
            </a>{' '}
            to get started.
          </p>
        </div>

        {/* Registered kiosks */}
        <div className="bg-slate-800 rounded-xl p-5">
          <h3 className="text-white font-medium mb-4">Registered Kiosks</h3>
          {loading ? (
            <p className="text-slate-400 text-sm">Loading...</p>
          ) : kiosks.length === 0 ? (
            <div className="text-slate-400 text-sm space-y-3">
              <p>No kiosks registered yet.</p>
              <p>
                To get started, install the kiosk software on the computer your kids will use.
                Follow the{' '}
                <a
                  href="https://github.com/petesimard/kbnmouse?tab=readme-ov-file#quick-install"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  installation guide
                </a>{' '}
                to set it up. Once installed, the kiosk will display a 5-digit pairing code that you can enter above.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {kiosks.map((kiosk) => {
                const status = getVersionStatus(kiosk);
                return (
                  <div key={kiosk.id} className="flex items-center justify-between bg-slate-700 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${status.dot}${status.updating ? ' animate-pulse' : ''}`} />
                      <div className="min-w-0">
                        <div className="text-white font-medium">{kiosk.name}</div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className={status.color}>{status.label}</span>
                          <span className="text-slate-500">
                            Registered {new Date(kiosk.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {status.canUpdate && (
                        <button
                          onClick={() => handleUpdate(kiosk.id)}
                          className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded transition-colors"
                        >
                          Update
                        </button>
                      )}
                      {status.updating && (
                        <span className="text-amber-400 text-sm flex items-center gap-1.5">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        </span>
                      )}
                      <button
                        onClick={() => handleDelete(kiosk.id)}
                        className="text-red-400 hover:text-red-300 text-sm px-3 py-1 rounded hover:bg-slate-600 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
