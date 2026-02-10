import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { fetchProfileAllMessages, sendAdminMessage, markAdminMessageRead, fetchUnreadCount } from '../../api/messages';
import { UnauthorizedError } from '../../api/client';

export default function MessagesPage() {
  const { logout, dashboardProfileId, profiles, refreshUnreadCount } = useOutletContext();
  const [allMessages, setAllMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const parentChatEndRef = useRef(null);

  const selectedProfile = profiles.find((p) => p.id === dashboardProfileId);
  const otherProfiles = useMemo(
    () => profiles.filter((p) => p.id !== dashboardProfileId),
    [profiles, dashboardProfileId]
  );

  // Fetch all messages for the selected profile
  const fetchAll = useCallback(async () => {
    if (!dashboardProfileId) return;
    try {
      const data = await fetchProfileAllMessages(dashboardProfileId);
      setAllMessages(data);
    } catch (err) {
      if (err instanceof UnauthorizedError) logout();
      else console.error('Failed to fetch messages:', err);
    } finally {
      setLoading(false);
    }
  }, [dashboardProfileId, logout]);

  useEffect(() => {
    setLoading(true);
    fetchAll();
  }, [fetchAll]);

  // WebSocket: instant delivery of new messages + 30s fallback poll
  const dashboardProfileIdRef = useRef(dashboardProfileId);
  dashboardProfileIdRef.current = dashboardProfileId;

  useEffect(() => {
    if (!dashboardProfileId) return;
    const interval = setInterval(fetchAll, 30000);

    let ws;
    let reconnectTimeout;
    let disposed = false;
    const connect = () => {
      if (disposed) return;
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'new_message' && data.message) {
              const msg = data.message;
              const pid = dashboardProfileIdRef.current;
              // Relevant if this profile is sender or recipient
              const isRelevant =
                (msg.sender_type === 'profile' && msg.sender_profile_id === pid) ||
                (msg.recipient_type === 'profile' && msg.recipient_profile_id === pid) ||
                (msg.sender_type === 'parent' && msg.recipient_profile_id === pid) ||
                (msg.recipient_type === 'parent' && msg.sender_profile_id === pid);
              if (isRelevant) {
                setAllMessages((prev) => {
                  if (prev.some((m) => m.id === msg.id)) return prev;
                  return [...prev, msg];
                });
              }
            }
          } catch {}
        };
        ws.onclose = () => {
          if (!disposed) reconnectTimeout = setTimeout(connect, 3000);
        };
        ws.onerror = () => ws.close();
      } catch {}
    };
    connect();

    return () => {
      disposed = true;
      clearInterval(interval);
      clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onclose = null;
        ws.onmessage = null;
        ws.onerror = null;
        if (ws.readyState === WebSocket.OPEN) ws.close();
      }
    };
  }, [fetchAll, dashboardProfileId]);

  // Parent <-> selected child messages
  const parentMessages = useMemo(() => {
    if (!dashboardProfileId) return [];
    return allMessages.filter(
      (m) =>
        (m.sender_type === 'parent' && m.recipient_type === 'profile' && m.recipient_profile_id === dashboardProfileId) ||
        (m.sender_type === 'profile' && m.sender_profile_id === dashboardProfileId && m.recipient_type === 'parent')
    );
  }, [allMessages, dashboardProfileId]);

  // Selected child <-> specific sibling messages
  const siblingMessages = useCallback(
    (siblingId) =>
      allMessages.filter(
        (m) =>
          (m.sender_type === 'profile' && m.sender_profile_id === dashboardProfileId && m.recipient_type === 'profile' && m.recipient_profile_id === siblingId) ||
          (m.sender_type === 'profile' && m.sender_profile_id === siblingId && m.recipient_type === 'profile' && m.recipient_profile_id === dashboardProfileId)
      ),
    [allMessages, dashboardProfileId]
  );

  // Mark parent-bound unread messages as read
  useEffect(() => {
    const unread = parentMessages.filter(
      (m) => !m.read && m.sender_type === 'profile' && m.recipient_type === 'parent'
    );
    if (unread.length === 0) return;
    for (const m of unread) {
      markAdminMessageRead(m.id).catch(() => {});
      // Optimistic update
      setAllMessages((prev) => prev.map((msg) => (msg.id === m.id ? { ...msg, read: 1 } : msg)));
    }
    // Update sidebar badge
    refreshUnreadCount();
  }, [parentMessages, refreshUnreadCount]);

  // Scroll parent chat to bottom
  useEffect(() => {
    parentChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [parentMessages.length]);

  const handleSend = async () => {
    if (!text.trim() || !dashboardProfileId || sending) return;
    setSending(true);
    try {
      const msg = await sendAdminMessage({
        recipient_type: 'profile',
        recipient_profile_id: dashboardProfileId,
        content: text.trim(),
      });
      setAllMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setText('');
    } catch (err) {
      if (err instanceof UnauthorizedError) logout();
      else console.error('Failed to send:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!selectedProfile) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">Messages</h2>
        <p className="text-slate-400">Select a profile from the sidebar to view messages.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">Messages</h2>

      {/* Parent <-> Child chat */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden mb-6 flex flex-col" style={{ height: '50vh' }}>
        <div className="p-4 border-b border-slate-700 flex items-center gap-2">
          <span className="text-xl">{selectedProfile.icon}</span>
          <span className="text-lg font-semibold text-white">{selectedProfile.name}</span>
          <span className="text-sm text-slate-400 ml-2">— your conversation</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && parentMessages.length === 0 && (
            <div className="text-center text-slate-500 mt-8">Loading...</div>
          )}
          {!loading && parentMessages.length === 0 && (
            <div className="text-center text-slate-500 mt-8">
              No messages yet. Send a message to {selectedProfile.name}!
            </div>
          )}
          {parentMessages.map((msg) => {
            const isParent = msg.sender_type === 'parent';
            return (
              <div key={msg.id} className={`flex ${isParent ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-xs md:max-w-md px-4 py-2 rounded-2xl ${
                    isParent
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-slate-700 text-slate-100 rounded-bl-md'
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                  <div className={`text-xs mt-1 ${isParent ? 'text-blue-200' : 'text-slate-400'}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={parentChatEndRef} />
        </div>

        <div className="p-4 border-t border-slate-700">
          <div className="flex gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${selectedProfile.name}...`}
              rows={1}
              maxLength={500}
              className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-xl border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <button
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className="px-6 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Sibling conversations (read-only) */}
      {otherProfiles.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">
            {selectedProfile.name}'s conversations with siblings
          </h3>
          <div className="space-y-4">
            {otherProfiles.map((sibling) => {
              const msgs = siblingMessages(sibling.id);
              return (
                <SiblingConversation
                  key={sibling.id}
                  sibling={sibling}
                  selectedProfile={selectedProfile}
                  messages={msgs}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SiblingConversation({ sibling, selectedProfile, messages }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-3 text-left hover:bg-slate-700/50 transition-colors"
      >
        <span className="text-lg">{sibling.icon}</span>
        <span className="font-medium text-white flex-1">
          {selectedProfile.name} & {sibling.name}
        </span>
        <span className="text-sm text-slate-400">
          {messages.length} message{messages.length !== 1 ? 's' : ''}
        </span>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-slate-700 p-4 max-h-64 overflow-y-auto space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-slate-500 text-sm">No messages between these two.</div>
          )}
          {messages.map((msg) => {
            const isSelected = msg.sender_type === 'profile' && msg.sender_profile_id === selectedProfile.id;
            const senderName = isSelected ? selectedProfile.name : sibling.name;
            return (
              <div key={msg.id} className={`flex ${isSelected ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-xs px-4 py-2 rounded-2xl ${
                    isSelected
                      ? 'bg-indigo-600/40 text-slate-100 rounded-br-md'
                      : 'bg-slate-700 text-slate-100 rounded-bl-md'
                  }`}
                >
                  <div className="text-xs font-medium text-slate-400 mb-0.5">{senderName}</div>
                  <div className="whitespace-pre-wrap break-words text-sm">{msg.content}</div>
                  <div className="text-xs mt-1 text-slate-500">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
