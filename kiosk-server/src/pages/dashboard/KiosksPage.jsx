import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { fetchKiosks, claimPairingCode, deleteKiosk } from '../../api/auth';

export default function KiosksPage() {
  const { logout } = useOutletContext();
  const [kiosks, setKiosks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [kioskName, setKioskName] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadKiosks = async () => {
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
  };

  useEffect(() => {
    loadKiosks();
  }, []);

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
              {kiosks.map((kiosk) => (
                <div key={kiosk.id} className="flex items-center justify-between bg-slate-700 rounded-lg px-4 py-3">
                  <div>
                    <div className="text-white font-medium">{kiosk.name}</div>
                    <div className="text-slate-400 text-xs">
                      Registered {new Date(kiosk.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(kiosk.id)}
                    className="text-red-400 hover:text-red-300 text-sm px-3 py-1 rounded hover:bg-slate-600 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
