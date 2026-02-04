import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { changePin } from '../../api/apps';

export default function SettingsPage() {
  const { logout } = useOutletContext();

  // Change PIN state
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');
  const [pinSaving, setPinSaving] = useState(false);

  const handleChangePin = async (e) => {
    e.preventDefault();
    setPinError('');
    setPinSuccess('');

    if (!/^\d{4,6}$/.test(newPin)) {
      setPinError('PIN must be 4-6 digits');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('PINs do not match');
      return;
    }

    setPinSaving(true);
    try {
      await changePin(currentPin, newPin);
      setPinSuccess('PIN changed successfully');
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } catch (err) {
      setPinError(err.message);
    } finally {
      setPinSaving(false);
    }
  };

  return (
    <>
      <h2 className="text-lg font-medium text-white mb-6">Settings</h2>

      <div className="space-y-8">
        {/* Change PIN */}
        <div className="bg-slate-800 rounded-xl p-5">
          <h3 className="text-white font-medium mb-4">Change PIN</h3>
          <form onSubmit={handleChangePin} className="space-y-4 max-w-sm">
            <div>
              <label className="block text-slate-400 text-sm mb-1">Current PIN</label>
              <input
                type="password"
                inputMode="numeric"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">New PIN</label>
              <input
                type="password"
                inputMode="numeric"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="4-6 digits"
                className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Confirm New PIN</label>
              <input
                type="password"
                inputMode="numeric"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            {pinError && <p className="text-red-400 text-sm">{pinError}</p>}
            {pinSuccess && <p className="text-emerald-400 text-sm">{pinSuccess}</p>}
            <button
              type="submit"
              disabled={pinSaving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
            >
              {pinSaving ? 'Saving...' : 'Change PIN'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
