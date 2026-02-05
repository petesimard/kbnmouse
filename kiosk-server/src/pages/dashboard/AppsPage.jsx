import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useApps } from '../../hooks/useApps';
import { addBonusTime } from '../../api/apps';
import AppList from './AppList';
import AppFormModal from './AppFormModal';

export default function AppsPage() {
  const { logout, dashboardProfileId } = useOutletContext();
  const { apps, loading: appsLoading, createApp, updateApp, deleteApp, reorderApps } = useApps(true, logout, dashboardProfileId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [bonusModalOpen, setBonusModalOpen] = useState(false);
  const [bonusMinutes, setBonusMinutes] = useState(15);

  const handleAddApp = () => {
    setEditingApp(null);
    setModalOpen(true);
  };

  const handleEditApp = (app) => {
    setEditingApp(app);
    setModalOpen(true);
  };

  const handleSaveApp = async (formData) => {
    if (editingApp) {
      await updateApp(editingApp.id, formData);
    } else {
      await createApp({ ...formData, profile_id: dashboardProfileId });
    }
  };

  const handleToggleApp = async (app) => {
    await updateApp(app.id, { enabled: app.enabled ? 0 : 1 });
  };

  const handleDeleteApp = (app) => {
    setDeleteConfirm(app);
  };

  const handleAddBonusTime = async () => {
    await addBonusTime(bonusMinutes, dashboardProfileId);
    setBonusModalOpen(false);
    setBonusMinutes(15);
  };

  const confirmDelete = async () => {
    if (deleteConfirm) {
      await deleteApp(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  return (
    <>
      {/* Actions bar */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium text-white">
          Manage Apps
          {!appsLoading && (
            <span className="ml-2 text-slate-400 text-sm font-normal">
              ({apps.length} apps)
            </span>
          )}
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setBonusModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Bonus Time
          </button>
          <button
            onClick={handleAddApp}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add App
          </button>
        </div>
      </div>

      {/* App list */}
      {appsLoading ? (
        <div className="text-center py-12 text-slate-400">Loading apps...</div>
      ) : (
        <AppList
          apps={apps}
          onReorder={reorderApps}
          onEdit={handleEditApp}
          onDelete={handleDeleteApp}
          onToggle={handleToggleApp}
        />
      )}

      {/* Help text */}
      <p className="mt-6 text-slate-500 text-sm text-center">
        Drag apps to reorder. Toggle the switch to show/hide apps in the menu.
      </p>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <AppFormModal
          app={editingApp}
          onSave={handleSaveApp}
          onClose={() => setModalOpen(false)}
        />
      )}

      {/* Bonus Time Modal */}
      {bonusModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-white mb-4">Add Bonus Time</h3>
            <p className="text-slate-400 text-sm mb-4">
              Grant extra screen time for today. This applies to all apps with time limits.
            </p>
            <div className="flex items-center gap-3 mb-6">
              <input
                type="number"
                min="1"
                max="120"
                value={bonusMinutes}
                onChange={(e) => setBonusMinutes(Number(e.target.value))}
                className="flex-1 px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:outline-none focus:border-emerald-500"
              />
              <span className="text-slate-400">minutes</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setBonusModalOpen(false)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddBonusTime}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
              >
                Add Time
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-white mb-2">Delete App?</h3>
            <p className="text-slate-400 mb-6">
              Are you sure you want to delete "{deleteConfirm.name}"? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
