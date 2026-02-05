import { useState, useEffect } from 'react';

const PRESET_COLORS = [
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Lime', value: '#84cc16' },
];

function FolderFormModal({ folder, onSave, onClose }) {
  const isEditing = !!folder;

  const [formData, setFormData] = useState({
    name: '',
    icon: '📁',
    color: '#6366f1',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (folder) {
      setFormData({
        name: folder.name || '',
        icon: folder.icon || '📁',
        color: folder.color || '#6366f1',
      });
    }
  }, [folder]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.icon.trim()) {
      newErrors.icon = 'Icon is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      setErrors({ submit: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-xl w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-6">
            {isEditing ? 'Edit Folder' : 'Add New Folder'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Folder Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="My Folder"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {errors.name && (
                <p className="mt-1 text-red-400 text-sm">{errors.name}</p>
              )}
            </div>

            {/* Icon */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Icon (emoji)
              </label>
              <input
                type="text"
                name="icon"
                value={formData.icon}
                onChange={handleChange}
                placeholder="Pick an emoji"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center text-2xl"
              />
              {errors.icon && (
                <p className="mt-1 text-red-400 text-sm">{errors.icon}</p>
              )}
            </div>

            {/* Color */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Color
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, color: c.value }))}
                    className="w-9 h-9 rounded-full transition-all"
                    style={{
                      backgroundColor: c.value,
                      outline: formData.color === c.value ? '3px solid white' : 'none',
                      outlineOffset: '2px',
                    }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            {errors.submit && (
              <p className="text-red-400 text-sm text-center">{errors.submit}</p>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 text-white rounded-lg transition-colors"
              >
                {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Folder'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default FolderFormModal;
