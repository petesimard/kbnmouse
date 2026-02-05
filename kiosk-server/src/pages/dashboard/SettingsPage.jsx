import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { changePin } from '../../api/apps';
import { useSettings } from '../../hooks/useSettings';

export default function SettingsPage() {
  const { logout } = useOutletContext();
  const { settings, loading: settingsLoading, updateSettings } = useSettings(true, logout);

  // OpenAI config state
  const [openaiApiKey, setOpenaiApiKey] = useState(null);
  const [openaiEndpointUrl, setOpenaiEndpointUrl] = useState(null);
  const [openaiSaving, setOpenaiSaving] = useState(false);
  const [openaiError, setOpenaiError] = useState('');
  const [openaiSuccess, setOpenaiSuccess] = useState('');

  // Sync settings into local state once loaded
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  if (!settingsLoading && !settingsLoaded) {
    setOpenaiApiKey(settings.openai_api_key || '');
    setOpenaiEndpointUrl(settings.openai_endpoint_url || '');
    setSettingsLoaded(true);
  }

  const handleSaveOpenai = async (e) => {
    e.preventDefault();
    setOpenaiError('');
    setOpenaiSuccess('');
    setOpenaiSaving(true);
    try {
      await updateSettings({
        openai_api_key: openaiApiKey,
        openai_endpoint_url: openaiEndpointUrl,
      });
      setOpenaiSuccess('OpenAI settings saved');
    } catch (err) {
      setOpenaiError(err.message);
    } finally {
      setOpenaiSaving(false);
    }
  };

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
        {/* OpenAI Configuration */}
        <div className="bg-slate-800 rounded-xl p-5">
          <h3 className="text-white font-medium mb-4">OpenAI Configuration</h3>
          <form onSubmit={handleSaveOpenai} className="space-y-4 max-w-sm">
            <div>
              <label className="block text-slate-400 text-sm mb-1">API Key</label>
              <input
                type="password"
                value={openaiApiKey ?? ''}
                onChange={(e) => setOpenaiApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
              />
              <p className="text-xs text-slate-500 mt-1">
                Used by ChatBot and Image Generator. Get one from platform.openai.com
              </p>
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Endpoint URL</label>
              <input
                type="text"
                value={openaiEndpointUrl ?? ''}
                onChange={(e) => setOpenaiEndpointUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500 font-mono"
              />
              <p className="text-xs text-slate-500 mt-1">
                Leave blank to use the default OpenAI endpoint. Set this if using a compatible API provider.
              </p>
            </div>
            {openaiError && <p className="text-red-400 text-sm">{openaiError}</p>}
            {openaiSuccess && <p className="text-emerald-400 text-sm">{openaiSuccess}</p>}
            <button
              type="submit"
              disabled={openaiSaving || !settingsLoaded}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
            >
              {openaiSaving ? 'Saving...' : 'Save'}
            </button>
          </form>
        </div>

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
