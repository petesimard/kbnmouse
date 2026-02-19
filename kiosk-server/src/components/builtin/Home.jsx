import { useState, useEffect, useRef, useCallback } from 'react';
import { useProfile } from '../../contexts/ProfileContext';
import { useParentName } from '../../hooks/useParentName';

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
  const { profileId, profiles } = useProfile();
  const parentName = useParentName();
  const [pins, setPins] = useState([]);
  const [placing, setPlacing] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [time, setTime] = useState(new Date());
  const boardRef = useRef(null);

  const profile = profiles?.find(p => p.id === profileId);

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
            if (data.type === 'bulletin_pin') {
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

  // ESC cancels placement
  useEffect(() => {
    if (!placing) return;
    const handler = (e) => { if (e.key === 'Escape') setPlacing(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [placing]);

  // Always track mouse position so it's ready when placement starts
  useEffect(() => {
    const handler = (e) => {
      if (!boardRef.current) return;
      const rect = boardRef.current.getBoundingClientRect();
      setMousePos({
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100
      });
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  // Place the pin on click
  const handleBoardClick = async () => {
    if (!placing) return;
    const pin = {
      pin_type: placing.type,
      content: placing.content,
      x: mousePos.x,
      y: mousePos.y,
      rotation: placing.rotation,
      color: placing.color,
      profile_id: profileId
    };
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
      <div
        ref={boardRef}
        className="flex-1 relative overflow-hidden select-none"
        style={{
          background: 'linear-gradient(145deg, #c9a06c 0%, #bf9460 20%, #d4a874 40%, #c49a68 60%, #ba8e58 80%, #c9a06c 100%)',
          cursor: placing ? 'crosshair' : 'default',
        }}
        onClick={handleBoardClick}
      >
        {/* Cork texture - fine grain */}
        <div className="absolute inset-0" style={{
          backgroundImage: `
            radial-gradient(ellipse at 15% 25%, rgba(160,120,60,0.4) 0.5px, transparent 1px),
            radial-gradient(ellipse at 45% 65%, rgba(140,100,50,0.3) 0.5px, transparent 1px),
            radial-gradient(ellipse at 75% 35%, rgba(170,130,70,0.35) 0.5px, transparent 1px),
            radial-gradient(ellipse at 30% 80%, rgba(150,110,55,0.3) 0.5px, transparent 1px),
            radial-gradient(ellipse at 85% 75%, rgba(145,105,52,0.35) 0.5px, transparent 1px),
            radial-gradient(ellipse at 55% 15%, rgba(155,115,58,0.3) 0.5px, transparent 1px)`,
          backgroundSize: '18px 18px, 23px 23px, 15px 15px, 20px 20px, 17px 17px, 25px 25px',
        }} />
        {/* Cork texture - larger mottling */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `
            radial-gradient(ellipse 60% 40% at 20% 30%, rgba(100,70,30,0.5) 0%, transparent 60%),
            radial-gradient(ellipse 40% 60% at 70% 60%, rgba(80,55,20,0.4) 0%, transparent 50%),
            radial-gradient(ellipse 50% 50% at 50% 50%, rgba(120,85,35,0.3) 0%, transparent 55%)`,
        }} />
        {/* Inner shadow for depth */}
        <div className="absolute inset-0 pointer-events-none" style={{
          boxShadow: 'inset 0 0 60px rgba(0,0,0,0.25), inset 0 0 120px rgba(0,0,0,0.08)',
        }} />

        {/* Board frame - wooden border */}
        <div className="absolute inset-0 pointer-events-none" style={{
          border: '10px solid transparent',
          borderImage: 'linear-gradient(135deg, #5a3d20 0%, #7a5232 25%, #4a3018 50%, #6b4528 75%, #5a3d20 100%) 1',
          boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.4)',
        }} />
        {/* Frame highlight */}
        <div className="absolute inset-[10px] pointer-events-none" style={{
          boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.2), inset -1px -1px 2px rgba(255,255,255,0.05)',
        }} />

        {/* Placement banner */}
        {placing && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[9999] animate-bounce">
            <div className="bg-white/95 backdrop-blur-sm text-amber-900 px-5 py-2 rounded-full shadow-lg font-bold text-sm flex items-center gap-2">
              <span>📌</span> Click anywhere to place!
              <button
                onClick={(e) => { e.stopPropagation(); setPlacing(null); }}
                className="ml-1 text-red-500 hover:text-red-700 font-bold"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Pinned items */}
        {pins.map(pin => (
          <div
            key={pin.id}
            className="absolute transition-transform duration-200"
            style={{
              left: `${pin.x}%`,
              top: `${pin.y}%`,
              transform: `translate(-50%, -50%) rotate(${pin.rotation || 0}deg)`,
              zIndex: pin.id
            }}
          >
            {pin.pin_type === 'message' ? (
              <PostItNote content={pin.content} color={pin.color} profileName={pin.profile_name} profileIcon={pin.profile_icon} isParent={!!pin.is_parent} parentName={parentName} />
            ) : (
              <EmojiPin content={pin.content} />
            )}
          </div>
        ))}

        {/* Ghost preview while placing */}
        {placing && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${mousePos.x}%`,
              top: `${mousePos.y}%`,
              transform: `translate(-50%, -50%) rotate(${placing.rotation}deg)`,
              opacity: 0.7,
              zIndex: 99999,
              filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))'
            }}
          >
            {placing.type === 'message' ? (
              <PostItNote content={placing.content} color={placing.color} />
            ) : (
              <EmojiPin content={placing.content} />
            )}
          </div>
        )}

        {/* Empty state */}
        {pins.length === 0 && !placing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center opacity-40">
              <div className="text-6xl mb-3">📌</div>
              <div className="text-amber-900 font-bold text-lg">No pins yet!</div>
              <div className="text-amber-900/70 text-sm">Add a message or emoji to get started</div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom toolbar */}
      <div className="flex items-center justify-center gap-3 px-4 py-2.5" style={{
        background: 'linear-gradient(180deg, #2a2a30 0%, #1e1e24 100%)',
        borderTop: '3px solid #111114',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.5)'
      }}>
        <button
          onClick={(e) => { e.stopPropagation(); handleAddMessage(); }}
          className="group flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-150 active:scale-95"
          style={{
            background: 'linear-gradient(180deg, #fef08a 0%, #fde047 100%)',
            color: '#78350f',
            boxShadow: '0 2px 8px rgba(253,224,71,0.3), inset 0 1px 0 rgba(255,255,255,0.5)',
          }}
        >
          <span className="text-base group-hover:scale-110 transition-transform">📝</span>
          Add Note
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleAddEmoji(); }}
          className="group flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-150 active:scale-95"
          style={{
            background: 'linear-gradient(180deg, #fbcfe8 0%, #f9a8d4 100%)',
            color: '#831843',
            boxShadow: '0 2px 8px rgba(249,168,212,0.3), inset 0 1px 0 rgba(255,255,255,0.5)',
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
            {/* Tape strip on top */}
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
    </div>
  );
}

function PostItNote({ content, color = '#fef9c3', profileName, profileIcon, isParent, parentName = 'Mom & Dad' }) {
  return (
    <div
      className="w-44 relative group"
      style={{
        background: isParent
          ? 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)'
          : `linear-gradient(135deg, ${color} 0%, ${color}ee 100%)`,
        padding: '20px 16px 14px',
        fontFamily: '"Comic Sans MS", "Chalkboard SE", cursive',
        boxShadow: isParent
          ? '2px 3px 12px rgba(59,130,246,0.2), 0 1px 3px rgba(0,0,0,0.1)'
          : '2px 3px 12px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.08)',
      }}
    >
      {/* Thumbtack */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10">
        <div className="relative">
          {/* Pin shaft shadow */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-0.5 h-2 bg-gray-400/30 rounded-full" />
          {/* Pin head */}
          <div className="w-5 h-5 rounded-full relative"
            style={{
              background: isParent
                ? 'radial-gradient(circle at 35% 30%, #60a5fa, #2563eb 60%, #1d4ed8)'
                : 'radial-gradient(circle at 35% 30%, #fb7185, #e11d48 60%, #be123c)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3), inset 0 -1px 2px rgba(0,0,0,0.2)',
            }}
          >
            {/* Pin highlight */}
            <div className="absolute top-1 left-1.5 w-1.5 h-1.5 rounded-full bg-white/40" />
          </div>
        </div>
      </div>

      {/* Folded corner effect */}
      {!isParent && (
        <div className="absolute bottom-0 right-0 w-5 h-5"
          style={{
            background: `linear-gradient(135deg, ${color}00 50%, rgba(0,0,0,0.08) 50%)`,
          }}
        />
      )}

      {isParent && (
        <div className="flex items-center gap-1 mb-1.5">
          <span className="text-blue-400 text-xs">💙</span>
          <span className="text-blue-500 font-bold" style={{ fontSize: '10px' }}>From {parentName}</span>
        </div>
      )}
      <p className={`text-xs leading-relaxed break-words whitespace-pre-wrap ${isParent ? 'text-blue-900' : 'text-amber-900/90'}`}>
        {content}
      </p>
      {profileName && !isParent && (
        <div className="mt-2.5 text-right text-amber-700/50 font-medium" style={{ fontSize: '10px' }}>
          {profileIcon} {profileName}
        </div>
      )}
    </div>
  );
}

function EmojiPin({ content }) {
  return (
    <div className="relative flex flex-col items-center">
      {/* Thumbtack */}
      <div className="relative z-10 -mb-1">
        <div className="w-4 h-4 rounded-full"
          style={{
            background: 'radial-gradient(circle at 35% 30%, #34d399, #059669 60%, #047857)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3), inset 0 -1px 2px rgba(0,0,0,0.2)',
          }}
        >
          <div className="absolute top-0.5 left-1 w-1.5 h-1.5 rounded-full bg-white/40" />
        </div>
      </div>
      <span className="text-5xl select-none" style={{
        filter: 'drop-shadow(2px 3px 4px rgba(0,0,0,0.2))',
      }}>{content}</span>
    </div>
  );
}

export default Home;
