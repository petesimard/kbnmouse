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
    daily_limit_minutes: '',
    weekly_limit_minutes: '',
    max_daily_minutes: '',
    config: {},
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
        daily_limit_minutes: app.daily_limit_minutes ?? '',
        weekly_limit_minutes: app.weekly_limit_minutes ?? '',
        max_daily_minutes: app.max_daily_minutes || '',
        config: app.config || {},
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
      url: '',
      config: {},
      ...(type !== 'native' ? { daily_limit_minutes: '', weekly_limit_minutes: '', max_daily_minutes: '' } : {}),
    }));
  };

  const handleConfigChange = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      config: { ...prev.config, [key]: value },
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
      newErrors.url =
        formData.app_type === 'builtin' ? 'Select a built-in app'
        : formData.app_type === 'native' ? 'Launch command is required'
        : 'URL is required';
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
      const dataToSave = {
        ...formData,
        daily_limit_minutes: formData.daily_limit_minutes === '' ? null : parseInt(formData.daily_limit_minutes),
        weekly_limit_minutes: formData.weekly_limit_minutes === '' ? null : parseInt(formData.weekly_limit_minutes),
        max_daily_minutes: formData.max_daily_minutes === '' ? 0 : parseInt(formData.max_daily_minutes),
        config: formData.config,
      };
      await onSave(dataToSave);
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
                <button
                  type="button"
                  onClick={() => handleTypeChange('native')}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    formData.app_type === 'native'
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  Native
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

            {/* ChatBot Settings (for chatbot builtin only) */}
            {formData.app_type === 'builtin' && formData.url === 'chatbot' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    OpenAI API Key
                  </label>
                  <input
                    type="password"
                    value={formData.config.openai_api_key || ''}
                    onChange={(e) => handleConfigChange('openai_api_key', e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Required for ChatBot to work. Get one from platform.openai.com
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Model
                  </label>
                  <select
                    value={formData.config.model || 'gpt-5-mini'}
                    onChange={(e) => handleConfigChange('model', e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="gpt-5-mini">GPT-5 Mini (Fast)</option>
                    <option value="gpt-5.2">GPT-5.2 (Best)</option>
                    <option value="gpt-5-nano">GPT-5 Nano (Cheapest)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    System Prompt
                  </label>
                  <textarea
                    value={formData.config.system_prompt ?? 'You are a friendly, helpful assistant for children. Keep your responses simple, age-appropriate, and encouraging. Avoid any inappropriate content, violence, or scary topics. Be patient and explain things in a way that is easy to understand. If asked about something inappropriate, politely redirect to a safer topic.'}
                    onChange={(e) => handleConfigChange('system_prompt', e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Instructions that guide the AI's behavior. The default is kid-friendly.
                  </p>
                </div>
              </>
            )}

            {/* Image Generator Settings (for imagegen builtin only) */}
            {formData.app_type === 'builtin' && formData.url === 'imagegen' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    OpenAI API Key
                  </label>
                  <input
                    type="password"
                    value={formData.config.openai_api_key || ''}
                    onChange={(e) => handleConfigChange('openai_api_key', e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Required for Image Generator. Get one from platform.openai.com
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Image Size
                  </label>
                  <select
                    value={formData.config.image_size || '1024x1024'}
                    onChange={(e) => handleConfigChange('image_size', e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="1024x1024">Square (1024x1024)</option>
                    <option value="1792x1024">Landscape (1792x1024)</option>
                    <option value="1024x1792">Portrait (1024x1792)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Image Quality
                  </label>
                  <select
                    value={formData.config.image_quality || 'standard'}
                    onChange={(e) => handleConfigChange('image_quality', e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="standard">Standard (Faster)</option>
                    <option value="hd">HD (More Detail)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Image Style
                  </label>
                  <select
                    value={formData.config.image_style || 'vivid'}
                    onChange={(e) => handleConfigChange('image_style', e.target.value)}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="vivid">Vivid (Colorful)</option>
                    <option value="natural">Natural (Realistic)</option>
                  </select>
                </div>
              </>
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

            {/* Launch Command (for native type only) */}
            {formData.app_type === 'native' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Launch Command
                  </label>
                  <input
                    type="text"
                    name="url"
                    value={formData.url}
                    onChange={handleChange}
                    placeholder="e.g. gnome-calculator"
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500 font-mono"
                  />
                  {errors.url && (
                    <p className="mt-1 text-red-400 text-sm">{errors.url}</p>
                  )}
                </div>

                {/* Time Limits */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Time Limits
                  </label>
                  <p className="text-xs text-slate-500 mb-2">
                    Leave blank for no limit. App will auto-close when time runs out.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Daily (minutes)</label>
                      <input
                        type="number"
                        name="daily_limit_minutes"
                        value={formData.daily_limit_minutes}
                        onChange={handleChange}
                        min="1"
                        placeholder="No limit"
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Weekly (minutes)</label>
                      <input
                        type="number"
                        name="weekly_limit_minutes"
                        value={formData.weekly_limit_minutes}
                        onChange={handleChange}
                        min="1"
                        placeholder="No limit"
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Max Daily Time (hard cap) */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Max Daily (minutes)</label>
                  <input
                    type="number"
                    name="max_daily_minutes"
                    value={formData.max_daily_minutes}
                    onChange={handleChange}
                    min="0"
                    placeholder="No cap"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Hard cap that ignores bonus time. 0 = no cap.
                  </p>
                </div>
              </>
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
