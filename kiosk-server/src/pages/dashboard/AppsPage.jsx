import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import { useApps } from '../../hooks/useApps';
import { useFolders } from '../../hooks/useFolders';
import { addBonusTime } from '../../api/apps';
import AppList from './AppList';
import AppFormModal from './AppFormModal';
import FolderFormModal from './FolderFormModal';
import FolderCard from './FolderCard';

function UngroupedDropZone({ hasFolders, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'ungrouped' });

  if (!hasFolders) return children;

  return (
    <div ref={setNodeRef}>
      <h3 className={`text-sm font-medium mb-3 uppercase tracking-wider transition-colors ${isOver ? 'text-white' : 'text-slate-400'}`}>
        {isOver ? 'Drop here to remove from folder' : 'Ungrouped'}
      </h3>
      {children}
    </div>
  );
}

export default function AppsPage() {
  const { logout, dashboardProfileId } = useOutletContext();
  const { apps, loading: appsLoading, fetchApps, createApp, updateApp, deleteApp, reorderApps } = useApps(true, logout, dashboardProfileId);
  const { folders, loading: foldersLoading, createFolder, updateFolder, deleteFolder } = useFolders(true, logout, dashboardProfileId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [bonusModalOpen, setBonusModalOpen] = useState(false);
  const [bonusMinutes, setBonusMinutes] = useState(15);

  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState(null);
  const [deleteFolderConfirm, setDeleteFolderConfirm] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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

  // Folder handlers
  const handleAddFolder = () => {
    setEditingFolder(null);
    setFolderModalOpen(true);
  };

  const handleEditFolder = (folder) => {
    setEditingFolder(folder);
    setFolderModalOpen(true);
  };

  const handleSaveFolder = async (formData) => {
    if (editingFolder) {
      await updateFolder(editingFolder.id, formData);
    } else {
      await createFolder({ ...formData, profile_id: dashboardProfileId });
    }
  };

  const handleDeleteFolder = (folder) => {
    setDeleteFolderConfirm(folder);
  };

  const confirmDeleteFolder = async () => {
    if (deleteFolderConfirm) {
      await deleteFolder(deleteFolderConfirm.id);
      setDeleteFolderConfirm(null);
      fetchApps();
    }
  };

  // Unified drag end handler for cross-folder moves and within-group reorder
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;

    const overId = String(over.id);
    const activeApp = apps.find(a => a.id === active.id);
    if (!activeApp) return;

    // Dropped on a folder header
    if (overId.startsWith('folder-')) {
      const targetFolderId = Number(overId.replace('folder-', ''));
      if (activeApp.folder_id !== targetFolderId) {
        updateApp(active.id, { folder_id: targetFolderId });
      }
      return;
    }

    // Dropped on ungrouped zone
    if (overId === 'ungrouped') {
      if (activeApp.folder_id != null) {
        updateApp(active.id, { folder_id: null });
      }
      return;
    }

    // Dropped on another app
    const overApp = apps.find(a => a.id === over.id);
    if (!overApp || active.id === over.id) return;

    // Different folder — move to target app's folder
    if ((activeApp.folder_id ?? null) !== (overApp.folder_id ?? null)) {
      updateApp(active.id, { folder_id: overApp.folder_id ?? null });
      return;
    }

    // Same folder — reorder within group
    const group = activeApp.folder_id
      ? apps.filter(a => a.folder_id === activeApp.folder_id)
      : apps.filter(a => !a.folder_id);

    const oldIndex = group.findIndex(a => a.id === active.id);
    const newIndex = group.findIndex(a => a.id === over.id);
    const newGroupOrder = arrayMove(group, oldIndex, newIndex);
    const otherApps = apps.filter(a => (a.folder_id ?? null) !== (activeApp.folder_id ?? null));
    reorderApps([...otherApps, ...newGroupOrder]);
  };

  // Group apps by folder
  const folderAppsMap = {};
  const rootApps = [];
  for (const app of apps) {
    if (app.folder_id) {
      if (!folderAppsMap[app.folder_id]) folderAppsMap[app.folder_id] = [];
      folderAppsMap[app.folder_id].push(app);
    } else {
      rootApps.push(app);
    }
  }

  const loading = appsLoading || foldersLoading;
  const hasFolders = folders.length > 0;

  return (
    <>
      {/* Actions bar */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium text-white">
          Manage Apps
          {!loading && (
            <span className="ml-2 text-slate-400 text-sm font-normal">
              ({apps.length} apps{hasFolders ? `, ${folders.length} folders` : ''})
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
            onClick={handleAddFolder}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            Add Folder
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

      {/* App list grouped by folders */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading apps...</div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-6">
            {/* Folders with their apps */}
            {folders.map((folder) => {
              const folderApps = folderAppsMap[folder.id] || [];
              return (
                <div key={folder.id}>
                  <FolderCard
                    folder={folder}
                    appCount={folderApps.length}
                    onEdit={handleEditFolder}
                    onDelete={handleDeleteFolder}
                  />
                  <div className="ml-6 mt-2">
                    {folderApps.length > 0 ? (
                      <AppList
                        apps={folderApps}
                        noDndContext
                        onReorder={() => {}}
                        onEdit={handleEditApp}
                        onDelete={handleDeleteApp}
                        onToggle={handleToggleApp}
                      />
                    ) : (
                      <p className="text-slate-500 text-sm py-3 pl-4">No apps in this folder</p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Root (ungrouped) apps */}
            <UngroupedDropZone hasFolders={hasFolders}>
              {rootApps.length > 0 ? (
                <AppList
                  apps={rootApps}
                  noDndContext
                  onReorder={() => {}}
                  onEdit={handleEditApp}
                  onDelete={handleDeleteApp}
                  onToggle={handleToggleApp}
                />
              ) : hasFolders ? (
                <p className="text-slate-500 text-sm py-3">No ungrouped apps</p>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <p>No apps configured yet.</p>
                  <p className="text-sm mt-2">Click "Add App" to get started.</p>
                </div>
              )}
            </UngroupedDropZone>
          </div>
        </DndContext>
      )}

      {/* Help text */}
      <p className="mt-6 text-slate-500 text-sm text-center">
        Drag apps to reorder or move between folders. Toggle the switch to show/hide apps in the menu.
      </p>

      {/* Add/Edit App Modal */}
      {modalOpen && (
        <AppFormModal
          app={editingApp}
          onSave={handleSaveApp}
          onClose={() => setModalOpen(false)}
          folders={folders}
        />
      )}

      {/* Add/Edit Folder Modal */}
      {folderModalOpen && (
        <FolderFormModal
          folder={editingFolder}
          onSave={handleSaveFolder}
          onClose={() => setFolderModalOpen(false)}
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

      {/* Delete App Confirmation */}
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

      {/* Delete Folder Confirmation */}
      {deleteFolderConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-white mb-2">Delete Folder?</h3>
            <p className="text-slate-400 mb-6">
              Are you sure you want to delete "{deleteFolderConfirm.name}"? Apps in this folder will be moved to the root level.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteFolderConfirm(null)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteFolder}
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
