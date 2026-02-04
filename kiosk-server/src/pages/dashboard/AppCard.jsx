import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function AppCard({ app, onEdit, onDelete, onToggle }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: app.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-4 p-4 bg-slate-700 rounded-lg ${
        !app.enabled ? 'opacity-60' : ''
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-2 text-slate-400 hover:text-white transition-colors"
        title="Drag to reorder"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
        </svg>
      </button>

      {/* App icon */}
      <span className="text-3xl">{app.icon}</span>

      {/* App info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-white font-medium truncate">{app.name}</h3>
        <p className="text-slate-400 text-sm truncate">
          {app.app_type === 'builtin' ? `Built-in: ${app.url}`
            : app.app_type === 'native' ? `Command: ${app.url}`
            : app.url}
        </p>
      </div>

      {/* Type badge */}
      <span
        className={`px-2 py-1 text-xs rounded ${
          app.app_type === 'builtin'
            ? 'bg-purple-600/30 text-purple-300'
            : app.app_type === 'native'
            ? 'bg-green-600/30 text-green-300'
            : 'bg-blue-600/30 text-blue-300'
        }`}
      >
        {app.app_type === 'builtin' ? 'Built-in' : app.app_type === 'native' ? 'Native' : 'URL'}
      </span>

      {/* Toggle enabled */}
      <button
        onClick={() => onToggle(app)}
        className={`w-12 h-6 rounded-full relative transition-colors ${
          app.enabled ? 'bg-green-600' : 'bg-slate-600'
        }`}
        title={app.enabled ? 'Disable app' : 'Enable app'}
      >
        <span
          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
            app.enabled ? 'left-7' : 'left-1'
          }`}
        />
      </button>

      {/* Edit button */}
      <button
        onClick={() => onEdit(app)}
        className="p-2 text-slate-400 hover:text-white transition-colors"
        title="Edit app"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>

      {/* Delete button */}
      <button
        onClick={() => onDelete(app)}
        className="p-2 text-slate-400 hover:text-red-400 transition-colors"
        title="Delete app"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}

export default AppCard;
