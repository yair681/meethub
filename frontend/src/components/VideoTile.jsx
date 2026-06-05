import { useRef, useEffect } from 'react';

const COLORS = ['#1a73e8','#34a853','#ea4335','#fbbc04','#9c27b0','#00bcd4','#ff5722','#607d8b'];
function nameColor(name) { return COLORS[(name?.charCodeAt(0) || 0) % COLORS.length]; }

function Initials({ name }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#1a1a2e' }}>
      <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white"
        style={{ background: nameColor(name) }}>
        {name?.charAt(0)?.toUpperCase() || '?'}
      </div>
    </div>
  );
}

export default function VideoTile({
  stream, name, audioEnabled = true, videoEnabled = true,
  handRaised = false, screenSharing = false, isLocal = false,
  isHost = false, isCoHost = false, canManage = false,
  onMute, onKick, socketId
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (stream) {
      video.srcObject = stream;
      video.play().catch(() => {});
    } else {
      video.srcObject = null;
    }
  }, [stream]);

  const showVideo = stream && videoEnabled;
  const isMirrored = isLocal && !screenSharing;

  return (
    <div className={`video-tile relative group ${screenSharing ? 'screen-share' : ''}`}>
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
          style={{ transform: isMirrored ? 'scaleX(-1)' : 'none' }}
        />
      ) : (
        <Initials name={name} />
      )}

      {/* Top right indicators */}
      <div className="absolute top-2 right-2 flex gap-1 flex-row-reverse">
        {handRaised && (
          <div className="bg-yellow-500 text-white text-xs px-2 py-0.5 rounded-full animate-bounce">✋</div>
        )}
        {screenSharing && (
          <div className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">📺 מציג</div>
        )}
        {(isHost || isCoHost) && !isLocal && (
          <div className={`text-xs px-2 py-0.5 rounded-full ${isHost ? 'bg-blue-700 text-white' : 'bg-gray-600 text-white'}`}>
            {isHost ? 'מנהל' : 'מנהל משנה'}
          </div>
        )}
      </div>

      {/* Name label */}
      <div className="name-label flex items-center gap-1.5">
        {!audioEnabled && <span className="text-red-400 text-xs">🔇</span>}
        {!videoEnabled && <span className="text-gray-400 text-xs">📷</span>}
        <span>{name}{isLocal ? ' (את/אתה)' : ''}</span>
      </div>

      {/* Host controls overlay (appears on hover) */}
      {canManage && !isLocal && (
        <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onMute?.(socketId)}
            className="bg-black/70 text-white text-xs px-2 py-1 rounded hover:bg-black/90"
          >
            השתק
          </button>
          <button
            onClick={() => onKick?.(socketId)}
            className="bg-red-600/80 text-white text-xs px-2 py-1 rounded hover:bg-red-600"
          >
            הסר
          </button>
        </div>
      )}
    </div>
  );
}
