import { useState, useEffect, useCallback, useRef } from 'react';
import { useProfile } from '../contexts/ProfileContext';
import { calculateRemainingSeconds } from '../utils/timeLimit';

function formatRemaining(seconds) {
  if (seconds <= 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function Menu() {
  const { profileId, profiles, loading: profilesLoading, clearProfile, refreshProfiles } = useProfile();

  const [hasKiosk, setHasKiosk] = useState(false);
  const [apps, setApps] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nativeRunning, setNativeRunning] = useState(false);
  const [timeLimitError, setTimeLimitError] = useState(false);
  const [timeWarning, setTimeWarning] = useState(false);
  const [usageMap, setUsageMap] = useState({});

  const needsProfileSelection = !profilesLoading && profiles.length > 1 && !profileId;
  const loadedProfileSelectRef = useRef(false);

  // Load /profiles in the content view when profile selection is needed
  useEffect(() => {
    if (!needsProfileSelection) {
      loadedProfileSelectRef.current = false;
      return;
    }
    if (loadedProfileSelectRef.current) return;
    loadedProfileSelectRef.current = true;

    if (window.kiosk?.content?.loadURL) {
      window.kiosk.content.loadURL('/profiles');
    }
  }, [needsProfileSelection]);

  // Reset folder navigation on profile change
  useEffect(() => {
    setCurrentFolderId(null);
  }, [profileId]);

  // Extract domains from URL-type apps and push to Electron whitelist
  const pushWhitelist = useCallback((appList) => {
    if (!window.kiosk?.content?.setWhitelist) return;
    const domains = [...new Set(
      appList
        .filter((app) => app.app_type === 'url' && app.url?.startsWith('http'))
        .map((app) => {
          try {
            return new URL(app.url).hostname.replace(/^www\./, '');
          } catch {
            return null;
          }
        })
        .filter(Boolean)
    )];
    window.kiosk.content.setWhitelist(domains);
  }, []);

  // Fetch usage data for all apps
  const fetchUsage = useCallback((appList) => {
    Promise.all(
      appList.map((app) =>
        fetch(`/api/apps/${app.id}/usage`)
          .then((r) => r.json())
          .then((u) => [app.id, u])
          .catch(() => null)
      )
    ).then((results) => {
      const map = {};
      for (const entry of results) {
        if (!entry) continue;
        const [id, usage] = entry;
        const remaining = calculateRemainingSeconds(usage);
        if (remaining !== null) {
          map[id] = remaining;
        }
      }
      setUsageMap(map);
    });
  }, []);

  // Fetch apps and folders from the database, scoped by profile
  const fetchApps = useCallback(() => {
    if (needsProfileSelection) return;
    const profileQuery = profileId ? `?profile=${profileId}` : '';
    Promise.all([
      fetch(`/api/apps${profileQuery}`).then((res) => res.json()),
      fetch(`/api/folders${profileQuery}`).then((res) => res.json()),
    ])
      .then(([appsData, foldersData]) => {
        setApps(appsData);
        setFolders(foldersData);
        pushWhitelist(appsData);
        fetchUsage(appsData);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load apps:', err);
        setLoading(false);
      });
  }, [pushWhitelist, fetchUsage, profileId, needsProfileSelection]);

  useEffect(() => {
    // Check if running in Electron with kiosk API
    setHasKiosk(typeof window.kiosk?.content !== 'undefined');

    fetchApps();
  }, [fetchApps]);

  // Keep stable refs for WS handler so the connection doesn't tear down on every state change
  const fetchAppsRef = useRef(fetchApps);
  fetchAppsRef.current = fetchApps;
  const refreshProfilesRef = useRef(refreshProfiles);
  refreshProfilesRef.current = refreshProfiles;

  // WebSocket connection for live updates (no deps — uses refs for stable connection)
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:3001/ws`;

    let ws;
    let reconnectTimeout;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('Menu connected to WebSocket');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'refresh') {
            console.log('Received refresh signal, reloading...');
            refreshProfilesRef.current();
            fetchAppsRef.current();
            setCurrentFolderId(null);
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket closed, reconnecting in 3s...');
        reconnectTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        ws.close();
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (ws) {
        ws.close();
      }
    };
  }, []);

  // Refresh just usage data (using current apps list)
  const refreshUsage = useCallback(() => {
    if (apps.length > 0) fetchUsage(apps);
  }, [apps, fetchUsage]);

  // Subscribe to native app exit events
  useEffect(() => {
    if (!window.kiosk?.native?.onExited) return;
    const cleanup = window.kiosk.native.onExited(() => {
      setNativeRunning(false);
      setTimeWarning(false);
      refreshUsage();
    });
    return cleanup;
  }, [refreshUsage]);

  // Subscribe to time warning events
  useEffect(() => {
    if (!window.kiosk?.native?.onTimeWarning) return;
    return window.kiosk.native.onTimeWarning(() => {
      setTimeWarning(true);
    });
  }, []);

  // Subscribe to time limit reached events
  useEffect(() => {
    if (!window.kiosk?.native?.onTimeLimitReached) return;
    return window.kiosk.native.onTimeLimitReached(() => {
      setTimeWarning(false);
      setTimeLimitError(true);
      setTimeout(() => setTimeLimitError(false), 5000);
    });
  }, []);

  const handleLoadURL = async (app) => {
    // Native apps launch a process instead of loading a URL
    if (app.app_type === 'native') {
      if (hasKiosk && window.kiosk?.native?.launch) {
        const result = await window.kiosk.native.launch(app.url, app.id);
        if (result.success) {
          setNativeRunning(true);
          setTimeLimitError(false);
          refreshUsage();
        } else if (result.error === 'Time limit reached') {
          setTimeLimitError(true);
          setTimeout(() => setTimeLimitError(false), 5000);
        }
      } else {
        console.log(`Native app "${app.name}" requires the kiosk desktop to launch`);
      }
      return;
    }

    // Determine the URL based on app type
    let url = app.url;
    if (app.app_type === 'builtin') {
      url = `/builtin/${app.url}`;
    }

    if (hasKiosk) {
      window.kiosk.content.loadURL(url);
    } else {
      // Fallback for browser testing - navigate in current window
      window.location.href = url;
    }
  };

  const handleBack = () => {
    if (hasKiosk) {
      window.kiosk.content.goBack();
    }
  };

  const handleForward = () => {
    if (hasKiosk) {
      window.kiosk.content.goForward();
    }
  };

  const handleHome = () => {
    if (hasKiosk) {
      window.kiosk.content.loadURL('/builtin/home');
    } else {
      window.location.href = '/builtin/home';
    }
  };

  const handleReload = () => {
    if (hasKiosk) {
      window.kiosk.content.reload();
    }
  };

  const handleSwitchUser = () => {
    clearProfile();
    if (window.kiosk?.content?.loadURL) {
      window.kiosk.content.loadURL('/profiles');
    }
  };

  // Find current profile for the switch button
  const currentProfile = profiles.find(p => p.id === profileId);

  // Derived data for folder navigation
  const rootApps = apps.filter(a => !a.folder_id);
  const folderApps = currentFolderId ? apps.filter(a => a.folder_id === currentFolderId) : [];
  const currentFolder = folders.find(f => f.id === currentFolderId);

  const renderAppButton = (app) => (
    <button
      key={app.id}
      onClick={() => handleLoadURL(app)}
      className={`px-4 py-2 rounded-xl text-white flex flex-col items-center gap-0.5 transition-all duration-200 hover:scale-105 ${
        app.app_type === 'native' && !hasKiosk
          ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
          : 'bg-slate-700 hover:bg-slate-600'
      }`}
      title={app.app_type === 'native' && !hasKiosk ? 'Native apps require the kiosk desktop' : app.name}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{app.icon}</span>
        <span className="text-sm">{app.name}</span>
      </div>
      {usageMap[app.id] != null && (
        <span className={`text-[10px] ${usageMap[app.id] <= 0 ? 'text-red-400' : usageMap[app.id] <= 300 ? 'text-yellow-400' : 'text-slate-400'}`}>
          {usageMap[app.id] <= 0 ? 'No time left' : formatRemaining(usageMap[app.id])}
        </span>
      )}
    </button>
  );

  return (
    <div className="h-screen bg-slate-800 flex items-center justify-between px-4">
      {/* Navigation controls */}
      <div className="flex gap-2">
        {profiles.length > 1 && (
          <button
            onClick={handleSwitchUser}
            className="w-10 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition-colors"
            title={currentProfile ? `Switch user (${currentProfile.name})` : 'Select profile'}
          >
            {currentProfile?.icon || '👤'}
          </button>
        )}
        <button
          onClick={handleBack}
          className="w-10 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition-colors"
          title="Back"
        >
          ←
        </button>
        <button
          onClick={handleForward}
          className="w-10 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition-colors"
          title="Forward"
        >
          →
        </button>
        <button
          onClick={handleHome}
          className="w-10 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition-colors"
          title="Home"
        >
          🏠
        </button>
        <button
          onClick={handleReload}
          className="w-10 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition-colors"
          title="Reload"
        >
          ↻
        </button>
      </div>

      {/* App shortcuts */}
      <div className="flex gap-3">
        {needsProfileSelection ? (
          <span className="text-slate-400 text-sm">Select a profile to get started</span>
        ) : loading ? (
          <span className="text-slate-400 text-sm">Loading...</span>
        ) : currentFolderId ? (
          /* Folder view */
          <>
            <button
              onClick={() => setCurrentFolderId(null)}
              className="px-4 py-2 rounded-xl text-white flex items-center gap-2 bg-slate-600 hover:bg-slate-500 transition-all duration-200 hover:scale-105"
              title="Back to all apps"
            >
              <span className="text-lg">←</span>
              <span className="text-sm">Back</span>
            </button>
            {currentFolder && (
              <span className="flex items-center gap-1 text-slate-400 text-sm px-2">
                <span className="text-lg">{currentFolder.icon}</span>
                {currentFolder.name}
              </span>
            )}
            {folderApps.length > 0 ? (
              folderApps.map(renderAppButton)
            ) : (
              <span className="text-slate-500 text-sm">This folder is empty</span>
            )}
          </>
        ) : (
          /* Root view */
          <>
            {folders.map((folder) => (
              <button
                key={`folder-${folder.id}`}
                onClick={() => setCurrentFolderId(folder.id)}
                className="px-4 py-2 rounded-xl text-white flex items-center gap-2 shadow-lg transition-all duration-200 hover:scale-105"
                style={{ backgroundColor: folder.color }}
                title={folder.name}
              >
                <span className="text-lg">{folder.icon}</span>
                <span className="text-sm">{folder.name}</span>
              </button>
            ))}
            {rootApps.map(renderAppButton)}
          </>
        )}
      </div>

      {/* Status indicator */}
      <div className="text-slate-500 text-xs">
        {timeLimitError ? (
          <span className="text-red-400">● Time limit reached</span>
        ) : timeWarning ? (
          <span className="text-yellow-400 animate-pulse">● ~1 minute remaining</span>
        ) : nativeRunning ? (
          <span className="text-green-400">● Native app running...</span>
        ) : hasKiosk ? '● Connected' : '○ Browser Mode'}
      </div>
    </div>
  );
}

export default Menu;
