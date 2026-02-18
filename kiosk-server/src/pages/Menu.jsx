import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useProfile } from '../contexts/ProfileContext';
import { useParentName } from '../hooks/useParentName';
import { calculateRemainingSeconds } from '../utils/timeLimit';
import { getBuiltinApps } from '../components/builtin';
import { fetchKidUnreadCount } from '../api/messages';
import AppIcon from '../components/AppIcon';

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
  const parentName = useParentName();

  const [hasKiosk, setHasKiosk] = useState(false);
  const [apps, setApps] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nativeRunning, setNativeRunning] = useState(false);
  const [timeLimitError, setTimeLimitError] = useState(false);
  const [timeWarning, setTimeWarning] = useState(false);
  const [usageMap, setUsageMap] = useState({});

  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  // Kiosk settings
  const [showSettings, setShowSettings] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(() => {
    const saved = localStorage.getItem('kioskZoom');
    return saved ? Number(saved) : 100;
  });

  // Paging state for app shortcuts overflow
  const scrollContainerRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Build set of builtin keys that opt out of usage tracking
  const skipTrackingKeys = useMemo(() => new Set(
    getBuiltinApps().filter((b) => b.skipTracking).map((b) => b.key)
  ), []);

  // Update scroll overflow indicators
  const updateScrollIndicators = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  // Observe container resize for overflow detection
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateScrollIndicators);
    observer.observe(el);
    // Also observe children changes
    for (const child of el.children) observer.observe(child);
    el.addEventListener('scroll', updateScrollIndicators, { passive: true });
    updateScrollIndicators();
    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', updateScrollIndicators);
    };
  }, [updateScrollIndicators, apps, folders, currentFolderId, loading, profileId]);

  const scrollPage = useCallback((direction) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
  }, []);

  const needsProfileSelection = !profilesLoading && profiles.length > 1 && !profileId;
  const loadedProfileSelectRef = useRef(false);

  // Session tracking for URL/builtin apps
  // Shape: { appId, startedAt, enforcementTimer, warningTimer, paused }
  const sessionRef = useRef(null);
  const activeBuiltinRef = useRef(null);

  // Load /profiles in the content view when profile selection is needed
  useEffect(() => {
    if (!needsProfileSelection) {
      loadedProfileSelectRef.current = false;
      return;
    }
    if (loadedProfileSelectRef.current) return;
    loadedProfileSelectRef.current = true;

    if (window.kiosk?.content?.loadURL) {
      window.kiosk.content.loadURL('/kiosk/profiles');
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
    if (needsProfileSelection || !profileId) return;
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

    // Apply saved zoom level on startup
    if (window.kiosk?.zoom?.set) {
      window.kiosk.zoom.set(zoomLevel / 100);
    }

    fetchApps();
  }, [fetchApps]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyZoom = useCallback((level) => {
    setZoomLevel(level);
    localStorage.setItem('kioskZoom', String(level));
    if (window.kiosk?.zoom?.set) {
      window.kiosk.zoom.set(level / 100);
    }
  }, []);

  // Keep stable refs for WS handler so the connection doesn't tear down on every state change
  const fetchAppsRef = useRef(fetchApps);
  fetchAppsRef.current = fetchApps;
  const refreshProfilesRef = useRef(refreshProfiles);
  refreshProfilesRef.current = refreshProfiles;
  const profileIdRef = useRef(profileId);
  profileIdRef.current = profileId;
  const parentNameRef = useRef(parentName);
  parentNameRef.current = parentName;

  // WebSocket connection for live updates (no deps — uses refs for stable connection)
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    let ws;
    let reconnectTimeout;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('Menu connected to WebSocket');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'refresh') {
            console.log('Received refresh signal, reloading...');
            setCurrentFolderId(null);
            refreshProfilesRef.current().then(() => {
              fetchAppsRef.current();
            });
          } else if (data.type === 'new_message' && data.message) {
            const msg = data.message;
            const pid = profileIdRef.current;
            // If this message is addressed to our profile, bump unread + notify
            // Skip if Messages builtin is currently open (it handles its own read state)
            if (msg.recipient_type === 'profile' && msg.recipient_profile_id === pid && activeBuiltinRef.current !== 'messages') {
              setUnreadMessageCount((prev) => prev + 1);
              if ('Notification' in window && Notification.permission === 'granted') {
                const senderName = msg.sender_type === 'parent'
                  ? parentNameRef.current
                  : msg.sender_profile_name || 'Someone';
                new Notification(`Message from ${senderName}`, {
                  body: msg.content.length > 100 ? msg.content.slice(0, 100) + '...' : msg.content,
                  icon: '/favicon.ico',
                  tag: `msg-${msg.id}`,
                });
              }
            }
          } else if (data.type === 'message_read') {
            const pid = profileIdRef.current;
            if (data.recipient_profile_id === pid) {
              setUnreadMessageCount((prev) => Math.max(0, prev - 1));
            }
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        if (!disposed) reconnectTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onclose = null;
        ws.onmessage = null;
        ws.onerror = null;
        if (ws.readyState === WebSocket.OPEN) ws.close();
      }
    };
  }, []);

  // Unread message count — initial fetch + 30s fallback poll (primary updates from WS new_message)
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!profileId) return;
    const poll = () => fetchKidUnreadCount(profileId).then((d) => setUnreadMessageCount(d.count)).catch(() => {});
    poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [profileId]);

  // Refresh just usage data (using current apps list)
  const refreshUsage = useCallback(() => {
    if (apps.length > 0) fetchUsage(apps);
  }, [apps, fetchUsage]);

  // Post usage for a session segment
  const postUsage = useCallback((appId, startedAt, endedAt) => {
    const durationSeconds = Math.round((endedAt - startedAt) / 1000);
    if (durationSeconds < 1) return;
    fetch(`/api/apps/${appId}/usage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSeconds,
      }),
    }).catch((err) => console.error('Failed to post usage:', err));
  }, []);

  // Flush (end) the current URL/builtin session
  const flushSession = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    clearTimeout(session.enforcementTimer);
    clearTimeout(session.warningTimer);
    if (!session.paused) {
      postUsage(session.appId, session.startedAt, new Date());
    }
    sessionRef.current = null;
  }, [postUsage]);

  // Start a new tracking session for a URL/builtin app
  const startSession = useCallback((app, remainingSeconds) => {
    const session = { appId: app.id, startedAt: new Date(), enforcementTimer: null, warningTimer: null };

    if (remainingSeconds != null) {
      // Warning at 60s before limit
      if (remainingSeconds > 60) {
        session.warningTimer = setTimeout(() => {
          setTimeWarning(true);
        }, (remainingSeconds - 60) * 1000);
      }
      // Enforcement: navigate home when time expires
      session.enforcementTimer = setTimeout(() => {
        setTimeWarning(false);
        setTimeLimitError(true);
        setTimeout(() => setTimeLimitError(false), 5000);
        if (window.kiosk?.content?.loadURL) {
          window.kiosk.content.loadURL('/kiosk/builtin/home');
        }
        // Flush the session that just expired
        const s = sessionRef.current;
        if (s) {
          clearTimeout(s.warningTimer);
          if (!s.paused) {
            postUsage(s.appId, s.startedAt, new Date());
          }
          sessionRef.current = null;
        }
        refreshUsage();
      }, remainingSeconds * 1000);
    }

    sessionRef.current = session;
  }, [postUsage, refreshUsage]);

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

  // Pause/resume tracking when content view navigates between /game/ and /customgames/
  useEffect(() => {
    if (!window.kiosk?.content?.onNavigated) return;
    return window.kiosk.content.onNavigated((url) => {
      const session = sessionRef.current;
      if (!session) return;
      try {
        const path = new URL(url).pathname;
        const isGameManage = path.startsWith('/game/');
        const isGamePlay = path.startsWith('/customgames/');
        if (isGameManage && !session.paused) {
          // Navigated to management page — flush accumulated time and pause
          postUsage(session.appId, session.startedAt, new Date());
          session.paused = true;
        } else if (isGamePlay && session.paused) {
          // Navigated back to actual game — resume tracking
          session.startedAt = new Date();
          session.paused = false;
        }
      } catch {}
    });
  }, [postUsage]);

  // Client-side countdown: update displayed remaining time every second for active session
  useEffect(() => {
    const interval = setInterval(() => {
      const session = sessionRef.current;
      if (!session || session.paused) return;
      setUsageMap((prev) => {
        if (prev[session.appId] == null) return prev;
        return { ...prev, [session.appId]: Math.max(0, prev[session.appId] - 1) };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Heartbeat: post accumulated usage every 60s and sync with server
  useEffect(() => {
    const interval = setInterval(() => {
      const session = sessionRef.current;
      if (!session || session.paused) return;
      const now = new Date();
      postUsage(session.appId, session.startedAt, now);
      session.startedAt = now;
      refreshUsage();
    }, 60000);
    return () => clearInterval(interval);
  }, [postUsage, refreshUsage]);

  // Flush session on page unload (profile switch, Electron reload, etc.)
  useEffect(() => {
    const handleBeforeUnload = () => {
      const session = sessionRef.current;
      if (!session || session.paused) return;
      const now = new Date();
      const durationSeconds = Math.round((now - session.startedAt) / 1000);
      if (durationSeconds < 1) return;
      const blob = new Blob([JSON.stringify({
        started_at: session.startedAt.toISOString(),
        ended_at: now.toISOString(),
        duration_seconds: durationSeconds,
      })], { type: 'application/json' });
      navigator.sendBeacon(`/api/apps/${session.appId}/usage`, blob);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const handleLoadURL = async (app) => {
    // End any active URL/builtin session first
    flushSession();
    setTimeWarning(false);

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

    // Don't track builtins that opt out (e.g. home, challenges)
    const skipTracking = app.app_type === 'builtin' && skipTrackingKeys.has(app.url);

    // Check if time limit already exhausted
    if (!skipTracking && usageMap[app.id] != null && usageMap[app.id] <= 0) {
      setTimeLimitError(true);
      setTimeout(() => setTimeLimitError(false), 5000);
      return;
    }

    // Determine the URL based on app type
    let url = app.url;
    if (app.app_type === 'builtin') {
      url = `/kiosk/builtin/${app.url}`;
      activeBuiltinRef.current = app.url;
    } else {
      activeBuiltinRef.current = null;
    }

    if (hasKiosk) {
      window.kiosk.content.loadURL(url);
    } else {
      window.location.href = url;
    }

    // Start tracking session (skip for home screen)
    if (!skipTracking) {
      startSession(app, usageMap[app.id] ?? null);
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
    flushSession();
    setTimeWarning(false);
    if (hasKiosk) {
      window.kiosk.content.loadURL('/kiosk/builtin/home');
    } else {
      window.location.href = '/kiosk/builtin/home';
    }
  };

  const handleReload = () => {
    if (hasKiosk) {
      window.kiosk.content.reload();
    }
  };

  const handleSwitchUser = () => {
    flushSession();
    setTimeWarning(false);
    clearProfile();
    if (window.kiosk?.content?.loadURL) {
      window.kiosk.content.loadURL('/kiosk/profiles');
    }
  };

  // Find current profile for the switch button
  const currentProfile = profiles.find(p => p.id === profileId);

  // Derived data for folder navigation
  const rootApps = apps.filter(a => !a.folder_id);
  const folderApps = currentFolderId ? apps.filter(a => a.folder_id === currentFolderId) : [];
  const currentFolder = folders.find(f => f.id === currentFolderId);

  const renderAppButton = (app) => {
    const isMessages = app.app_type === 'builtin' && app.url === 'messages';
    return (
      <button
        key={app.id}
        onClick={() => handleLoadURL(app)}
        className={`relative px-4 py-2 rounded-xl text-white flex items-center gap-2 transition-all duration-200 hover:scale-105 flex-shrink-0 ${
          app.app_type === 'native' && !hasKiosk
            ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
            : 'bg-slate-700 hover:bg-slate-600'
        }`}
        title={app.app_type === 'native' && !hasKiosk ? 'Native apps require the kiosk desktop' : app.name}
      >
        {isMessages && unreadMessageCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {unreadMessageCount}
          </span>
        )}
        <AppIcon icon={app.icon} className="text-lg w-5 h-5 object-contain" />
        <span className="text-sm">{app.name}</span>
        {usageMap[app.id] != null && (
          <span className={`text-[10px] ${usageMap[app.id] <= 0 ? 'text-red-400' : usageMap[app.id] <= 300 ? 'text-yellow-400' : 'text-slate-400'}`}>
            {usageMap[app.id] <= 0 ? 'No time left' : formatRemaining(usageMap[app.id])}
          </span>
        )}
      </button>
    );
  };

  if (showSettings) {
    return (
      <div className="h-screen bg-slate-800 flex items-center px-4 gap-4">
        <button
          onClick={() => setShowSettings(false)}
          className="w-10 h-10 rounded-lg bg-slate-600 hover:bg-slate-500 text-white flex items-center justify-center transition-colors flex-shrink-0"
          title="Close settings"
        >
          ✕
        </button>
        <span className="text-slate-400 text-sm flex-shrink-0">Zoom</span>
        <input
          type="range"
          min="25"
          max="300"
          step="5"
          value={zoomLevel}
          onChange={(e) => setZoomLevel(Number(e.target.value))}
          onPointerUp={(e) => applyZoom(Number(e.target.value))}
          className="flex-1 max-w-xs accent-sky-500 h-2"
        />
        <span className="text-white text-sm font-mono w-12 text-right flex-shrink-0">{zoomLevel}%</span>
        <button
          onClick={() => applyZoom(100)}
          className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition-colors flex-shrink-0"
        >
          Reset
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-800 flex items-center px-4 gap-4">
      {/* Navigation controls */}
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={() => setShowSettings(true)}
          className="w-10 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition-colors"
          title="Kiosk settings"
        >
          ⚙
        </button>
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

      {/* App shortcuts with overflow paging */}
      <div className="flex-1 min-w-0 flex items-center relative">
        {canScrollLeft && (
          <button
            onClick={() => scrollPage(-1)}
            className="flex-shrink-0 w-7 h-7 mr-1 rounded-full bg-slate-600/80 hover:bg-slate-500 text-white flex items-center justify-center transition-colors text-sm"
            title="Previous"
          >
            ‹
          </button>
        )}
        <div
          ref={scrollContainerRef}
          className="flex gap-3 items-center overflow-x-auto flex-1 min-w-0 py-1 hide-scrollbar"
          style={{ scrollbarWidth: 'none' }}
        >
          {needsProfileSelection ? (
            <span className="text-slate-400 text-sm whitespace-nowrap">Select a profile to get started</span>
          ) : loading ? (
            <span className="text-slate-400 text-sm whitespace-nowrap">Loading...</span>
          ) : currentFolderId ? (
            /* Folder view */
            <>
              <button
                onClick={() => setCurrentFolderId(null)}
                className="px-4 py-2 rounded-xl text-white flex items-center gap-2 bg-slate-600 hover:bg-slate-500 transition-all duration-200 hover:scale-105 flex-shrink-0"
                title="Back to all apps"
              >
                <span className="text-lg">←</span>
                <span className="text-sm">Back</span>
              </button>
              {currentFolder && (
                <span className="flex items-center gap-1 text-slate-400 text-sm px-2 flex-shrink-0">
                  <AppIcon icon={currentFolder.icon} className="text-lg w-5 h-5 object-contain" />
                  {currentFolder.name}
                </span>
              )}
              {folderApps.length > 0 ? (
                folderApps.map(renderAppButton)
              ) : (
                <span className="text-slate-500 text-sm whitespace-nowrap">This folder is empty</span>
              )}
            </>
          ) : (
            /* Root view */
            <>
              {folders.map((folder) => (
                <button
                  key={`folder-${folder.id}`}
                  onClick={() => setCurrentFolderId(folder.id)}
                  className="px-4 py-2 rounded-xl text-white flex items-center gap-2 shadow-lg transition-all duration-200 hover:scale-105 flex-shrink-0"
                  style={{ backgroundColor: folder.color }}
                  title={folder.name}
                >
                  <AppIcon icon={folder.icon} className="text-lg w-5 h-5 object-contain" />
                  <span className="text-sm">{folder.name}</span>
                </button>
              ))}
              {rootApps.map(renderAppButton)}
            </>
          )}
        </div>
        {canScrollRight && (
          <button
            onClick={() => scrollPage(1)}
            className="flex-shrink-0 w-7 h-7 ml-1 rounded-full bg-slate-600/80 hover:bg-slate-500 text-white flex items-center justify-center transition-colors text-sm"
            title="Next"
          >
            ›
          </button>
        )}
      </div>

      {/* Status indicator — only shown for actionable states */}
      {(timeLimitError || timeWarning || nativeRunning) && (
        <div className="text-slate-500 text-xs flex-shrink-0 whitespace-nowrap">
          {timeLimitError ? (
            <span className="text-red-400">● Time limit reached</span>
          ) : timeWarning ? (
            <span className="text-yellow-400 animate-pulse">● ~1 minute remaining</span>
          ) : (
            <span className="text-green-400">● Native app running...</span>
          )}
        </div>
      )}
    </div>
  );
}

export default Menu;
