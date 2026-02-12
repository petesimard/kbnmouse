import { createProfile } from '../../api/profiles';
import ProfileForm from '../../components/ProfileForm';

export default function SetupProfile({ onProfileCreated }) {
  const handleSubmit = async (formData) => {
    await createProfile(formData);
    onProfileCreated();
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-3">Welcome to kbnmouse!</h1>
          <p className="text-slate-400">
            Add a child profile to get started. Each child gets their own apps, challenges, and usage tracking.
          </p>
        </div>

        <div className="bg-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-6">Add a Child Profile</h2>
          <ProfileForm
            onSubmit={handleSubmit}
            submitLabel="Create Profile"
            savingLabel="Creating..."
          />
        </div>
      </div>
    </div>
  );
}
