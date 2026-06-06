import { socket } from '../socket';

const COLORS = ['#1a73e8','#34a853','#ea4335','#fbbc04','#9c27b0'];

function ParticipantRow({ p, viewerIsHost, viewerIsCoHost, hostSocketId, coHosts, roomCode, isLocal, onGrantCoHost, onRevokeCoHost, onTransferHost }) {
  const isParticipantHost = p.socketId === hostSocketId;
  const isParticipantCoHost = coHosts.has(p.socketId);
  const canManage = (viewerIsHost || viewerIsCoHost) && !isLocal && !isParticipantHost;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 rounded-lg">
      <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white font-semibold text-sm"
        style={{ background: COLORS[(p.userName?.charCodeAt(0) || 0) % COLORS.length] }}>
        {p.userName?.charAt(0)?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm text-white truncate">{p.userName}{isLocal ? ' (את/אתה)' : ''}</p>
          {isParticipantHost && (
            <span className="text-xs bg-blue-700 text-white px-1.5 py-0.5 rounded-full">מנהל</span>
          )}
          {isParticipantCoHost && !isParticipantHost && (
            <span className="text-xs bg-gray-600 text-white px-1.5 py-0.5 rounded-full">מנהל משנה</span>
          )}
          {!p.userId && !isLocal && (
            <span className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded-full">אורח</span>
          )}
        </div>
        {p.handRaised && <p className="text-xs text-yellow-400">✋ מרים יד</p>}
      </div>
      <div className="flex gap-1 items-center flex-shrink-0">
        {!p.audio && <span className="text-red-400 text-sm">🔇</span>}
        {!p.video && <span className="text-gray-400 text-sm">📷</span>}
        {p.screenSharing && <span className="text-blue-400 text-sm">📺</span>}

        {canManage && (
          <div className="flex gap-1 mr-1">
            <button
              onClick={() => socket.emit('mute-participant', { targetSocketId: p.socketId, roomCode })}
              className="p-1 text-gray-400 hover:text-white rounded text-xs hover:bg-meet-surface"
              title="השתק">
              🔇
            </button>
            <button
              onClick={() => socket.emit('kick-participant', { targetSocketId: p.socketId, roomCode })}
              className="p-1 text-gray-400 hover:text-red-400 rounded text-xs hover:bg-meet-surface"
              title="הסר מהשיחה">
              ✕
            </button>
          </div>
        )}

        {/* Host-only: grant/revoke co-host, transfer host */}
        {viewerIsHost && !isLocal && !isParticipantHost && (
          <div className="flex gap-1">
            {isParticipantCoHost ? (
              <button
                onClick={() => onRevokeCoHost(p.socketId)}
                className="text-xs px-2 py-0.5 bg-gray-600 text-white rounded-full hover:bg-gray-500"
                title="הסר מנהל משנה">
                הסר הרשאה
              </button>
            ) : (
              <button
                onClick={() => onGrantCoHost(p.socketId)}
                className="text-xs px-2 py-0.5 bg-purple-700 text-white rounded-full hover:bg-purple-600"
                title="הפוך למנהל משנה">
                מנהל משנה
              </button>
            )}
            <button
              onClick={() => onTransferHost(p.socketId)}
              className="text-xs px-2 py-0.5 bg-blue-700 text-white rounded-full hover:bg-blue-600"
              title="העבר מנהל">
              העבר מנהל
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ParticipantsPanel({
  participants, localUser, isHost, isCoHost, hostSocketId, coHosts,
  roomCode, onClose, onGrantCoHost, onRevokeCoHost, onTransferHost
}) {
  const allParticipants = [
    { ...localUser, socketId: socket.id, isLocal: true, userId: localUser.userId ?? 'local' },
    ...Object.values(participants)
  ];

  return (
    <div className="side-panel" dir="rtl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h3 className="font-semibold text-white">משתתפים ({allParticipants.length})</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">×</button>
      </div>

      {(isHost || isCoHost) && (
        <div className="px-4 py-3 border-b border-gray-700 space-y-2">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">שליטת מנהל</p>
          <button
            onClick={() => Object.values(participants).forEach(p =>
              socket.emit('mute-participant', { targetSocketId: p.socketId, roomCode })
            )}
            className="text-sm text-white bg-meet-surface hover:bg-gray-600 px-3 py-1.5 rounded-lg w-full text-right">
            🔇 השתקת כולם
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-2">
        {allParticipants.map(p => (
          <ParticipantRow
            key={p.socketId || 'local'}
            p={p}
            viewerIsHost={isHost}
            viewerIsCoHost={isCoHost}
            hostSocketId={hostSocketId}
            coHosts={coHosts || new Set()}
            roomCode={roomCode}
            isLocal={p.isLocal}
            onGrantCoHost={onGrantCoHost}
            onRevokeCoHost={onRevokeCoHost}
            onTransferHost={onTransferHost}
          />
        ))}
      </div>

      {isHost && (
        <div className="px-4 py-3 border-t border-gray-700">
          <p className="text-xs text-gray-500 text-center">לחץ על שם משתתף להצגת אפשרויות ניהול</p>
        </div>
      )}
    </div>
  );
}
