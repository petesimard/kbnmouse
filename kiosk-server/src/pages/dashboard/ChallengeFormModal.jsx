import { useState, useEffect } from 'react';
import { getChallengeTypes } from '../../components/challenges';

function ChallengeFormModal({ challenge, onSave, onClose }) {
  const isEditing = !!challenge;
  const challengeTypes = getChallengeTypes();

  const [formData, setFormData] = useState({
    name: '',
    icon: '',
    description: '',
    challenge_type: challengeTypes[0] || 'math',
    reward_minutes: 10,
    enabled: 1,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (challenge) {
      setFormData({
        name: challenge.name || '',
        icon: challenge.icon || '',
        description: challenge.description || '',
        challenge_type: challenge.challenge_type || 'math',
        reward_minutes: challenge.reward_minutes ?? 10,
        enabled: challenge.enabled ?? 1,
      });
    }
  }, [challenge]);

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
    if (!formData.challenge_type) {
      newErrors.challenge_type = 'Challenge type is required';
    }
    const reward = parseInt(formData.reward_minutes, 10);
    if (isNaN(reward) || reward < 1 || reward > 120) {
      newErrors.reward_minutes = 'Must be between 1 and 120';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      await onSave({
        ...formData,
        reward_minutes: parseInt(formData.reward_minutes, 10),
      });
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
            {isEditing ? 'Edit Challenge' : 'Add New Challenge'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Challenge Type */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Challenge Type
              </label>
              <select
                name="challenge_type"
                value={formData.challenge_type}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {challengeTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
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
                {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Challenge'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ChallengeFormModal;
