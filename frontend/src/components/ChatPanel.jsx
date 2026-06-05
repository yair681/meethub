import { useState, useRef, useEffect } from 'react';
import { socket } from '../socket';
import { format } from 'date-fns';

export default function ChatPanel({ roomCode, userName, onClose, chatAllowed = true, messages = [] }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    const msg = input.trim();
    if (!msg) return;
    socket.emit('chat-message', { roomCode, message: msg, userName, timestamp: new Date().toISOString() });
    setInput('');
  };

  return (
    <div className="side-panel" dir="rtl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h3 className="font-semibold text-white">הודעות בשיחה</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-3xl mb-2">💬</p>
            <p className="text-sm">אין הודעות עדיין</p>
            <p className="text-xs mt-1">ההודעות גלויות רק למשתתפים בשיחה</p>
          </div>
        )}
        {messages.map((m, i) => {
          const isMe = m.userName === userName;
          return (
            <div key={i} className={`flex flex-col ${isMe ? 'items-start' : 'items-end'}`}>
              <span className="text-xs text-gray-400 mb-1 px-1">{m.userName}</span>
              <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${
                isMe ? 'bg-meet-blue text-white rounded-bl-sm' : 'bg-meet-surface text-white rounded-br-sm'
              }`}>
                {m.message}
              </div>
              <span className="text-xs text-gray-500 mt-0.5 px-1">
                {format(new Date(m.timestamp), 'HH:mm')}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {!chatAllowed ? (
        <div className="p-3 border-t border-gray-700 text-center text-sm text-gray-500">
          🚫 המנהל השבית את הצ׳אט
        </div>
      ) : (
        <div className="p-3 border-t border-gray-700 flex gap-2">
          <button onClick={send} disabled={!input.trim()}
            className="bg-meet-blue text-white rounded-full w-9 h-9 flex-shrink-0 flex items-center justify-center hover:bg-blue-700 disabled:opacity-40">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
            </svg>
          </button>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
            placeholder="שלח הודעה לכולם"
            className="flex-1 bg-meet-surface text-white placeholder-gray-400 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-meet-blue"
            dir="rtl"
          />
        </div>
      )}
    </div>
  );
}
