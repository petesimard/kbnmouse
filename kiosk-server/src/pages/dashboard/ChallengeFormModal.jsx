import { useState, useEffect } from 'react';
import { getChallengeTypes, getChallengeLabel, getConfigFields, getDefaults, buildZodSchema } from '../../components/challenges';
import ConfigField from '../../components/ConfigField';
import IconPicker from '../../components/IconPicker';
import SearchableSelect from '../../components/SearchableSelect';
import Modal from '../../components/Modal';

function ChallengeFormModal({ challenge, onSave, onClose }) {
  const isEditing = !!challenge;
  const challengeTypes = getChallengeTypes();

  const [formData, setFormData] = useState({
    name: '',
    icon: '',
    description: '',
    challenge_type: challengeTypes[0] || 'math_addition',
    reward_minutes: 10,
    max_completions_per_day: 0,
    enabled: 1,
  });
  const [config, setConfig] = useState(() => getDefaults(challengeTypes[0] || 'math_addition'));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (challenge) {
      const type = challenge.challenge_type || 'math_addition';
      setFormData({
        name: challenge.name || '',
        icon: challenge.icon || '',
        description: challenge.description || '',
        challenge_type: type,
        reward_minutes: challenge.reward_minutes ?? 10,
        max_completions_per_day: challenge.max_completions_per_day ?? 0,
        enabled: challenge.enabled ?? 1,
      });
      const savedConfig = typeof challenge.config === 'string'
        ? JSON.parse(challenge.config)
        : challenge.config || {};
      setConfig({ ...getDefaults(type), ...savedConfig });
    }
  }, [challenge]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'challenge_type') {
      setConfig(getDefaults(value));
      setErrors((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (key.startsWith('config.')) delete next[key];
        }
        return next;
      });
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleConfigChange = (key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [`config.${key}`]: '' }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.icon.trim()) {
      newErrors.icon = 'Icon is required';
    }
    if (!formData.challenge_type) {
      newErrors.challenge_type = 'Challenge type is required';
    }
    const reward = parseInt(formData.reward_minutes, 10);
    if (isNaN(reward) || reward < 1 || reward > 120) {
      newErrors.reward_minutes = 'Must be between 1 and 120';
    }

    const schema = buildZodSchema(formData.challenge_type);
    const result = schema.safeParse(config);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = issue.path.join('.');
        newErrors[`config.${key}`] = issue.message;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const schema = buildZodSchema(formData.challenge_type);
    const parsedConfig = schema.parse(config);

    setSaving(true);
    try {
      await onSave({
        ...formData,
        reward_minutes: parseInt(formData.reward_minutes, 10),
        max_completions_per_day: parseInt(formData.max_completions_per_day, 10) || 0,
        config: parsedConfig,
      });
      onClose();
    } catch (err) {
      setErrors({ submit: err.message });
    } finally {
      setSaving(false);
    }
  };

  const configFields = getConfigFields(formData.challenge_type);
  const configEntries = Object.entries(configFields);

  return (
    <Modal onClose={onClose} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-6">
            {isEditing ? 'Edit Challenge' : 'Add New Challenge'}
          </h2>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Challenge Type */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Challenge Type
              </label>
              <SearchableSelect
                options={challengeTypes.map((type) => ({ value: type, label: getChallengeLabel(type) }))}
                value={formData.challenge_type}
                onChange={(value) => handleChange({ target: { name: 'challenge_type', value } })}
                placeholder="Search challenge types..."
              />
              {errors.challenge_type && (
                <p className="mt-1 text-red-400 text-sm">{errors.challenge_type}</p>
              )}
            </div>

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
                placeholder="e.g. Math Challenge"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.name && (
                <p className="mt-1 text-red-400 text-sm">{errors.name}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Description
              </label>
              <input
                type="text"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="e.g. Solve 10 addition problems"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Icon */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Icon
              </label>
              <IconPicker
                value={formData.icon}
                onChange={(icon) => {
                  setFormData((prev) => ({ ...prev, icon }));
                  setErrors((prev) => ({ ...prev, icon: '' }));
                }}
              />
              {errors.icon && (
                <p className="mt-1 text-red-400 text-sm">{errors.icon}</p>
              )}
            </div>

            {/* Reward Minutes */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Reward Minutes
              </label>
              <input
                type="number"
                name="reward_minutes"
                value={formData.reward_minutes}
                onChange={handleChange}
                min="1"
                max="120"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.reward_minutes && (
                <p className="mt-1 text-red-400 text-sm">{errors.reward_minutes}</p>
              )}
            </div>

            {/* Max Completions Per Day */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Max Completions Per Day
              </label>
              <input
                type="number"
                name="max_completions_per_day"
                value={formData.max_completions_per_day}
                onChange={handleChange}
                min="0"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-slate-500">0 = unlimited</p>
            </div>

            {/* Config Fields */}
            {configEntries.length > 0 && (
              <div className="md:col-span-2 bg-slate-700/50 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide">
                  Settings
                </h3>
                {configEntries.map(([key, field]) => (
                  <ConfigField
                    key={key}
                    fieldKey={key}
                    field={field}
                    value={config[key]}
                    error={errors[`config.${key}`]}
                    onChange={handleConfigChange}
                  />
                ))}
              </div>
            )}

            {errors.submit && (
              <p className="md:col-span-2 text-red-400 text-sm text-center">{errors.submit}</p>
            )}

            {/* Actions */}
            <div className="md:col-span-2 flex gap-3 pt-4">
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
                {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Challenge'}
              </button>
            </div>
          </form>
        </div>
    </Modal>
  );
}

export default ChallengeFormModal;
