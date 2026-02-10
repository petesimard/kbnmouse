import { useState, useEffect, useRef, useCallback } from 'react';
import { useProfile } from '../../contexts/ProfileContext';

export const meta = { key: 'home', name: 'Home', icon: '🏠', description: 'Community bulletin board', skipTracking: true };

const POST_IT_COLORS = ['#fef08a', '#fca5a5', '#86efac', '#93c5fd', '#c4b5fd', '#fdba74', '#f9a8d4'];
const EMOJI_LIST = ['😀','😂','😍','🥳','😎','🤩','🥰','😜','🤗','👍','👏','💪','🎉','🎊','⭐','🌈','❤️','🔥','💯','🏆','🎮','🎨','🎵','🌟','🍕','🦄','🐶','🐱','🦊','🐸','🐵','🦁','🐼','🐨','🦋','🌻','🌺','🍎','🍩','🧁','⚽','🏀','🎯','🚀'];

function getWsUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

function Home() {
  const { profileId, profiles } = useProfile();
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
      profile_id: profileId || null
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
    const color = POST_IT_COLORS[Math.floor(Math.random() * POST_IT_COLORS.length)];
    const rotation = (Math.random() - 0.5) * 12;
    setPlacing({ type: 'message', content: messageText.trim(), color, rotation });
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
    <div className="h-screen flex flex-col" style={{ background: '#8B6914' }}>
      {/* Header - welcome + time (compact) */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-amber-900/60 text-white">
        <div className="text-sm font-medium">
          {profile ? `Welcome, ${profile.name}!` : 'Welcome!'}{' '}
          <span className="text-white/60 ml-1">Choose an app from the menu below</span>
        </div>
        <div className="text-sm font-medium tabular-nums">
          {timeStr} <span className="text-white/60 ml-1">{dateStr}</span>
        </div>
      </div>

      {/* Bulletin Board */}
      <div
        ref={boardRef}
        className="flex-1 relative overflow-hidden select-none"
        style={{
          background: 'linear-gradient(135deg, #c4956a 0%, #b8845a 30%, #d4a574 50%, #b8845a 70%, #c4956a 100%)',
          cursor: placing ? 'none' : 'default',
          boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.3)'
        }}
        onClick={handleBoardClick}
      >
        {/* Cork board texture overlay */}
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: `radial-gradient(circle at 20% 30%, rgba(139,105,20,0.3) 1px, transparent 1px),
            radial-gradient(circle at 60% 70%, rgba(139,105,20,0.2) 1px, transparent 1px),
            radial-gradient(circle at 80% 20%, rgba(139,105,20,0.25) 1px, transparent 1px)`,
          backgroundSize: '40px 40px, 30px 30px, 50px 50px'
        }} />

        {/* Board frame */}
        <div className="absolute inset-0 pointer-events-none" style={{
          border: '8px solid #5c3a1e',
          boxShadow: 'inset 0 0 15px rgba(0,0,0,0.2), 0 4px 20px rgba(0,0,0,0.4)',
          borderRadius: '2px'
        }} />

        {/* Pinned items */}
        {pins.map(pin => (
          <div
            key={pin.id}
            className="absolute"
            style={{
              left: `${pin.x}%`,
              top: `${pin.y}%`,
              transform: `translate(-50%, -50%) rotate(${pin.rotation || 0}deg)`,
              zIndex: pin.id
            }}
          >
            {pin.pin_type === 'message' ? (
              <PostItNote content={pin.content} color={pin.color} profileName={pin.profile_name} profileIcon={pin.profile_icon} />
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
              opacity: 0.8,
              zIndex: 99999
            }}
          >
            {placing.type === 'message' ? (
              <PostItNote content={placing.content} color={placing.color} />
            ) : (
              <EmojiPin content={placing.content} />
            )}
          </div>
        )}
      </div>

      {/* Bottom buttons */}
      <div className="flex items-center justify-center gap-4 px-4 py-2 bg-amber-900/80">
        <button
          onClick={(e) => { e.stopPropagation(); handleAddMessage(); }}
          className="px-5 py-2 bg-yellow-300 hover:bg-yellow-200 text-amber-900 font-bold rounded-lg shadow-md transition-all hover:scale-105 active:scale-95 text-sm"
        >
          📝 Add Message
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleAddEmoji(); }}
          className="px-5 py-2 bg-pink-300 hover:bg-pink-200 text-pink-900 font-bold rounded-lg shadow-md transition-all hover:scale-105 active:scale-95 text-sm"
        >
          😀 Add Emoji
        </button>
        {placing && (
          <button
            onClick={(e) => { e.stopPropagation(); setPlacing(null); }}
            className="px-5 py-2 bg-red-500 hover:bg-red-400 text-white font-bold rounded-lg shadow-md transition-all hover:scale-105 active:scale-95 text-sm"
          >
            ✕ Cancel
          </button>
        )}
      </div>

      {/* Message modal */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100000]" onClick={() => setShowMessageModal(false)}>
          <div className="bg-yellow-100 rounded-xl p-6 shadow-2xl max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}
            style={{ transform: 'rotate(-1deg)' }}>
            <h3 className="text-lg font-bold text-amber-900 mb-3">📌 Pin a Message</h3>
            <textarea
              autoFocus
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              maxLength={200}
              placeholder="Write your message..."
              className="w-full h-28 p-3 rounded-lg border-2 border-amber-300 bg-yellow-50 text-amber-900 placeholder-amber-400 resize-none focus:outline-none focus:border-amber-500 text-sm"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleMessageSubmit(); }}}
            />
            <div className="flex justify-between items-center mt-3">
              <span className="text-xs text-amber-600">{messageText.length}/200</span>
              <div className="flex gap-2">
                <button onClick={() => setShowMessageModal(false)} className="px-4 py-1.5 rounded-lg text-amber-700 hover:bg-amber-200 text-sm">Cancel</button>
                <button onClick={handleMessageSubmit} disabled={!messageText.trim()}
                  className="px-4 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-40 text-sm font-bold">
                  Pin It!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Emoji picker */}
      {showEmojiPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100000]" onClick={() => setShowEmojiPicker(false)}>
          <div className="bg-white rounded-xl p-5 shadow-2xl max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-3">😀 Pick an Emoji</h3>
            <div className="grid grid-cols-8 gap-1">
              {EMOJI_LIST.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiSelect(emoji)}
                  className="text-3xl p-1.5 rounded-lg hover:bg-slate-100 transition-colors active:scale-90"
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div className="mt-3 text-right">
              <button onClick={() => setShowEmojiPicker(false)} className="px-4 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PostItNote({ content, color = '#fef08a', profileName, profileIcon }) {
  return (
    <div
      className="w-40 shadow-lg"
      style={{
        background: color,
        padding: '12px 14px 10px',
        fontFamily: '"Comic Sans MS", "Chalkboard SE", cursive',
        position: 'relative'
      }}
    >
      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full shadow-md z-10"
        style={{ background: 'radial-gradient(circle at 35% 35%, #ef4444, #991b1b)', border: '1px solid #7f1d1d' }} />
      <p className="text-amber-900 text-xs leading-snug break-words whitespace-pre-wrap">{content}</p>
      {profileName && (
        <div className="mt-2 text-right text-amber-700/70" style={{ fontSize: '10px' }}>
          {profileIcon} {profileName}
        </div>
      )}
    </div>
  );
}

function EmojiPin({ content }) {
  return (
    <div className="relative">
      <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full shadow-md z-10"
        style={{ background: 'radial-gradient(circle at 35% 35%, #3b82f6, #1e40af)', border: '1px solid #1e3a8a' }} />
      <span className="text-5xl drop-shadow-md select-none">{content}</span>
    </div>
  );
}

export default Home;
