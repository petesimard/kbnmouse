import ProfileForm from '../../components/ProfileForm';

function ProfileFormModal({ profile, onSave, onClose }) {
  const isEditing = !!profile;

  const handleSubmit = async (formData) => {
    await onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-xl w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-6">
            {isEditing ? 'Edit Profile' : 'Add New Profile'}
          </h2>
          <ProfileForm
            profile={profile}
            onSubmit={handleSubmit}
            onCancel={onClose}
            submitLabel={isEditing ? 'Save Changes' : 'Add Profile'}
            savingLabel="Saving..."
          />
        </div>
      </div>
    </div>
  );
}

export default ProfileFormModal;
