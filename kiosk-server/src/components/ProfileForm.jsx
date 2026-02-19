import { useState, useEffect } from 'react';

const EMOJI_OPTIONS = [
  // People
  '👧', '👦', '👶', '🧒', '👦🏻', '👧🏽', '👶🏾', '🧑', '👩', '👨', '👩‍🦱', '👨‍🦱', '👩‍🦰', '👨‍🦰', '👩‍🦳', '👨‍🦳', '👩‍🦲', '👨‍🦲', '👩‍🎓', '👨‍🎓',
  '👸', '🤴', '🤱', '🧑‍🍼', '🧓', '👵', '👴', '🧙', '🦸', '🦹', '🧝', '🧚', '🧜', '🧞', '🧟', '🧑‍🚀', '🧑‍⚕️', '🧑‍🔬', '🧑‍🏫', '🧑‍🎤', '🧑‍💻',
  // Animals
  '🐱', '🐶', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🦄', '🦓', '🦌', '🐔', '🐣', '🦉', '🦜',

  // Fantasy/Other
  '👽', '🤖', '👾', '🎃', '👻', '💀', '☠️',
];

const SCREEN_TIME_PRESETS = [
  { value: 'off', label: 'Off', description: 'No time limits on apps' },
  { value: 'low', label: 'Low', description: 'Shorter time before needing to complete challenges' },
  { value: 'medium', label: 'Medium', description: 'Moderate time before needing to complete challenges' },
  { value: 'high', label: 'High', description: 'Longer time before needing to complete challenges' },
];

export default function ProfileForm({ profile, onSubmit, onCancel, submitLabel = 'Create Profile', savingLabel = 'Saving...' }) {
  const [formData, setFormData] = useState({
    name: '',
    icon: '👧',
    age: '',
    screen_time_preset: 'medium',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        icon: profile.icon || '👧',
        age: profile.age != null ? String(profile.age) : '',
        screen_time_preset: profile.screen_time_preset || 'medium',
      });
    }
  }, [profile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.icon.trim()) newErrors.icon = 'Icon is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const data = { ...formData, age: formData.age ? Number(formData.age) : null, screen_time_preset: formData.screen_time_preset };
      await onSubmit(data);
    } catch (err) {
      setErrors({ submit: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Name
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Child's name"
          className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        {errors.name && (
          <p className="mt-1 text-red-400 text-sm">{errors.name}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Age
        </label>
        <input
          type="number"
          name="age"
          value={formData.age}
          onChange={handleChange}
          placeholder="Child's age"
          min="1"
          max="18"
          className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-slate-500 text-xs">Used to set the difficulty level of challenges</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Screen Time Limiting Defaults
        </label>
        <div className="grid grid-cols-4 gap-2">
          {SCREEN_TIME_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, screen_time_preset: preset.value }))}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                formData.screen_time_preset === preset.value
                  ? 'bg-blue-600 ring-2 ring-blue-400 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-slate-500 text-xs">
          {SCREEN_TIME_PRESETS.find(p => p.value === formData.screen_time_preset)?.description}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Icon
        </label>
        <div className="grid grid-cols-10 gap-2 mb-2">
          {EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, icon: emoji }))}
              className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-colors ${
                formData.icon === emoji
                  ? 'bg-blue-600 ring-2 ring-blue-400'
                  : 'bg-slate-700 hover:bg-slate-600'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
        {errors.icon && (
          <p className="mt-1 text-red-400 text-sm">{errors.icon}</p>
        )}
      </div>

      {errors.submit && (
        <p className="text-red-400 text-sm text-center">{errors.submit}</p>
      )}

      <div className={onCancel ? 'flex gap-3 pt-4' : 'pt-4'}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className={`${onCancel ? 'flex-1' : 'w-full'} px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-medium rounded-lg transition-colors`}
        >
          {saving ? savingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
