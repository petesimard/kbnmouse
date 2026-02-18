import Modal from '../Modal';

export default function DeleteConfirmModal({ entityName, itemName, message, onConfirm, onClose }) {
  return (
    <Modal onClose={onClose} className="p-6 w-full max-w-sm">
        <h3 className="text-lg font-bold text-white mb-2">Delete {entityName}?</h3>
        <p className="text-slate-400 mb-6">
          {message || `Are you sure you want to delete "${itemName}"? This cannot be undone.`}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Delete
          </button>
        </div>
    </Modal>
  );
}
