import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useSettings } from '../../hooks/useSettings';
import { changePassword } from '../../api/auth';

export default function SettingsPage() {
  const { logout } = useOutletContext();
  const { settings, loading: settingsLoading, updateSettings } = useSettings(true, logout);

  // Parent name state
  const [parentName, setParentName] = useState(null);
  const [parentNameSaving, setParentNameSaving] = useState(false);
  const [parentNameError, setParentNameError] = useState('');
  const [parentNameSuccess, setParentNameSuccess] = useState('');

  // Sync settings into local state once loaded
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  if (!settingsLoading && !settingsLoaded) {
    setParentName(settings.parent_name || 'Mom & Dad');
    setSettingsLoaded(true);
  }

  const handleSaveParentName = async (e) => {
    e.preventDefault();
    setParentNameError('');
    setParentNameSuccess('');
    if (!parentName?.trim()) {
      setParentNameError('Name cannot be empty');
      return;
    }
    setParentNameSaving(true);
    try {
      await updateSettings({ parent_name: parentName.trim() });
      setParentNameSuccess('Parent name saved');
    } catch (err) {
      setParentNameError(err.message);
    } finally {
      setParentNameSaving(false);
    }
  };

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (newPassword.length < 8) {
      setPwError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match');
      return;
    }

    setPwSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPwSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwError(err.message);
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <>
      <h2 className="text-lg font-medium text-white mb-6">Settings</h2>

      <div className="space-y-8">
        {/* Parent Name */}
        <div className="bg-slate-800 rounded-xl p-5">
          <h3 className="text-white font-medium mb-4">Parent Display Name</h3>
          <form onSubmit={handleSaveParentName} className="space-y-4 max-w-sm">
            <div>
              <label className="block text-slate-400 text-sm mb-1">Name</label>
              <input
                type="text"
                value={parentName ?? ''}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="Mom & Dad"
                className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Shown to kids in messages, bulletin board, and other places where "Parents" would normally appear.
              </p>
            </div>
            {parentNameError && <p className="text-red-400 text-sm">{parentNameError}</p>}
            {parentNameSuccess && <p className="text-emerald-400 text-sm">{parentNameSuccess}</p>}
            <button
              type="submit"
              disabled={parentNameSaving || !settingsLoaded}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
            >
              {parentNameSaving ? 'Saving...' : 'Save'}
            </button>
          </form>
        </div>

        {/* Change Password */}
        <div className="bg-slate-800 rounded-xl p-5">
          <h3 className="text-white font-medium mb-4">Change Password</h3>
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
            <div>
              <label className="block text-slate-400 text-sm mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 characters"
                className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            {pwError && <p className="text-red-400 text-sm">{pwError}</p>}
            {pwSuccess && <p className="text-emerald-400 text-sm">{pwSuccess}</p>}
            <button
              type="submit"
              disabled={pwSaving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
            >
              {pwSaving ? 'Saving...' : 'Change Password'}
            </button>
          </form>
        </div>

      </div>
    </>
  );
}
