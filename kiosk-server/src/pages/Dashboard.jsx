import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { usePinAuth } from '../hooks/usePinAuth';
import { fetchProfiles } from '../api/profiles';
import PinGate from './dashboard/PinGate';
import Sidebar from './dashboard/Sidebar';

function Dashboard() {
  const { isAuthenticated, loading: authLoading, verifyPin, logout } = usePinAuth();
  const [profiles, setProfiles] = useState([]);
  const [dashboardProfileId, setDashboardProfileId] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchProfiles().then((data) => {
      setProfiles(data);
      if (data.length > 0 && !dashboardProfileId) {
        setDashboardProfileId(data[0].id);
      }
    }).catch(console.error);
  }, [isAuthenticated]);

  // Refresh profiles when navigating (e.g. after creating/deleting)
  const refreshDashboardProfiles = () => {
    fetchProfiles().then((data) => {
      setProfiles(data);
      // If current profile was deleted, select first available
      if (!data.some(p => p.id === dashboardProfileId) && data.length > 0) {
        setDashboardProfileId(data[0].id);
      }
    }).catch(console.error);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <PinGate onVerify={verifyPin} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 flex">
      <Sidebar logout={logout} profiles={profiles} dashboardProfileId={dashboardProfileId} setDashboardProfileId={setDashboardProfileId} />
      <main className="flex-1 p-4 md:p-8 max-w-4xl md:ml-0 ml-0 pt-16 md:pt-8">
        <Outlet context={{ logout, dashboardProfileId, setDashboardProfileId, profiles, refreshDashboardProfiles }} />
      </main>
    </div>
  );
}

export default Dashboard;
