import { useDroppable } from '@dnd-kit/core';

function FolderCard({ folder, appCount, onEdit, onDelete }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `folder-${folder.id}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-4 p-4 rounded-lg transition-all duration-200 ${isOver ? 'ring-2 ring-white scale-[1.02]' : ''}`}
      style={{ backgroundColor: folder.color + (isOver ? '66' : '33') }}
    >
      {/* Folder icon */}
      <span className="text-3xl">{folder.icon}</span>

      {/* Folder info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-white font-medium truncate">{folder.name}</h3>
        <p className="text-slate-400 text-sm">
          {isOver ? 'Drop here to move into folder' : `${appCount} ${appCount === 1 ? 'app' : 'apps'}`}
        </p>
      </div>

      {/* Folder badge */}
      <span
        className="px-2 py-1 text-xs rounded"
        style={{ backgroundColor: folder.color + '4D', color: folder.color }}
      >
        Folder
      </span>

      {/* Edit button */}
      <button
        onClick={() => onEdit(folder)}
        className="p-2 text-slate-400 hover:text-white transition-colors"
        title="Edit folder"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>

      {/* Delete button */}
      <button
        onClick={() => onDelete(folder)}
        className="p-2 text-slate-400 hover:text-red-400 transition-colors"
        title="Delete folder"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}

export default FolderCard;
