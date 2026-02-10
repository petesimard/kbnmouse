import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useProfile } from '../../contexts/ProfileContext';
import { useMessages } from '../../hooks/useMessages';

export const meta = {
  key: 'messages',
  name: 'Message Center',
  icon: '✉️',
  description: 'Send and receive messages',
  skipTracking: true,
};

function Messages() {
  const { profileId, profiles } = useProfile();
  const { messages, loading, send, markRead, refresh } = useMessages(profileId);
  const [selectedConvo, setSelectedConvo] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  // Conversations: Parents + other profiles
  const conversations = useMemo(() => {
    const convos = [{ type: 'parent', id: null, name: 'Parents', icon: '👨‍👩‍👧‍👦' }];
    for (const p of profiles) {
      if (p.id !== profileId) {
        convos.push({ type: 'profile', id: p.id, name: p.name, icon: p.icon });
      }
    }
    return convos;
  }, [profiles, profileId]);

  // Messages for current conversation
  const convoMessages = useMemo(() => {
    if (!selectedConvo) return [];
    if (selectedConvo.type === 'parent') {
      return messages.filter(
        (m) =>
          (m.sender_type === 'parent' && m.recipient_type === 'profile' && m.recipient_profile_id === profileId) ||
          (m.sender_type === 'profile' && m.sender_profile_id === profileId && m.recipient_type === 'parent')
      );
    }
    // profile-to-profile
    const otherId = selectedConvo.id;
    return messages.filter(
      (m) =>
        (m.sender_type === 'profile' && m.sender_profile_id === profileId && m.recipient_type === 'profile' && m.recipient_profile_id === otherId) ||
        (m.sender_type === 'profile' && m.sender_profile_id === otherId && m.recipient_type === 'profile' && m.recipient_profile_id === profileId)
    );
  }, [messages, selectedConvo, profileId]);

  // Unread counts per conversation
  const unreadCounts = useMemo(() => {
    const counts = {};
    for (const convo of conversations) {
      const key = convo.type === 'parent' ? 'parent' : `profile-${convo.id}`;
      if (convo.type === 'parent') {
        counts[key] = messages.filter(
          (m) => m.sender_type === 'parent' && m.recipient_type === 'profile' && m.recipient_profile_id === profileId && !m.read
        ).length;
      } else {
        counts[key] = messages.filter(
          (m) => m.sender_type === 'profile' && m.sender_profile_id === convo.id && m.recipient_type === 'profile' && m.recipient_profile_id === profileId && !m.read
        ).length;
      }
    }
    return counts;
  }, [messages, conversations, profileId]);

  // Mark messages read when opening a conversation
  const selectConvo = useCallback((convo) => {
    setSelectedConvo(convo);
    setText('');
  }, []);

  useEffect(() => {
    if (!selectedConvo) return;
    const unread = convoMessages.filter(
      (m) => !m.read && !(m.sender_type === 'profile' && m.sender_profile_id === profileId)
    );
    for (const m of unread) {
      markRead(m.id);
    }
  }, [convoMessages, selectedConvo, profileId, markRead]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [convoMessages.length]);

  const handleSend = async () => {
    if (!text.trim() || !selectedConvo || sending) return;
    setSending(true);
    try {
      await send(selectedConvo.type, selectedConvo.id, text.trim());
      setText('');
    } catch (err) {
      console.error('Failed to send:', err);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-xl">Loading messages...</div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 text-center">
        <h1 className="text-3xl font-bold text-white">Message Center</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Conversation list */}
        <div className="w-64 border-r border-slate-700 flex flex-col bg-slate-800/50">
          <div className="p-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Conversations
          </div>
          {conversations.map((convo) => {
            const key = convo.type === 'parent' ? 'parent' : `profile-${convo.id}`;
            const unread = unreadCounts[key] || 0;
            const isSelected = selectedConvo && selectedConvo.type === convo.type && selectedConvo.id === convo.id;
            return (
              <button
                key={key}
                onClick={() => selectConvo(convo)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  isSelected ? 'bg-blue-600/30 text-white' : 'text-slate-300 hover:bg-slate-700/50'
                }`}
              >
                <span className="text-2xl">{convo.icon}</span>
                <span className="flex-1 font-medium truncate">{convo.name}</span>
                {unread > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Message area */}
        <div className="flex-1 flex flex-col">
          {selectedConvo ? (
            <>
              {/* Conversation header */}
              <div className="p-4 border-b border-slate-700 bg-slate-800/30">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{selectedConvo.icon}</span>
                  <span className="text-lg font-semibold text-white">{selectedConvo.name}</span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {convoMessages.length === 0 && (
                  <div className="text-center text-slate-500 mt-8">No messages yet. Say hi!</div>
                )}
                {convoMessages.map((msg) => {
                  const isMine = msg.sender_type === 'profile' && msg.sender_profile_id === profileId;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-xs md:max-w-md px-4 py-2 rounded-2xl ${
                          isMine
                            ? 'bg-blue-600 text-white rounded-br-md'
                            : 'bg-slate-700 text-slate-100 rounded-bl-md'
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                        <div className={`text-xs mt-1 ${isMine ? 'text-blue-200' : 'text-slate-400'}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Compose */}
              <div className="p-4 border-t border-slate-700 bg-slate-800/30">
                <div className="flex gap-2">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
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
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-slate-500">
                <div className="text-5xl mb-4">💬</div>
                <p className="text-lg">Select a conversation to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Messages;
