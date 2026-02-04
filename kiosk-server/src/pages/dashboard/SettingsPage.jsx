import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { changePin } from '../../api/apps';
import { useSettings } from '../../hooks/useSettings';

export default function SettingsPage() {
  const { logout } = useOutletContext();
  const { settings, loading, updateSettings } = useSettings(true, logout);

  // Change PIN state
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');
  const [pinSaving, setPinSaving] = useState(false);

  // Bonus minutes state — null means "use value from settings"
  const [bonusMinutes, setBonusMinutes] = useState(null);
  const [bonusSaving, setBonusSaving] = useState(false);
  const [bonusSuccess, setBonusSuccess] = useState('');
  const [bonusError, setBonusError] = useState('');

  const displayBonusMinutes = bonusMinutes !== null ? bonusMinutes : (settings.challenge_bonus_minutes || '10');

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

  const handleSaveBonusMinutes = async (e) => {
    e.preventDefault();
    setBonusError('');
    setBonusSuccess('');

    const val = parseInt(displayBonusMinutes, 10);
    if (isNaN(val) || val < 1 || val > 120) {
      setBonusError('Must be between 1 and 120 minutes');
      return;
    }

    setBonusSaving(true);
    try {
      await updateSettings({ challenge_bonus_minutes: String(val) });
      setBonusSuccess('Saved');
      setTimeout(() => setBonusSuccess(''), 2000);
    } catch (err) {
      setBonusError(err.message);
    } finally {
      setBonusSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-slate-400">Loading settings...</div>;
  }

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

        {/* Challenge Bonus Time */}
        <div className="bg-slate-800 rounded-xl p-5">
          <h3 className="text-white font-medium mb-2">Challenge Bonus Time</h3>
          <p className="text-slate-400 text-sm mb-4">
            How many minutes a challenge completion awards as bonus screen time.
          </p>
          <form onSubmit={handleSaveBonusMinutes} className="flex items-end gap-3 max-w-sm">
            <div className="flex-1">
              <label className="block text-slate-400 text-sm mb-1">Minutes per challenge</label>
              <input
                type="number"
                min="1"
                max="120"
                value={displayBonusMinutes}
                onChange={(e) => setBonusMinutes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={bonusSaving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
            >
              {bonusSaving ? 'Saving...' : 'Save'}
            </button>
          </form>
          {bonusError && <p className="text-red-400 text-sm mt-2">{bonusError}</p>}
          {bonusSuccess && <p className="text-emerald-400 text-sm mt-2">{bonusSuccess}</p>}
        </div>
      </div>
    </>
  );
}
