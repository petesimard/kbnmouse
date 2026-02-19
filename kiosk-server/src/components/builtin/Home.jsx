import { useState, useEffect, useRef, useCallback } from 'react';
import { useProfile } from '../../contexts/ProfileContext';
import { useParentName } from '../../hooks/useParentName';
import BulletinBoard from '../BulletinBoard';

export const meta = { key: 'home', name: 'Home', icon: '🏠', description: 'Community bulletin board', skipTracking: true };

const POST_IT_COLORS = [
  { bg: '#fef9c3', shadow: '#eab308' },
  { bg: '#fecaca', shadow: '#ef4444' },
  { bg: '#bbf7d0', shadow: '#22c55e' },
  { bg: '#bfdbfe', shadow: '#3b82f6' },
  { bg: '#ddd6fe', shadow: '#8b5cf6' },
  { bg: '#fed7aa', shadow: '#f97316' },
  { bg: '#fbcfe8', shadow: '#ec4899' },
];
const EMOJI_LIST = ['😀','😂','😍','🥳','😎','🤩','🥰','😜','🤗','👍','👏','💪','🎉','🎊','⭐','🌈','❤️','🔥','💯','🏆','🎮','🎨','🎵','🌟','🍕','🦄','🐶','🐱','🦊','🐸','🐵','🦁','🐼','🐨','🦋','🌻','🌺','🍎','🍩','🧁','⚽','🏀','🎯','🚀'];

function getWsUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

function Home() {
  const { profileId, profiles, refreshProfiles } = useProfile();
  const parentName = useParentName();
  const [pins, setPins] = useState([]);
  const [placing, setPlacing] = useState(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [liveFrame, setLiveFrame] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [time, setTime] = useState(new Date());
  const frameCleanupRef = useRef(null);

  const profile = profiles?.find(p => p.id === profileId);

  // Check if camera is enabled (not set to "none")
  const checkCamera = useCallback(async () => {
    if (!window.kioskCamera?.getDevice) {
      setCameraEnabled(false);
      return;
    }
    const device = await window.kioskCamera.getDevice();
    setCameraEnabled(device && device !== 'none');
  }, []);

  useEffect(() => {
    checkCamera();
    const cleanup = window.kioskCamera?.onDeviceChanged?.((device) => {
      setCameraEnabled(device && device !== 'none');
    });
    return () => { if (cleanup) cleanup(); };
  }, [checkCamera]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      window.kioskCamera?.stopStream();
      if (frameCleanupRef.current) frameCleanupRef.current();
    };
  }, []);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch pins
  const fetchPins = useCallback(async () => {
    try {
      const res = await fetch('/api/bulletin');
      const data = await res.json();
      setPins(data);
    } catch (err) {
      console.error('Failed to fetch bulletin pins:', err);
    }
  }, []);

  useEffect(() => { fetchPins(); }, [fetchPins]);

  // WebSocket for real-time sync
  useEffect(() => {
    let ws;
    let reconnectTimeout;
    const connect = () => {
      try {
        ws = new WebSocket(getWsUrl());
        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'refresh') {
              refreshProfiles();
            } else if (data.type === 'bulletin_pin') {
              if (data.action === 'add') {
                setPins(prev => {
                  if (prev.some(p => p.id === data.pin.id)) return prev;
                  return [...prev, data.pin];
                });
              } else if (data.action === 'remove') {
                setPins(prev => prev.filter(p => p.id !== data.pin.id));
              }
            }
          } catch {}
        };
        ws.onclose = () => { reconnectTimeout = setTimeout(connect, 3000); };
        ws.onerror = () => ws.close();
      } catch {}
    };
    connect();
    return () => { ws?.close(); clearTimeout(reconnectTimeout); };
  }, []);

  // Place the pin
  const handlePlaced = async (x, y) => {
    if (!placing) return;
    const pin = {
      pin_type: placing.type,
      content: placing.type === 'photo' ? '' : placing.content,
      x,
      y,
      rotation: placing.rotation,
      color: placing.color,
      profile_id: profileId
    };
    if (placing.type === 'photo') {
      pin.photo_data = placing.content;
    }
    setPlacing(null);
    try {
      await fetch('/api/bulletin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pin)
      });
    } catch (err) {
      console.error('Failed to place pin:', err);
    }
  };

  const handleAddMessage = () => {
    setShowEmojiPicker(false);
    setShowMessageModal(true);
  };

  const handleMessageSubmit = () => {
    if (!messageText.trim()) return;
    const colorObj = POST_IT_COLORS[Math.floor(Math.random() * POST_IT_COLORS.length)];
    const rotation = (Math.random() - 0.5) * 12;
    setPlacing({ type: 'message', content: messageText.trim(), color: colorObj.bg, rotation });
    setMessageText('');
    setShowMessageModal(false);
  };

  const handleAddEmoji = () => {
    setShowMessageModal(false);
    setShowEmojiPicker(true);
  };

  const handleEmojiSelect = (emoji) => {
    const rotation = (Math.random() - 0.5) * 20;
    setPlacing({ type: 'emoji', content: emoji, color: null, rotation });
    setShowEmojiPicker(false);
  };

  const handleOpenCamera = async () => {
    setShowMessageModal(false);
    setShowEmojiPicker(false);
    if (!window.kioskCamera) {
      setCameraError('Camera not available in this browser');
      setTimeout(() => setCameraError(''), 4000);
      return;
    }
    try {
      setCapturedPhoto(null);
      setLiveFrame(null);
      setShowCamera(true);
      await window.kioskCamera.startStream();
      if (frameCleanupRef.current) frameCleanupRef.current();
      frameCleanupRef.current = window.kioskCamera.onFrame((dataUrl) => {
        setLiveFrame(dataUrl);
      });
    } catch (err) {
      console.error('Camera access failed:', err);
      setCameraError(`Camera not available: ${err.message}`);
      setTimeout(() => setCameraError(''), 4000);
      setShowCamera(false);
    }
  };

  const handleCapture = async () => {
    try {
      await window.kioskCamera.stopStream();
      if (frameCleanupRef.current) { frameCleanupRef.current(); frameCleanupRef.current = null; }
      const dataUrl = await window.kioskCamera.capture();
      setCapturedPhoto(dataUrl);
    } catch (err) {
      console.error('Capture failed:', err);
    }
  };

  const handleRetake = async () => {
    setCapturedPhoto(null);
    setLiveFrame(null);
    await window.kioskCamera.startStream();
    if (frameCleanupRef.current) frameCleanupRef.current();
    frameCleanupRef.current = window.kioskCamera.onFrame((dataUrl) => {
      setLiveFrame(dataUrl);
    });
  };

  const handleUsePhoto = () => {
    const rotation = (Math.random() - 0.5) * 8;
    setPlacing({ type: 'photo', content: capturedPhoto, color: null, rotation });
    setShowCamera(false);
    setCapturedPhoto(null);
    setLiveFrame(null);
  };

  const handleCloseCamera = () => {
    window.kioskCamera?.stopStream();
    if (frameCleanupRef.current) { frameCleanupRef.current(); frameCleanupRef.current = null; }
    setShowCamera(false);
    setCapturedPhoto(null);
    setLiveFrame(null);
  };

  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = time.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="h-screen flex flex-col" style={{ background: '#1a1a1e' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-2" style={{
        background: 'linear-gradient(180deg, #2a2a30 0%, #1e1e24 100%)',
        borderBottom: '3px solid #111114',
        boxShadow: '0 2px 8px rgba(0,0,0,0.5)'
      }}>
        <div className="flex items-center gap-3">
          <span className="text-xl">📋</span>
          <div>
            <div className="text-white font-bold text-sm tracking-wide">
              {profile ? `${profile.icon || '👋'} Welcome, ${profile.name}!` : 'Welcome!'}
            </div>
            <div className="text-amber-300/60 text-xs">Choose an app from the menu below</div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-white">
          <div className="text-right">
            <div className="text-sm font-bold tabular-nums">{timeStr}</div>
            <div className="text-amber-300/60 text-xs">{dateStr}</div>
          </div>
        </div>
      </div>

      {/* Bulletin Board */}
      <BulletinBoard
        className="flex-1"
        pins={pins}
        parentName={parentName}
        placing={placing}
        onPlaced={handlePlaced}
        onCancelPlace={() => setPlacing(null)}
      />

      {/* Bottom toolbar */}
      <div className="flex items-center justify-center gap-3 px-4 py-2.5" style={{
        background: 'linear-gradient(180deg, #2a2a30 0%, #1e1e24 100%)',
        borderTop: '3px solid #111114',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.5)'
      }}>
        <button
          onClick={(e) => { e.stopPropagation(); handleAddMessage(); }}
          disabled={!profileId}
          className="group flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          style={{
            background: 'linear-gradient(180deg, #fef08a 0%, #fde047 100%)',
            color: '#78350f',
            boxShadow: profileId ? '0 2px 8px rgba(253,224,71,0.3), inset 0 1px 0 rgba(255,255,255,0.5)' : 'none',
          }}
        >
          <span className="text-base group-hover:scale-110 transition-transform">📝</span>
          Add Note
        </button>
        {cameraEnabled && (
          <button
            onClick={(e) => { e.stopPropagation(); handleOpenCamera(); }}
            disabled={!profileId}
            className="group flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            style={{
              background: 'linear-gradient(180deg, #a5f3fc 0%, #67e8f9 100%)',
              color: '#164e63',
              boxShadow: profileId ? '0 2px 8px rgba(103,232,249,0.3), inset 0 1px 0 rgba(255,255,255,0.5)' : 'none',
            }}
          >
            <span className="text-base group-hover:scale-110 transition-transform">📸</span>
            Take Picture
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); handleAddEmoji(); }}
          disabled={!profileId}
          className="group flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          style={{
            background: 'linear-gradient(180deg, #fbcfe8 0%, #f9a8d4 100%)',
            color: '#831843',
            boxShadow: profileId ? '0 2px 8px rgba(249,168,212,0.3), inset 0 1px 0 rgba(255,255,255,0.5)' : 'none',
          }}
        >
          <span className="text-base group-hover:scale-110 transition-transform">😀</span>
          Add Sticker
        </button>
      </div>

      {/* Message modal */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100000]" onClick={() => setShowMessageModal(false)}>
          <div
            className="max-w-sm w-full mx-4 relative"
            onClick={e => e.stopPropagation()}
            style={{ transform: 'rotate(-1deg)' }}
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-20 h-7 z-10 rounded-sm"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,220,0.7) 0%, rgba(255,255,200,0.5) 100%)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              }}
            />
            <div className="bg-yellow-100 rounded-lg p-6 shadow-2xl" style={{
              boxShadow: '0 10px 40px rgba(0,0,0,0.3), 0 2px 10px rgba(0,0,0,0.1)',
            }}>
              <h3 className="text-lg font-bold text-amber-900 mb-3 flex items-center gap-2">
                <span>📝</span> Write a Note
              </h3>
              <textarea
                autoFocus
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                maxLength={200}
                placeholder="What do you want to say?"
                className="w-full h-28 p-3 rounded-lg border-2 border-amber-200 bg-yellow-50 text-amber-900 placeholder-amber-300 resize-none focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200 text-sm"
                style={{ fontFamily: '"Comic Sans MS", "Chalkboard SE", cursive' }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleMessageSubmit(); }}}
              />
              <div className="flex justify-between items-center mt-3">
                <span className="text-xs text-amber-400 font-medium">{messageText.length}/200</span>
                <div className="flex gap-2">
                  <button onClick={() => setShowMessageModal(false)}
                    className="px-4 py-2 rounded-lg text-amber-600 hover:bg-amber-100 text-sm font-medium transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleMessageSubmit} disabled={!messageText.trim()}
                    className="px-5 py-2 text-white rounded-lg disabled:opacity-30 text-sm font-bold transition-all active:scale-95"
                    style={{
                      background: !messageText.trim() ? '#d4a373' : 'linear-gradient(180deg, #d97706 0%, #b45309 100%)',
                      boxShadow: messageText.trim() ? '0 2px 8px rgba(217,119,6,0.4)' : 'none',
                    }}>
                    Pin It!
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Emoji picker */}
      {showEmojiPicker && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100000]" onClick={() => setShowEmojiPicker(false)}>
          <div className="bg-white rounded-2xl p-5 shadow-2xl max-w-md w-full mx-4" onClick={e => e.stopPropagation()}
            style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.3)' }}>
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <span>✨</span> Pick a Sticker
            </h3>
            <div className="grid grid-cols-8 gap-1.5">
              {EMOJI_LIST.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiSelect(emoji)}
                  className="text-3xl p-2 rounded-xl hover:bg-amber-50 transition-all active:scale-75 hover:scale-110"
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div className="mt-4 text-right">
              <button onClick={() => setShowEmojiPicker(false)}
                className="px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-100 text-sm font-medium transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera error toast */}
      {cameraError && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100001] bg-red-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium">
          {cameraError}
        </div>
      )}

      {/* Camera modal */}
      {showCamera && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100000]" onClick={handleCloseCamera}>
          <div className="max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-2xl" style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}>
              <div className="p-4 flex items-center justify-between border-b border-slate-700">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>📸</span> Take a Picture
                </h3>
                <button onClick={handleCloseCamera} className="text-slate-400 hover:text-white text-xl font-bold transition-colors">✕</button>
              </div>

              <div className="relative aspect-[4/3] bg-black flex items-center justify-center">
                {capturedPhoto ? (
                  <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover" />
                ) : liveFrame ? (
                  <img src={liveFrame} alt="Camera" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-slate-500 text-lg">Starting camera...</div>
                )}
              </div>

              <div className="p-4 flex justify-center gap-3">
                {!capturedPhoto ? (
                  <button
                    onClick={handleCapture}
                    className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center transition-all active:scale-90 hover:scale-105"
                    style={{ background: 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)' }}
                  >
                    <div className="w-12 h-12 rounded-full bg-red-500 border-2 border-red-300" />
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleRetake}
                      className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 transition-colors active:scale-95"
                    >
                      Retake
                    </button>
                    <button
                      onClick={handleUsePhoto}
                      className="px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all active:scale-95"
                      style={{
                        background: 'linear-gradient(180deg, #22d3ee 0%, #06b6d4 100%)',
                        boxShadow: '0 2px 8px rgba(6,182,212,0.4)',
                      }}
                    >
                      Pin It!
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
