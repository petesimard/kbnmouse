import { useState, useEffect } from 'react';

// App shortcuts configuration
const apps = [
  { name: 'Home', url: '/test-content', icon: '🏠' },
  { name: 'Wikipedia', url: 'https://www.wikipedia.org', icon: '📚' },
  { name: 'Khan Academy', url: 'https://www.khanacademy.org', icon: '🎓' },
  { name: 'Scratch', url: 'https://scratch.mit.edu', icon: '🐱' },
];

function Menu() {
  const [hasKiosk, setHasKiosk] = useState(false);

  useEffect(() => {
    // Check if running in Electron with kiosk API
    setHasKiosk(typeof window.kiosk?.content !== 'undefined');
  }, []);

  const handleLoadURL = (url) => {
    if (hasKiosk) {
      window.kiosk.content.loadURL(url);
    } else {
      // Fallback for browser testing
      console.log('Would navigate to:', url);
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
        {apps.map((app) => (
          <button
            key={app.name}
            onClick={() => handleLoadURL(app.url)}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center gap-2 transition-colors"
          >
            <span>{app.icon}</span>
            <span className="text-sm">{app.name}</span>
          </button>
        ))}
      </div>

      {/* Status indicator */}
      <div className="text-slate-500 text-xs">
        {hasKiosk ? '● Connected' : '○ Browser Mode'}
      </div>
    </div>
  );
}

export default Menu;
