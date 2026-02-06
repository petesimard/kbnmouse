export default function ConfigField({ fieldKey, field, value, error, onChange }) {
  const id = `config-${fieldKey}`;

  let input;
  switch (field.type) {
    case 'boolean':
      input = (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(fieldKey, e.target.checked)}
            className="w-4 h-4 rounded bg-slate-600 border-slate-500 text-blue-500 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-300">{field.label}</span>
        </label>
      );
      break;
    case 'select':
      input = (
        <select
          id={id}
          value={value ?? ''}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {(field.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
      break;
    case 'number':
      input = (
        <input
          id={id}
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(fieldKey, e.target.value === '' ? '' : Number(e.target.value))}
          min={field.min}
          max={field.max}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      );
      break;
    default:
      input = (
        <input
          id={id}
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      );
  }

  return (
    <div>
      {field.type !== 'boolean' && (
        <label htmlFor={id} className="block text-sm font-medium text-slate-300 mb-1">
          {field.label}
        </label>
      )}
      {input}
      {field.description && (
        <p className="mt-1 text-xs text-slate-500">{field.description}</p>
      )}
      {error && (
        <p className="mt-1 text-red-400 text-sm">{error}</p>
      )}
    </div>
  );
}
