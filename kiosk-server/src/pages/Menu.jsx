import { useState, useEffect, useCallback } from 'react';

function Menu() {
  const [hasKiosk, setHasKiosk] = useState(false);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nativeRunning, setNativeRunning] = useState(false);
  const [timeLimitError, setTimeLimitError] = useState(false);
  const [timeWarning, setTimeWarning] = useState(false);

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

  // Fetch apps from the database
  const fetchApps = useCallback(() => {
    fetch('/api/apps')
      .then((res) => res.json())
      .then((data) => {
        setApps(data);
        pushWhitelist(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load apps:', err);
        setLoading(false);
      });
  }, [pushWhitelist]);

  useEffect(() => {
    // Check if running in Electron with kiosk API
    setHasKiosk(typeof window.kiosk?.content !== 'undefined');

    // Initial fetch
    fetchApps();
  }, [fetchApps]);

  // WebSocket connection for live updates
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
            console.log('Received refresh signal, reloading apps...');
            fetchApps();
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
  }, [fetchApps]);

  // Subscribe to native app exit events
  useEffect(() => {
    if (!window.kiosk?.native?.onExited) return;
    const cleanup = window.kiosk.native.onExited(() => {
      setNativeRunning(false);
      setTimeWarning(false);
    });
    return cleanup;
  }, []);

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

  const handleReload = () => {
    if (hasKiosk) {
      window.kiosk.content.reload();
    }
  };

  return (
    <div className="h-screen bg-slate-800 flex items-center justify-between px-4">
      {/* Navigation controls */}
      <div className="flex gap-2">
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
          onClick={handleReload}
          className="w-10 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center justify-center transition-colors"
          title="Reload"
        >
          ↻
        </button>
      </div>

      {/* App shortcuts */}
      <div className="flex gap-3">
        {loading ? (
          <span className="text-slate-400 text-sm">Loading...</span>
        ) : (
          apps.map((app) => (
            <button
              key={app.id}
              onClick={() => handleLoadURL(app)}
              className={`px-4 py-2 rounded-lg text-white flex items-center gap-2 transition-colors ${
                app.app_type === 'native' && !hasKiosk
                  ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                  : 'bg-slate-700 hover:bg-slate-600'
              }`}
              title={app.app_type === 'native' && !hasKiosk ? 'Native apps require the kiosk desktop' : app.name}
            >
              <span>{app.icon}</span>
              <span className="text-sm">{app.name}</span>
            </button>
          ))
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
