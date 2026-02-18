import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useProfiles } from '../../hooks/useProfiles';
import ProfileFormModal from './ProfileFormModal';
import DeleteConfirmModal from '../../components/common/DeleteConfirmModal';

export default function ProfilesPage() {
  const { logout, refreshDashboardProfiles } = useOutletContext();
  const { profiles, loading, createProfile, updateProfile, deleteProfile } = useProfiles(true, logout);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const handleAdd = () => {
    setEditingProfile(null);
    setModalOpen(true);
  };

  const handleEdit = (profile) => {
    setEditingProfile(profile);
    setModalOpen(true);
  };

  const handleSave = async (formData) => {
    if (editingProfile) {
      await updateProfile(editingProfile.id, formData);
    } else {
      await createProfile(formData);
    }
    refreshDashboardProfiles();
  };

  const handleDelete = (profile) => {
    setDeleteConfirm(profile);
  };

  const confirmDelete = async () => {
    if (deleteConfirm) {
      await deleteProfile(deleteConfirm.id);
      setDeleteConfirm(null);
      refreshDashboardProfiles();
    }
  };

  return (
    <>
      {/* Actions bar */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium text-white">
          Manage Profiles
          {!loading && (
            <span className="ml-2 text-slate-400 text-sm font-normal">
              ({profiles.length} profiles)
            </span>
          )}
        </h2>
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Profile
        </button>
      </div>

      {/* Profile list */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading profiles...</div>
      ) : (
        <div className="space-y-3">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="flex items-center gap-4 bg-slate-800 rounded-xl p-4"
            >
              <span className="text-3xl">{profile.icon}</span>
              <div className="flex-1">
                <div className="text-white font-medium">{profile.name}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEdit(profile)}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(profile)}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white text-sm rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-slate-500 text-sm text-center">
        Each profile gets its own apps, challenges, and usage tracking.
        New profiles are seeded with default apps and challenges.
      </p>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <ProfileFormModal
          profile={editingProfile}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <DeleteConfirmModal
          entityName="Profile"
          itemName={deleteConfirm.name}
          message={`Are you sure you want to delete "${deleteConfirm.name}"? This will remove all their apps, challenges, usage data, and completions. This cannot be undone.`}
          onConfirm={confirmDelete}
          onClose={() => setDeleteConfirm(null)}
        />
      )}
    </>
  );
}
