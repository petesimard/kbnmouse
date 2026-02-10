import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { authHeaders, handleResponse } from '../../api/client.js';

function BulletinPage() {
  const { logout } = useOutletContext();
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [posting, setPosting] = useState(false);

  const fetchPins = useCallback(async () => {
    try {
      const res = await fetch('/api/bulletin');
      const data = await res.json();
      setPins(data);
    } catch (err) {
      console.error('Failed to fetch pins:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPins(); }, [fetchPins]);

  // WebSocket for real-time sync
  useEffect(() => {
    let ws;
    let reconnectTimeout;
    const connect = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'bulletin_pin') {
              if (data.action === 'add') {
                setPins(prev => prev.some(p => p.id === data.pin.id) ? prev : [...prev, data.pin]);
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

  const handlePost = async () => {
    if (!messageText.trim()) return;
    setPosting(true);
    try {
      const res = await fetch('/api/admin/bulletin', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ content: messageText.trim() })
      });
      await handleResponse(res);
      setMessageText('');
    } catch (err) {
      if (err.name === 'UnauthorizedError') logout();
      else console.error('Failed to post pin:', err);
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/admin/bulletin/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      await handleResponse(res);
    } catch (err) {
      if (err.name === 'UnauthorizedError') logout();
      else console.error('Failed to delete pin:', err);
    }
  };

  if (loading) {
    return <div className="text-slate-400">Loading bulletin board...</div>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Bulletin Board</h2>

      {/* Post a parent note */}
      <div className="bg-slate-800 rounded-xl p-4 mb-6 border border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300 mb-2">Post a Parent Note</h3>
        <p className="text-xs text-slate-500 mb-3">Parent notes appear with a blue background so kids can tell them apart.</p>
        <textarea
          value={messageText}
          onChange={e => setMessageText(e.target.value)}
          maxLength={200}
          placeholder="Write a note for the bulletin board..."
          className="w-full h-20 p-3 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePost(); }}}
        />
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-slate-500">{messageText.length}/200</span>
          <button
            onClick={handlePost}
            disabled={!messageText.trim() || posting}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-40 text-sm font-medium transition-colors"
          >
            {posting ? 'Posting...' : 'Post Note'}
          </button>
        </div>
      </div>

      {/* Pins list */}
      <div className="bg-slate-800 rounded-xl border border-slate-700">
        <div className="px-4 py-3 border-b border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300">All Pins ({pins.length})</h3>
        </div>
        {pins.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-sm">No pins on the board yet.</div>
        ) : (
          <div className="divide-y divide-slate-700">
            {[...pins].reverse().map(pin => (
              <div key={pin.id} className="flex items-center gap-3 px-4 py-3">
                {/* Type badge */}
                <div className="flex-shrink-0">
                  {pin.pin_type === 'emoji' ? (
                    <span className="text-2xl">{pin.content}</span>
                  ) : (
                    <div
                      className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold"
                      style={{
                        background: pin.is_parent ? '#e0f2fe' : (pin.color || '#fef08a'),
                        color: pin.is_parent ? '#0369a1' : '#92400e'
                      }}
                    >
                      {pin.is_parent ? 'P' : '📝'}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {pin.pin_type === 'message' && (
                    <p className="text-sm text-white truncate">{pin.content}</p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {pin.is_parent ? (
                      <span className="text-sky-400 font-medium">Parent</span>
                    ) : pin.profile_name ? (
                      <span>{pin.profile_icon} {pin.profile_name}</span>
                    ) : (
                      <span>Anonymous</span>
                    )}
                    <span>&middot;</span>
                    <span>{new Date(pin.created_at).toLocaleString()}</span>
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(pin.id)}
                  className="flex-shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors"
                  title="Delete pin"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default BulletinPage;
