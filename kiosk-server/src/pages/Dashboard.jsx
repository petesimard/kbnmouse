import { Outlet } from 'react-router-dom';
import { usePinAuth } from '../hooks/usePinAuth';
import PinGate from './dashboard/PinGate';
import Sidebar from './dashboard/Sidebar';

function Dashboard() {
  const { isAuthenticated, loading: authLoading, verifyPin, logout } = usePinAuth();

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
      <Sidebar logout={logout} />
      <main className="flex-1 p-4 md:p-8 max-w-4xl md:ml-0 ml-0 pt-16 md:pt-8">
        <Outlet context={{ logout }} />
      </main>
    </div>
  );
}

export default Dashboard;
