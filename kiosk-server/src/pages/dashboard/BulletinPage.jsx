import { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { authHeaders, handleResponse } from '../../api/client.js';
import { useParentName } from '../../hooks/useParentName';
import BulletinBoard from '../../components/BulletinBoard';

// Fetch a photo with auth headers and return a blob URL
async function fetchPhotoBlob(url) {
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) return url;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

function BulletinPage() {
  const { logout } = useOutletContext();
  const parentName = useParentName();
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [posting, setPosting] = useState(false);
  const blobUrlsRef = useRef(new Map());

  // Resolve photo pin content to blob URLs
  const resolvePins = useCallback(async (rawPins) => {
    const blobUrls = blobUrlsRef.current;
    const resolved = await Promise.all(rawPins.map(async (pin) => {
      if (pin.pin_type !== 'photo') return pin;
      if (blobUrls.has(pin.content)) return { ...pin, content: blobUrls.get(pin.content) };
      try {
        const blobUrl = await fetchPhotoBlob(pin.content);
        blobUrls.set(pin.content, blobUrl);
        return { ...pin, content: blobUrl };
      } catch {
        return pin;
      }
    }));
    return resolved;
  }, []);

  // Revoke blob URLs on unmount
  useEffect(() => {
    const blobUrls = blobUrlsRef.current;
    return () => { for (const url of blobUrls.values()) URL.revokeObjectURL(url); };
  }, []);

  const fetchPins = useCallback(async () => {
    try {
      const res = await fetch('/api/bulletin', { headers: authHeaders() });
      const data = await handleResponse(res);
      const raw = Array.isArray(data) ? data : [];
      setPins(await resolvePins(raw));
    } catch (err) {
      if (err.name === 'UnauthorizedError') logout();
      else console.error('Failed to fetch pins:', err);
    } finally {
      setLoading(false);
    }
  }, [logout, resolvePins]);

  useEffect(() => { fetchPins(); }, [fetchPins]);

  // WebSocket for real-time sync
  useEffect(() => {
    let ws;
    let reconnectTimeout;
    let cancelled = false;
    const connect = () => {
      if (cancelled) return;
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'bulletin_pin') {
              if (data.action === 'add') {
                const pin = data.pin;
                if (pin.pin_type === 'photo') {
                  fetchPhotoBlob(pin.content).then(blobUrl => {
                    blobUrlsRef.current.set(pin.content, blobUrl);
                    setPins(prev => prev.some(p => p.id === pin.id) ? prev : [...prev, { ...pin, content: blobUrl }]);
                  });
                } else {
                  setPins(prev => prev.some(p => p.id === pin.id) ? prev : [...prev, pin]);
                }
              } else if (data.action === 'remove') {
                setPins(prev => prev.filter(p => p.id !== data.pin.id));
              }
            }
          } catch {}
        };
        ws.onclose = () => { if (!cancelled) reconnectTimeout = setTimeout(connect, 3000); };
        ws.onerror = () => ws.close();
      } catch {}
    };
    connect();
    return () => { cancelled = true; ws?.close(); clearTimeout(reconnectTimeout); };
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
    <div className="flex flex-col h-full">
      <h2 className="text-2xl font-bold text-white mb-4">Bulletin Board</h2>

      {/* Post a parent note */}
      <div className="bg-slate-800 rounded-xl p-4 mb-4 border border-slate-700 flex-shrink-0">
        <h3 className="text-sm font-semibold text-slate-300 mb-2">Post a Note from {parentName}</h3>
        <p className="text-xs text-slate-500 mb-3">Notes from {parentName} appear with a blue background so kids can tell them apart.</p>
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

      {/* Visual cork board */}
      <div className="flex-1 min-h-[400px] rounded-xl overflow-hidden border border-slate-700">
        <BulletinBoard
          className="w-full h-full"
          pins={pins}
          parentName={parentName}
          onDeletePin={handleDelete}
        />
      </div>
    </div>
  );
}

export default BulletinPage;
