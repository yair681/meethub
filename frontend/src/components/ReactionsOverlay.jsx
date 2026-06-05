import { useState, useEffect } from 'react';
import { socket } from '../socket';

const EMOJIS = ['👍', '❤️', '😂', '😮', '👏', '🎉', '🔥', '✨'];

let reactionId = 0;

export default function ReactionsOverlay({ roomCode, userName, open, onClose }) {
  const [floating, setFloating] = useState([]);

  useEffect(() => {
    const handler = ({ emoji }) => {
      const id = ++reactionId;
      const x = 10 + Math.random() * 80;
      setFloating(prev => [...prev, { id, emoji, x }]);
      setTimeout(() => setFloating(prev => prev.filter(r => r.id !== id)), 3000);
    };
    socket.on('reaction', handler);
    return () => socket.off('reaction', handler);
  }, []);

  const sendReaction = (emoji) => {
    socket.emit('reaction', { roomCode, emoji, userName });
    onClose();
  };

  return (
    <>
      {floating.map(r => (
        <div key={r.id} className="reaction-float" style={{ left: `${r.x}%`, bottom: '100px' }}>
          {r.emoji}
        </div>
      ))}

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <div className="emoji-picker">
            {EMOJIS.map(e => (
              <button key={e} className="emoji-btn" onClick={() => sendReaction(e)}>{e}</button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
