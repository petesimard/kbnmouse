import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '../api/messages.js';
import { UnauthorizedError } from '../api/messages.js';

function getWsUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

// Kid-facing hook
export function useMessages(profileId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!profileId) return;
    try {
      const data = await api.fetchMessages(profileId);
      setMessages(data);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // WebSocket: instant delivery of new messages
  const profileIdRef = useRef(profileId);
  profileIdRef.current = profileId;

  useEffect(() => {
    let ws;
    let reconnectTimeout;

    const connect = () => {
      try {
        ws = new WebSocket(getWsUrl());
        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'new_message' && data.message) {
              const msg = data.message;
              const pid = profileIdRef.current;
              // Only append if this message involves our profile
              const isRelevant =
                (msg.sender_type === 'profile' && msg.sender_profile_id === pid) ||
                (msg.recipient_type === 'profile' && msg.recipient_profile_id === pid);
              if (isRelevant) {
                setMessages((prev) => {
                  // Deduplicate (sender also gets this via HTTP response)
                  if (prev.some((m) => m.id === msg.id)) return prev;
                  return [...prev, msg];
                });
              }
            }
          } catch {}
        };
        ws.onclose = () => {
          reconnectTimeout = setTimeout(connect, 3000);
        };
        ws.onerror = () => ws.close();
      } catch {}
    };

    connect();
    return () => {
      clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, []);

  // Fallback poll every 30s
  useEffect(() => {
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const send = useCallback(async (recipientType, recipientProfileId, content) => {
    const msg = await api.sendMessage({
      sender_profile_id: profileId,
      recipient_type: recipientType,
      recipient_profile_id: recipientProfileId,
      content,
    });
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
    return msg;
  }, [profileId]);

  const markRead = useCallback(async (id) => {
    // Optimistic: update state immediately so badges don't flicker
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, read: 1 } : m)));
    api.markMessageRead(id).catch(() => {});
  }, []);

  return { messages, loading, send, markRead, refresh: fetchAll };
}

// Admin (parent-facing) hook — not used by MessagesPage directly but kept for potential use
export function useAdminMessages(profileId, onUnauthorized) {
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const handleError = useCallback((err) => {
    if (err instanceof UnauthorizedError && onUnauthorized) {
      onUnauthorized();
    } else {
      console.error('Admin messages error:', err);
    }
  }, [onUnauthorized]);

  const fetchAll = useCallback(async () => {
    try {
      const data = await api.fetchAdminMessages(profileId);
      setMessages(data);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [profileId, handleError]);

  const fetchUnread = useCallback(async () => {
    try {
      const data = await api.fetchUnreadCount();
      setUnreadCount(data.count);
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  useEffect(() => {
    fetchAll();
    fetchUnread();
  }, [fetchAll, fetchUnread]);

  const send = useCallback(async (recipientType, recipientProfileId, content) => {
    try {
      const msg = await api.sendAdminMessage({
        recipient_type: recipientType,
        recipient_profile_id: recipientProfileId,
        content,
      });
      setMessages((prev) => [...prev, msg]);
      return msg;
    } catch (err) {
      handleError(err);
      throw err;
    }
  }, [handleError]);

  const markRead = useCallback(async (id) => {
    try {
      await api.markAdminMessageRead(id);
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, read: 1 } : m)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  return { messages, unreadCount, loading, send, markRead, refresh: fetchAll, refreshUnread: fetchUnread };
}
