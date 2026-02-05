import { useState, useEffect, useRef } from 'react';

export const meta = {
  key: 'chatbot',
  name: 'ChatBot',
  icon: '🤖',
  description: 'Chat with an AI assistant'
};

function ChatBot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [configError, setConfigError] = useState(null);
  const [appId, setAppId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    // Find the chatbot app to get its id
    async function findApp() {
      try {
        const res = await fetch('/api/apps');
        const apps = await res.json();
        const chatbotApp = apps.find(a => a.app_type === 'builtin' && a.url === 'chatbot');
        if (chatbotApp) {
          setAppId(chatbotApp.id);
        } else {
          setConfigError('ChatBot app not found');
        }
      } catch (err) {
        setConfigError('Failed to load app configuration');
      }
    }
    findApp();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input after loading completes
  useEffect(() => {
    if (!loading && messages.length > 0) {
      inputRef.current?.focus();
    }
  }, [loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading || !appId) return;

    const userMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chatbot/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: appId, messages: newMessages }),
      });
      const data = await res.json();

      if (data.error === 'api_key_missing') {
        setConfigError('api_key_missing');
        return;
      }
      if (data.error === 'api_key_invalid') {
        setConfigError('api_key_invalid');
        return;
      }
      if (data.error) {
        setMessages([...newMessages, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
        return;
      }

      setMessages([...newMessages, { role: 'assistant', content: data.response }]);
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: 'Sorry, I could not connect to the server.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (configError === 'api_key_missing' || configError === 'api_key_invalid') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="text-8xl mb-6">🔧</div>
          <h1 className="text-3xl font-bold text-white mb-4">Setup Required</h1>
          <p className="text-slate-300 text-lg mb-6">
            {configError === 'api_key_missing'
              ? 'ChatBot needs an OpenAI API key to work.'
              : 'The OpenAI API key is invalid. Please check it.'}
          </p>
          <div className="bg-slate-800/50 rounded-xl p-6 text-left">
            <p className="text-slate-400 text-sm">
              Ask a parent to:
            </p>
            <ol className="text-slate-300 text-sm mt-2 space-y-2 list-decimal list-inside">
              <li>Go to the Dashboard</li>
              <li>Go to Settings</li>
              <li>Enter an OpenAI API key</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  if (configError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 flex flex-col items-center justify-center p-8">
        <div className="text-center">
          <div className="text-8xl mb-6">❌</div>
          <h1 className="text-3xl font-bold text-white mb-4">Error</h1>
          <p className="text-slate-300 text-lg">{configError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-slate-800/50 border-b border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🤖</span>
            <div>
              <h1 className="text-xl font-bold text-white">ChatBot</h1>
              <p className="text-slate-400 text-sm">Ask me anything!</p>
            </div>
          </div>
          <button
            onClick={() => setMessages([])}
            disabled={messages.length === 0 || loading}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <span>✨</span>
            New conversation
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-6xl mb-4">💬</div>
            <p className="text-slate-400 text-lg">Start a conversation!</p>
            <p className="text-slate-500 text-sm mt-2">Type a message below to chat with the AI.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-slate-700 text-slate-100 rounded-bl-md'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-700 text-slate-100 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 bg-slate-800/50 border-t border-slate-700 p-4">
        <div className="flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={loading || !appId}
            className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim() || !appId}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatBot;
