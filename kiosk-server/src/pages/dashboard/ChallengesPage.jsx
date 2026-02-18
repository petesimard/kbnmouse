import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useChallenges } from '../../hooks/useChallenges';
import ChallengeList from './ChallengeList';
import ChallengeFormModal from './ChallengeFormModal';
import ChallengeLog from './ChallengeLog';
import DeleteConfirmModal from '../../components/common/DeleteConfirmModal';

export default function ChallengesPage() {
  const { logout, dashboardProfileId } = useOutletContext();
  const { challenges, loading, createChallenge, updateChallenge, deleteChallenge, reorderChallenges } = useChallenges(true, logout, dashboardProfileId);

  const [tab, setTab] = useState('manage');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const handleAdd = () => {
    setEditingChallenge(null);
    setModalOpen(true);
  };

  const handleEdit = (challenge) => {
    setEditingChallenge(challenge);
    setModalOpen(true);
  };

  const handleSave = async (formData) => {
    if (editingChallenge) {
      await updateChallenge(editingChallenge.id, formData);
    } else {
      await createChallenge({ ...formData, profile_id: dashboardProfileId });
    }
  };

  const handleToggle = async (challenge) => {
    await updateChallenge(challenge.id, { enabled: challenge.enabled ? 0 : 1 });
  };

  const handleDelete = (challenge) => {
    setDeleteConfirm(challenge);
  };

  const confirmDelete = async () => {
    if (deleteConfirm) {
      await deleteChallenge(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  return (
    <>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-800/50 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('manage')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'manage'
              ? 'bg-slate-700 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Manage
        </button>
        <button
          onClick={() => setTab('log')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'log'
              ? 'bg-slate-700 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Log
        </button>
      </div>

      {tab === 'manage' ? (
        <>
          {/* Actions bar */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium text-white">
              Manage Challenges
              {!loading && (
                <span className="ml-2 text-slate-400 text-sm font-normal">
                  ({challenges.length} challenges)
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
              Add Challenge
            </button>
          </div>

          {/* Challenge list */}
          {loading ? (
            <div className="text-center py-12 text-slate-400">Loading challenges...</div>
          ) : (
            <ChallengeList
              challenges={challenges}
              onReorder={reorderChallenges}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggle={handleToggle}
            />
          )}

          {/* Help text */}
          <p className="mt-6 text-slate-500 text-sm text-center">
            Drag challenges to reorder. Toggle the switch to show/hide challenges.
          </p>

          {/* Add/Edit Modal */}
          {modalOpen && (
            <ChallengeFormModal
              challenge={editingChallenge}
              onSave={handleSave}
              onClose={() => setModalOpen(false)}
            />
          )}

          {/* Delete Confirmation */}
          {deleteConfirm && (
            <DeleteConfirmModal
              entityName="Challenge"
              itemName={deleteConfirm.name}
              onConfirm={confirmDelete}
              onClose={() => setDeleteConfirm(null)}
            />
          )}
        </>
      ) : (
        <>
          <h2 className="text-lg font-medium text-white mb-6">Completion Log</h2>
          <ChallengeLog profileId={dashboardProfileId} onUnauthorized={logout} />
        </>
      )}
    </>
  );
}
