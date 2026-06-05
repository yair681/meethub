import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWebRTC } from '../hooks/useWebRTC';
import { socket } from '../socket';
import api from '../api';
import VideoTile from '../components/VideoTile';
import ChatPanel from '../components/ChatPanel';
import ParticipantsPanel from '../components/ParticipantsPanel';
import ReactionsOverlay from '../components/ReactionsOverlay';
import toast from 'react-hot-toast';

/* ---- Icons ---- */
function MicIcon({ on }) {
  return on ? (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.34 3 3 3 .23 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
    </svg>
  );
}
function CamIcon({ on }) {
  return on ? (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M21 6.5l-4-4-9 9-1-5H4C2.9 6.5 2 7.4 2 8.5v8c0 1.1.9 2 2 2h8.5c1.1 0 2-.9 2-2V14l5 3v-4l2 2 .5-.5-1-1L21 6.5z"/>
      <path d="M3.27 2L2 3.27l4 4H4C2.9 7.27 2 8.17 2 9.27v7c0 1.1.9 2 2 2h9c.77 0 1.43-.45 1.77-1.1l2.96 2.96L19 18.86l-2-2V13l4 4V8.27l-4 4-5.45-5.45L3.27 2z"/>
    </svg>
  );
}

function VideoGrid({ children }) {
  const count = React.Children.count(children);
  let cols = 1;
  if (count === 2) cols = 2;
  else if (count <= 4) cols = 2;
  else if (count <= 9) cols = 3;
  else cols = 4;
  return (
    <div className="video-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridAutoRows: 'auto' }}>
      {children}
    </div>
  );
}

import React from 'react';

/* ---- Permission Toggle Row ---- */
function PermRow({ icon, label, permKey, permissions, onToggle }) {
  const on = permissions[permKey];
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <span className="text-sm text-white flex items-center gap-2">
        <span>{icon}</span> {label}
      </span>
      <button
        onClick={() => onToggle(permKey, !on)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${on ? 'bg-blue-600' : 'bg-gray-600'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-1' : 'translate-x-6'}`} />
      </button>
    </div>
  );
}

/* ---- Management Panel ---- */
function ManagementPanel({ participants, localUser, isHost, isCoHost, hostSocketId, coHosts,
  roomCode, roomPermissions, onClose, onGrantCoHost, onRevokeCoHost, onTransferHost, onUpdatePermissions }) {

  const handleToggle = (key, value) => {
    onUpdatePermissions({ [key]: value });
  };

  return (
    <div className="side-panel" dir="rtl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <span className="text-yellow-400">⚙️</span> ניהול פגישה
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* Permissions section */}
        <div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">הרשאות משתתפים</p>
          <div className="bg-white/5 rounded-xl px-4 py-1">
            <PermRow icon="💬" label="צ׳אט" permKey="chat" permissions={roomPermissions} onToggle={handleToggle} />
            <PermRow icon="🎙️" label="מיקרופון" permKey="mic" permissions={roomPermissions} onToggle={handleToggle} />
            <PermRow icon="📷" label="מצלמה" permKey="camera" permissions={roomPermissions} onToggle={handleToggle} />
            <PermRow icon="🖥️" label="שיתוף מסך" permKey="screen" permissions={roomPermissions} onToggle={handleToggle} />
            <PermRow icon="😊" label="תגובות" permKey="reactions" permissions={roomPermissions} onToggle={handleToggle} />
          </div>
          <p className="text-xs text-gray-500 mt-2">מנהלים ראשיים ומשניים פטורים מהגבלות אלו</p>
        </div>

        {/* Quick actions */}
        <div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">פעולות מהירות</p>
          <button
            onClick={() => Object.values(participants).forEach(p =>
              socket.emit('mute-participant', { targetSocketId: p.socketId, roomCode })
            )}
            className="w-full text-right text-sm bg-meet-surface hover:bg-gray-600 text-white px-4 py-2.5 rounded-xl flex items-center gap-2">
            🔇 <span>השתק את כולם</span>
          </button>
        </div>

        {/* Participants list */}
        <div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">
            משתתפים ({Object.keys(participants).length + 1})
          </p>
          <div className="space-y-1">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex-shrink-0 flex items-center justify-center text-white text-sm font-bold">
                {localUser.userName?.charAt(0)?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{localUser.userName} <span className="text-gray-400">(את/אתה)</span></p>
                {isHost && <p className="text-xs text-blue-400">מנהל ראשי</p>}
                {isCoHost && !isHost && <p className="text-xs text-purple-400">מנהל משנה</p>}
              </div>
            </div>

            {Object.values(participants).map(p => {
              const pIsHost = p.socketId === hostSocketId;
              const pIsCoHost = coHosts?.has(p.socketId);
              return (
                <div key={p.socketId} className="p-2 rounded-xl bg-white/5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-600 flex-shrink-0 flex items-center justify-center text-white text-sm font-bold">
                      {p.userName?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{p.userName}</p>
                      <p className="text-xs text-gray-400">
                        {pIsHost ? '👑 מנהל ראשי' : pIsCoHost ? '🛡️ מנהל משנה' : 'משתתף'}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {!p.audio && <span className="text-red-400 text-xs">🔇</span>}
                      {!p.video && <span className="text-gray-400 text-xs">📷</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pr-10">
                    {(isHost || isCoHost) && !pIsHost && (
                      <>
                        <button onClick={() => socket.emit('mute-participant', { targetSocketId: p.socketId, roomCode })}
                          className="text-xs px-2.5 py-1 bg-gray-600 text-white rounded-full hover:bg-gray-500">
                          השתק
                        </button>
                        <button onClick={() => socket.emit('kick-participant', { targetSocketId: p.socketId, roomCode })}
                          className="text-xs px-2.5 py-1 bg-red-700 text-white rounded-full hover:bg-red-600">
                          הסר
                        </button>
                      </>
                    )}
                    {isHost && !pIsHost && (
                      <>
                        {pIsCoHost ? (
                          <button onClick={() => onRevokeCoHost(p.socketId)}
                            className="text-xs px-2.5 py-1 bg-purple-800 text-white rounded-full hover:bg-purple-700">
                            הסר הרשאה
                          </button>
                        ) : (
                          <button onClick={() => onGrantCoHost(p.socketId)}
                            className="text-xs px-2.5 py-1 bg-purple-600 text-white rounded-full hover:bg-purple-500">
                            מנהל משנה
                          </button>
                        )}
                        <button onClick={() => { if (confirm(`להעביר ניהול ל-${p.userName}?`)) onTransferHost(p.socketId); }}
                          className="text-xs px-2.5 py-1 bg-blue-700 text-white rounded-full hover:bg-blue-600">
                          העבר ניהול
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Main Meeting Page ---- */
export default function MeetingPage() {
  const { code } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [panel, setPanel] = useState(null); // 'chat' | 'participants' | 'manage'
  const [unreadChat, setUnreadChat] = useState(0);
  const [showEmojis, setShowEmojis] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [joinTime] = useState(Date.now());

  useEffect(() => {
    api.get(`/meetings/join/${code}`).then(res => {
      setMeeting(res.data);
      setLoading(false);
    }).catch(err => {
      setError(err.response?.data?.error || 'הפגישה לא נמצאה');
      setLoading(false);
    });
  }, [code]);

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - joinTime) / 1000)), 1000);
    return () => clearInterval(t);
  }, [joinTime]);

  const formatElapsed = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
  };

  const {
    localStream, peers, audioEnabled, videoEnabled, isScreenSharing,
    raisedHand, isHost, isCoHost, hostSocketId, coHosts, roomPermissions,
    toggleAudio, toggleVideo, toggleScreenShare, toggleHand,
    grantCoHost, revokeCoHost, transferHost, updatePermissions
  } = useWebRTC({ roomCode: code, userId: user?.id, userName: user?.name });

  useEffect(() => {
    socket.on('kicked', () => {
      toast.error('הוסרת מהפגישה על ידי המנהל');
      navigate('/');
    });
    socket.on('meeting-ended', () => {
      toast('הפגישה הסתיימה על ידי המנהל', { icon: 'ℹ️' });
      navigate('/');
    });
    socket.on('host-transferred', ({ to }) => {
      if (to === socket.id) toast.success('הינך כעת המנהל הראשי של הפגישה');
    });
    socket.on('you-are-cohost', (isC) => {
      if (isC) toast.success('הינך כעת מנהל משנה של הפגישה');
      else toast('הרשאת מנהל משנה הוסרה', { icon: 'ℹ️' });
    });
    return () => {
      socket.off('kicked');
      socket.off('meeting-ended');
      socket.off('host-transferred');
      socket.off('you-are-cohost');
    };
  }, []);

  const handleHangUp = useCallback(() => {
    if (isHost) socket.emit('end-meeting', { roomCode: code });
    navigate('/');
  }, [isHost, code, navigate]);

  const handleLeave = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const setActivePanel = (name) => setPanel(p => p === name ? null : name);

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-meet-dark">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-meet-blue border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-400">מצטרף לפגישה...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-screen bg-meet-dark" dir="rtl">
      <div className="text-center">
        <p className="text-6xl mb-4">😕</p>
        <h2 className="text-xl font-semibold text-white mb-2">לא ניתן להצטרף לפגישה</h2>
        <p className="text-gray-400 mb-6">{error}</p>
        <button onClick={() => navigate('/')} className="px-6 py-2.5 bg-meet-blue text-white rounded-full hover:bg-blue-700">
          חזרה לדף הבית
        </button>
      </div>
    </div>
  );

  const canManage = isHost || isCoHost;

  return (
    <div className="h-screen bg-meet-dark flex flex-col overflow-hidden" dir="rtl">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400 font-mono">{formatElapsed(elapsed)}</span>

          <button onClick={() => setShowInfo(s => !s)}
            className="flex items-center gap-1.5 text-white hover:bg-white/10 px-3 py-1.5 rounded-lg transition text-sm">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-gray-400">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
            <span className="font-medium truncate max-w-[200px]">{meeting?.title || code}</span>
          </button>

          {showInfo && (
            <div className="absolute top-14 right-4 bg-meet-surface rounded-xl p-4 shadow-2xl z-50 w-72">
              <p className="text-sm font-semibold text-white mb-3">פרטי פגישה</p>
              <div>
                <p className="text-xs text-gray-400 mb-1">קוד הצטרפות</p>
                <p className="text-sm text-white font-mono">{code}</p>
              </div>
              <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/meet/${code}`); toast.success('הועתק!'); }}
                className="mt-2 text-sm text-meet-blue hover:text-blue-400">
                העתק קישור הצטרפות
              </button>
              <button onClick={() => setShowInfo(false)} className="absolute top-3 left-3 text-gray-400 hover:text-white">×</button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isHost && <span className="text-xs bg-blue-600/30 text-blue-300 border border-blue-500/40 px-2 py-1 rounded-full">👑 מנהל ראשי</span>}
          {isCoHost && !isHost && <span className="text-xs bg-purple-600/30 text-purple-300 border border-purple-500/40 px-2 py-1 rounded-full">🛡️ מנהל משנה</span>}
          <div className="flex items-center gap-1 text-gray-300 text-sm">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
            </svg>
            {Object.keys(peers).length + 1}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Video area */}
        <div className="flex-1 overflow-hidden relative">
          <VideoGrid>
            <VideoTile
              stream={localStream}
              name={user?.name}
              audioEnabled={audioEnabled}
              videoEnabled={videoEnabled}
              isLocal={true}
              isHost={isHost}
              isCoHost={isCoHost}
            />
            {Object.entries(peers).map(([sid, p]) => (
              <VideoTile
                key={sid}
                socketId={sid}
                stream={p.stream}
                name={p.userName}
                audioEnabled={p.audio}
                videoEnabled={p.video}
                handRaised={p.handRaised}
                screenSharing={p.screenSharing}
                isHost={sid === hostSocketId}
                isCoHost={coHosts?.has(sid)}
                canManage={canManage}
                onMute={(id) => socket.emit('mute-participant', { targetSocketId: id, roomCode: code })}
                onKick={(id) => socket.emit('kick-participant', { targetSocketId: id, roomCode: code })}
              />
            ))}
          </VideoGrid>

          <ReactionsOverlay roomCode={code} userName={user?.name} open={showEmojis} onClose={() => setShowEmojis(false)} />
        </div>

        {/* Side panel */}
        {panel === 'chat' && (
          <ChatPanel
            roomCode={code} userName={user?.name} onClose={() => setPanel(null)}
            chatAllowed={canManage || roomPermissions.chat}
          />
        )}
        {panel === 'participants' && (
          <ParticipantsPanel
            participants={peers}
            localUser={{ userName: user?.name, audio: audioEnabled, video: videoEnabled }}
            isHost={isHost} isCoHost={isCoHost}
            hostSocketId={hostSocketId} coHosts={coHosts}
            roomCode={code} onClose={() => setPanel(null)}
            onGrantCoHost={grantCoHost} onRevokeCoHost={revokeCoHost} onTransferHost={transferHost}
          />
        )}
        {panel === 'manage' && canManage && (
          <ManagementPanel
            participants={peers}
            localUser={{ userName: user?.name }}
            isHost={isHost} isCoHost={isCoHost}
            hostSocketId={hostSocketId} coHosts={coHosts}
            roomCode={code} roomPermissions={roomPermissions}
            onClose={() => setPanel(null)}
            onGrantCoHost={grantCoHost} onRevokeCoHost={revokeCoHost} onTransferHost={transferHost}
            onUpdatePermissions={updatePermissions}
          />
        )}
      </div>

      {/* Bottom controls */}
      <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ background: '#202124' }}>
        {/* Right: meeting code */}
        <div className="flex items-center gap-2 text-sm text-gray-400 min-w-[180px] justify-start">
          <span className="font-mono text-xs hidden sm:block truncate max-w-[140px]">{code}</span>
          <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/meet/${code}`); toast.success('הועתק!'); }}
            className="hover:text-white transition flex-shrink-0">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
          </button>
        </div>

        {/* Center controls */}
        <div className="flex items-center gap-2">
          {/* Mic */}
          {(() => {
            const blocked = !canManage && !roomPermissions.mic;
            return (
              <div className="flex flex-col items-center gap-1" title={blocked ? 'המנהל השבית מיקרופונים' : ''}>
                <button onClick={toggleAudio} disabled={blocked}
                  className={`control-btn ${!audioEnabled ? 'active' : ''} ${blocked ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  <MicIcon on={audioEnabled} />
                  {blocked && <span className="absolute -top-1 -right-1 text-xs">🚫</span>}
                </button>
                <span className="text-xs text-gray-400">{blocked ? 'חסום' : audioEnabled ? 'השתק' : 'בטל השתקה'}</span>
              </div>
            );
          })()}

          {/* Camera */}
          {(() => {
            const blocked = !canManage && !roomPermissions.camera;
            return (
              <div className="flex flex-col items-center gap-1" title={blocked ? 'המנהל השבית מצלמות' : ''}>
                <button onClick={toggleVideo} disabled={blocked}
                  className={`control-btn ${!videoEnabled ? 'active' : ''} ${blocked ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  <CamIcon on={videoEnabled} />
                  {blocked && <span className="absolute -top-1 -right-1 text-xs">🚫</span>}
                </button>
                <span className="text-xs text-gray-400">{blocked ? 'חסום' : videoEnabled ? 'כבה מצלמה' : 'הפעל מצלמה'}</span>
              </div>
            );
          })()}

          {/* Screen share */}
          {(() => {
            const blocked = !canManage && !roomPermissions.screen;
            return (
              <div className="flex flex-col items-center gap-1" title={blocked ? 'המנהל השבית שיתוף מסך' : ''}>
                <button onClick={toggleScreenShare} disabled={blocked}
                  className={`control-btn ${isScreenSharing ? 'bg-green-700/40 ring-2 ring-green-500' : ''} ${blocked ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  <svg viewBox="0 0 24 24" fill="currentColor" className={`w-5 h-5 ${isScreenSharing ? 'text-green-400' : ''}`}>
                    <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zm-8-4l-4-4 1.41-1.41L12 11.17l6.59-6.58L20 6l-8 8z"/>
                  </svg>
                  {blocked && <span className="absolute -top-1 -right-1 text-xs">🚫</span>}
                </button>
                <span className="text-xs text-gray-400">{blocked ? 'חסום' : isScreenSharing ? 'עצור שיתוף' : 'שתף מסך'}</span>
              </div>
            );
          })()}

          {/* Reactions */}
          {(() => {
            const blocked = !canManage && !roomPermissions.reactions;
            return (
              <div className="flex flex-col items-center gap-1" title={blocked ? 'המנהל השבית תגובות' : ''}>
                <button onClick={() => !blocked && setShowEmojis(s => !s)}
                  disabled={blocked}
                  className={`control-btn ${showEmojis ? 'bg-yellow-600/30' : ''} ${blocked ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  <span className="text-lg">😊</span>
                  {blocked && <span className="absolute -top-1 -right-1 text-xs">🚫</span>}
                </button>
                <span className="text-xs text-gray-400">{blocked ? 'חסום' : 'תגובות'}</span>
              </div>
            );
          })()}

          <div className="flex flex-col items-center gap-1">
            <button onClick={toggleHand}
              className={`control-btn ${raisedHand ? 'bg-yellow-600/30 ring-2 ring-yellow-500' : ''}`}>
              <span className="text-lg">✋</span>
            </button>
            <span className="text-xs text-gray-400">הרם יד</span>
          </div>

          {/* End / Leave button */}
          {isHost ? (
            <div className="flex flex-col items-center gap-1">
              <button onClick={handleHangUp} className="control-btn btn-end">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .27-.11.52-.29.7l-2.48 2.48a.956.956 0 0 1-.71.29c-.27 0-.52-.1-.7-.28-.79-.74-1.69-1.36-2.67-1.85a.992.992 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
                </svg>
              </button>
              <span className="text-xs text-gray-400">סיים פגישה</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <button onClick={handleLeave} className="control-btn btn-end">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .27-.11.52-.29.7l-2.48 2.48a.956.956 0 0 1-.71.29c-.27 0-.52-.1-.7-.28-.79-.74-1.69-1.36-2.67-1.85a.992.992 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
                </svg>
              </button>
              <span className="text-xs text-gray-400">עזוב</span>
            </div>
          )}
        </div>

        {/* Left: side panels */}
        <div className="flex items-center gap-2 min-w-[180px] justify-end">
          {canManage && (
            <div className="flex flex-col items-center gap-1">
              <button onClick={() => setActivePanel('manage')}
                className={`control-btn ${panel === 'manage' ? 'ring-2 ring-yellow-400' : ''}`}>
                <span className="text-lg">⚙️</span>
              </button>
              <span className="text-xs text-gray-400">ניהול</span>
            </div>
          )}

          <div className="flex flex-col items-center gap-1">
            <button onClick={() => { setActivePanel('participants'); }}
              className={`control-btn ${panel === 'participants' ? 'ring-2 ring-white/30' : ''}`}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
              </svg>
            </button>
            <span className="text-xs text-gray-400">אנשים</span>
          </div>

          <div className="flex flex-col items-center gap-1 relative">
            <button onClick={() => { setActivePanel('chat'); setUnreadChat(0); }}
              className={`control-btn ${panel === 'chat' ? 'ring-2 ring-white/30' : ''}`}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
              </svg>
              {unreadChat > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadChat}
                </span>
              )}
            </button>
            <span className="text-xs text-gray-400">צ'אט</span>
          </div>
        </div>
      </div>
    </div>
  );
}
