import { useState, useEffect } from 'react';
import { useBuiltinApps } from '../../hooks/useApps';

function AppFormModal({ app, onSave, onClose }) {
  const { builtinApps } = useBuiltinApps();
  const isEditing = !!app;

  const [formData, setFormData] = useState({
    name: '',
    url: '',
    icon: '',
    app_type: 'url',
    enabled: 1,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (app) {
      setFormData({
        name: app.name || '',
        url: app.url || '',
        icon: app.icon || '',
        app_type: app.app_type || 'url',
        enabled: app.enabled ?? 1,
      });
    }
  }, [app]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleTypeChange = (type) => {
    setFormData((prev) => ({
      ...prev,
      app_type: type,
      url: type === 'builtin' ? '' : prev.url,
    }));
  };

  const handleBuiltinSelect = (builtin) => {
    setFormData((prev) => ({
      ...prev,
      name: prev.name || builtin.name,
      url: builtin.key,
      icon: prev.icon || builtin.icon,
    }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.url.trim()) {
      newErrors.url = formData.app_type === 'builtin' ? 'Select a built-in app' : 'URL is required';
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
      <div className="bg-slate-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-6">
            {isEditing ? 'Edit App' : 'Add New App'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* App Type Selector */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                App Type
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleTypeChange('url')}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    formData.app_type === 'url'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  URL
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('builtin')}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    formData.app_type === 'builtin'
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  Built-in
                </button>
              </div>
            </div>

            {/* Built-in App Selector */}
            {formData.app_type === 'builtin' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Select Built-in App
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {builtinApps.map((builtin) => (
                    <button
                      key={builtin.key}
                      type="button"
                      onClick={() => handleBuiltinSelect(builtin)}
                      className={`flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                        formData.url === builtin.key
                          ? 'bg-purple-600/30 border border-purple-500'
                          : 'bg-slate-700 hover:bg-slate-600'
                      }`}
                    >
                      <span className="text-2xl">{builtin.icon}</span>
                      <div>
                        <div className="text-white font-medium">{builtin.name}</div>
                        <div className="text-slate-400 text-sm">{builtin.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
                {errors.url && (
                  <p className="mt-1 text-red-400 text-sm">{errors.url}</p>
                )}
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Display Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="My App"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.name && (
                <p className="mt-1 text-red-400 text-sm">{errors.name}</p>
              )}
            </div>

            {/* URL (for URL type only) */}
            {formData.app_type === 'url' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  URL
                </label>
                <input
                  type="text"
                  name="url"
                  value={formData.url}
                  onChange={handleChange}
                  placeholder="https://example.com"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.url && (
                  <p className="mt-1 text-red-400 text-sm">{errors.url}</p>
                )}
              </div>
            )}

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
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl"
              />
              {errors.icon && (
                <p className="mt-1 text-red-400 text-sm">{errors.icon}</p>
              )}
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
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg transition-colors"
              >
                {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add App'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AppFormModal;
