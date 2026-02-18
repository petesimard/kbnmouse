import ProfileForm from '../../components/ProfileForm';
import Modal from '../../components/Modal';

function ProfileFormModal({ profile, onSave, onClose }) {
  const isEditing = !!profile;

  const handleSubmit = async (formData) => {
    await onSave(formData);
    onClose();
  };

  return (
    <Modal onClose={onClose} className="w-full max-w-md">
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
    </Modal>
  );
}

export default ProfileFormModal;
