import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { fetchProfiles } from '../api/profiles';
import { fetchUnreadCount } from '../api/messages';
import AuthGate from './dashboard/AuthGate';
import Sidebar from './dashboard/Sidebar';

function Dashboard() {
  const auth = useAuth();
  const { isAuthenticated, loading: authLoading, logout } = auth;
  const [profiles, setProfiles] = useState([]);
  const [dashboardProfileId, setDashboardProfileId] = useState(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchProfiles().then((data) => {
      setProfiles(data);
      if (data.length > 0 && !dashboardProfileId) {
        setDashboardProfileId(data[0].id);
      }
    }).catch(console.error);
  }, [isAuthenticated]);

  // Unread message count — WebSocket driven + 30s fallback poll
  useEffect(() => {
    if (!isAuthenticated) return;
    const poll = () => fetchUnreadCount().then((d) => setUnreadMessageCount(d.count)).catch(() => {});
    poll();
    const interval = setInterval(poll, 30000);

    let ws;
    let reconnectTimeout;
    const connect = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'new_message' && data.message) {
              // If a child sent to parent, bump unread
              if (data.message.recipient_type === 'parent') {
                setUnreadMessageCount((prev) => prev + 1);
              }
            }
          } catch {}
        };
        ws.onclose = () => {
          reconnectTimeout = setTimeout(connect, 3000);
        };
        ws.onerror = () => ws.close();
      } catch {}
    };
    connect();

    return () => {
      clearInterval(interval);
      clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
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
    return <AuthGate auth={auth} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 flex">
      <Sidebar logout={logout} profiles={profiles} dashboardProfileId={dashboardProfileId} setDashboardProfileId={setDashboardProfileId} unreadMessageCount={unreadMessageCount} />
      <main className="flex-1 p-4 md:p-8 max-w-4xl md:ml-0 ml-0 pt-16 md:pt-8">
        <Outlet context={{ logout, dashboardProfileId, setDashboardProfileId, profiles, refreshDashboardProfiles, refreshUnreadCount: () => fetchUnreadCount().then((d) => setUnreadMessageCount(d.count)).catch(() => {}) }} />
      </main>
    </div>
  );
}

export default Dashboard;
