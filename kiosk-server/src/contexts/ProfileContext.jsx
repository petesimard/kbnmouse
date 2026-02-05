import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchProfiles, fetchActiveProfile, setActiveProfile } from '../api/profiles';

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const [profiles, setProfiles] = useState([]);
  const [profileId, setProfileId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [profileList, active] = await Promise.all([
          fetchProfiles(),
          fetchActiveProfile(),
        ]);
        setProfiles(profileList);

        if (profileList.length === 1) {
          // Auto-select if only one profile
          setProfileId(profileList[0].id);
        } else if (profileList.length > 1 && active.profile_id) {
          // Restore active profile if valid
          const isValid = profileList.some(p => p.id === active.profile_id);
          if (isValid) {
            setProfileId(active.profile_id);
          }
        }
      } catch (err) {
        console.error('Failed to load profiles:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const selectProfile = useCallback((id) => {
    setProfileId(id);
    setActiveProfile(id).catch(err => console.error('Failed to save active profile:', err));
  }, []);

  const clearProfile = useCallback(() => {
    setProfileId(null);
    setActiveProfile(null).catch(err => console.error('Failed to clear active profile:', err));
  }, []);

  const refreshProfiles = useCallback(async () => {
    try {
      const [profileList, active] = await Promise.all([
        fetchProfiles(),
        fetchActiveProfile(),
      ]);
      setProfiles(profileList);

      if (profileList.length === 1) {
        setProfileId(profileList[0].id);
      } else if (active.profile_id) {
        const isValid = profileList.some(p => p.id === active.profile_id);
        setProfileId(isValid ? active.profile_id : null);
      } else {
        setProfileId(null);
      }
    } catch (err) {
      console.error('Failed to refresh profiles:', err);
    }
  }, []);

  return (
    <ProfileContext.Provider value={{ profileId, profiles, loading, selectProfile, clearProfile, refreshProfiles }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within a ProfileProvider');
  return ctx;
}
