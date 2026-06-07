import { useRef, useState, useEffect, useCallback } from 'react';
import { socket } from '../socket';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ]
};

const DEFAULT_PERMISSIONS = { chat: true, mic: true, camera: true, screen: true, reactions: true };

export function useWebRTC({ roomCode, userId, userName, ready = true }) {
  const [localStream, setLocalStream] = useState(null);
  const [peers, setPeers] = useState({});
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const [screenSharerId, setScreenSharerId] = useState(null);
  const [raisedHand, setRaisedHand] = useState(false);
  const [hostSocketId, setHostSocketId] = useState(null);
  const [coHosts, setCoHosts] = useState(new Set());
  const [roomPermissions, setRoomPermissions] = useState({ ...DEFAULT_PERMISSIONS });
  const [isWaiting, setIsWaiting] = useState(false);
  const [isWaitingForHost, setIsWaitingForHost] = useState(false);
  const [waitingParticipants, setWaitingParticipants] = useState([]);
  const [waitingRoomEnabled, setWaitingRoomEnabled] = useState(false);

  const peerConns = useRef({});
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const audioRef = useRef(true);
  const videoRef = useRef(true);

  const isHost = hostSocketId === socket.id;
  const isCoHost = coHosts.has(socket.id);
  const isPrivileged = isHost || isCoHost;

  const createPC = useCallback((socketId, stream) => {
    if (peerConns.current[socketId]) peerConns.current[socketId].close();
    const pc = new RTCPeerConnection(ICE_SERVERS);
    if (stream) stream.getTracks().forEach(t => pc.addTrack(t, stream));
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) socket.emit('ice-candidate', { to: socketId, candidate });
    };
    pc.ontrack = ({ streams }) => {
      setPeers(prev => ({ ...prev, [socketId]: { ...prev[socketId], stream: streams[0] } }));
    };
    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        setPeers(prev => { const n = { ...prev }; delete n[socketId]; return n; });
        delete peerConns.current[socketId];
      }
    };
    peerConns.current[socketId] = pc;
    return pc;
  }, []);

  const toggleAudio = useCallback(() => {
    if (!isPrivileged && !roomPermissions.mic) return;
    const stream = localStreamRef.current;
    if (!stream) return;
    const enabled = !audioRef.current;
    stream.getAudioTracks().forEach(t => { t.enabled = enabled; });
    audioRef.current = enabled;
    setAudioEnabled(enabled);
    socket.emit('media-state', { roomCode, audio: enabled, video: videoRef.current });
  }, [roomCode, isPrivileged, roomPermissions.mic]);

  const toggleVideo = useCallback(() => {
    if (!isPrivileged && !roomPermissions.camera) return;
    const stream = localStreamRef.current;
    if (!stream) return;
    const enabled = !videoRef.current;
    stream.getVideoTracks().forEach(t => { t.enabled = enabled; });
    videoRef.current = enabled;
    setVideoEnabled(enabled);
    socket.emit('media-state', { roomCode, audio: audioRef.current, video: enabled });
  }, [roomCode, isPrivileged, roomPermissions.camera]);

  const toggleScreenShare = useCallback(async () => {
    if (!isPrivileged && !roomPermissions.screen) return;
    if (isScreenSharing) {
      if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
      if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      const camVideo = localStreamRef.current?.getVideoTracks()[0];
      const micAudio = localStreamRef.current?.getAudioTracks()[0];
      for (const pc of Object.values(peerConns.current)) {
        const vs = pc.getSenders().find(s => s.track?.kind === 'video');
        if (vs && camVideo) await vs.replaceTrack(camVideo);
        const as = pc.getSenders().find(s => s.track?.kind === 'audio');
        if (as && micAudio) await as.replaceTrack(micAudio);
      }
      setScreenStream(null);
      setIsScreenSharing(false);
      socket.emit('screen-share', { roomCode, sharing: false });
    } else {
      try {
        const ss = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30 } },
          audio: { echoCancellation: true, noiseSuppression: false }
        });
        screenStreamRef.current = ss;
        const screenVideoTrack = ss.getVideoTracks()[0];
        const screenAudioTrack = ss.getAudioTracks()[0];

        for (const pc of Object.values(peerConns.current)) {
          const vs = pc.getSenders().find(s => s.track?.kind === 'video');
          if (vs) await vs.replaceTrack(screenVideoTrack);
          if (screenAudioTrack) {
            try {
              if (!audioCtxRef.current) {
                const ctx = new AudioContext();
                audioCtxRef.current = ctx;
                const dest = ctx.createMediaStreamDestination();
                const mic = new MediaStream(localStreamRef.current?.getAudioTracks() || []);
                if (mic.getAudioTracks().length) ctx.createMediaStreamSource(mic).connect(dest);
                ctx.createMediaStreamSource(new MediaStream([screenAudioTrack])).connect(dest);
                const as = pc.getSenders().find(s => s.track?.kind === 'audio');
                if (as) await as.replaceTrack(dest.stream.getAudioTracks()[0]);
              }
            } catch {
              const as = pc.getSenders().find(s => s.track?.kind === 'audio');
              if (as) await as.replaceTrack(screenAudioTrack);
            }
          }
        }
        screenVideoTrack.onended = () => toggleScreenShare();
        setScreenStream(ss);
        setIsScreenSharing(true);
        socket.emit('screen-share', { roomCode, sharing: true });
      } catch (err) {
        if (err.name !== 'NotAllowedError') console.error('Screen share error:', err);
      }
    }
  }, [isScreenSharing, roomCode, isPrivileged, roomPermissions.screen]);

  const toggleHand = useCallback(() => {
    const raised = !raisedHand;
    setRaisedHand(raised);
    socket.emit('raise-hand', { roomCode, raised, userName });
  }, [raisedHand, roomCode, userName]);

  const grantCoHost = useCallback((targetSocketId) => socket.emit('grant-cohost', { targetSocketId, roomCode }), [roomCode]);
  const revokeCoHost = useCallback((targetSocketId) => socket.emit('revoke-cohost', { targetSocketId, roomCode }), [roomCode]);
  const transferHost = useCallback((targetSocketId) => socket.emit('transfer-host', { targetSocketId, roomCode }), [roomCode]);
  const updatePermissions = useCallback((perms) => socket.emit('update-room-permissions', { roomCode, permissions: perms }), [roomCode]);
  const approveParticipant = useCallback((targetSocketId) => socket.emit('approve-participant', { targetSocketId, roomCode }), [roomCode]);
  const rejectParticipant = useCallback((targetSocketId) => socket.emit('reject-participant', { targetSocketId, roomCode }), [roomCode]);
  const toggleWaitingRoom = useCallback((enabled) => socket.emit('toggle-waiting-room', { roomCode, enabled }), [roomCode]);

  useEffect(() => {
    if (!ready) return;
    let mounted = true;

    const init = async () => {
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true }
        });
      } catch {
        try { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); }
        catch {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            if (mounted) { setVideoEnabled(false); videoRef.current = false; }
          } catch {
            if (mounted) { setVideoEnabled(false); setAudioEnabled(false); videoRef.current = false; audioRef.current = false; }
          }
        }
      }
      if (!mounted) { stream?.getTracks().forEach(t => t.stop()); return; }
      localStreamRef.current = stream;
      setLocalStream(stream);

      socket.connect();
      socket.emit('join-room', { roomCode, userId, userName });

      socket.on('you-are-waiting', () => {
        if (mounted) { setIsWaiting(true); setIsWaitingForHost(false); }
      });

      socket.on('waiting-for-host', () => {
        if (mounted) setIsWaitingForHost(true);
      });

      socket.on('waiting-room-update', (list) => {
        if (mounted) setWaitingParticipants(list);
      });

      socket.on('room-settings', ({ waitingRoomEnabled: enabled }) => {
        if (mounted) setWaitingRoomEnabled(enabled);
      });

      socket.on('room-roles', ({ host, coHosts: chList }) => {
        setHostSocketId(host);
        setCoHosts(new Set(chList));
      });

      socket.on('room-permissions', (perms) => {
        setRoomPermissions(perms);
      });

      socket.on('host-transferred', ({ to }) => setHostSocketId(to));
      socket.on('you-are-cohost', (isC) => {
        setCoHosts(prev => { const n = new Set(prev); isC ? n.add(socket.id) : n.delete(socket.id); return n; });
      });

      socket.on('forced-mute', () => {
        localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = false; });
        audioRef.current = false;
        setAudioEnabled(false);
      });

      socket.on('forced-camera-off', () => {
        localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = false; });
        videoRef.current = false;
        setVideoEnabled(false);
        socket.emit('media-state', { roomCode, audio: audioRef.current, video: false });
      });

      socket.on('forced-stop-screen', () => {
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(t => t.stop());
          screenStreamRef.current = null;
          setIsScreenSharing(false);
          socket.emit('screen-share', { roomCode, sharing: false });
        }
      });

      socket.on('existing-participants', async (participants) => {
        if (!mounted) return;
        setIsWaiting(false);
        setIsWaitingForHost(false);
        // Check if anyone is already screen sharing
        const sharer = participants.find(p => p.screenSharing);
        if (sharer) setScreenSharerId(sharer.socketId);
        for (const p of participants) {
          if (!mounted) return;
          setPeers(prev => ({ ...prev, [p.socketId]: { socketId: p.socketId, userId: p.userId, userName: p.userName, audio: p.audio, video: p.video, screenSharing: !!p.screenSharing, stream: null } }));
          const pc = createPC(p.socketId, stream);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('offer', { to: p.socketId, offer });
        }
      });

      socket.on('user-joined', ({ socketId, userId: uid, userName: uName }) => {
        if (!mounted) return;
        setPeers(prev => ({ ...prev, [socketId]: { socketId, userId: uid, userName: uName, audio: true, video: true, stream: null } }));
      });

      socket.on('offer', async ({ from, offer }) => {
        if (!mounted) return;
        const pc = createPC(from, stream);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { to: from, answer });
      });

      socket.on('answer', async ({ from, answer }) => {
        const pc = peerConns.current[from];
        if (pc && pc.signalingState !== 'stable')
          await pc.setRemoteDescription(new RTCSessionDescription(answer)).catch(() => {});
      });

      socket.on('ice-candidate', async ({ from, candidate }) => {
        const pc = peerConns.current[from];
        if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      });

      socket.on('user-left', ({ socketId }) => {
        peerConns.current[socketId]?.close();
        delete peerConns.current[socketId];
        setPeers(prev => { const n = { ...prev }; delete n[socketId]; return n; });
      });

      socket.on('peer-media-state', ({ socketId, audio, video }) => {
        setPeers(prev => ({ ...prev, [socketId]: { ...prev[socketId], audio, video } }));
      });
      socket.on('peer-screen-share', ({ socketId, sharing }) => {
        setPeers(prev => ({ ...prev, [socketId]: { ...prev[socketId], screenSharing: sharing } }));
        setScreenSharerId(prev => sharing ? socketId : (prev === socketId ? null : prev));
      });
      socket.on('raise-hand', ({ socketId, raised }) => {
        setPeers(prev => ({ ...prev, [socketId]: { ...prev[socketId], handRaised: raised } }));
      });
    };

    init();

    return () => {
      mounted = false;
      Object.values(peerConns.current).forEach(pc => pc.close());
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close();
      ['you-are-waiting','you-are-rejected','waiting-for-host','waiting-room-update','room-settings',
       'room-roles','room-permissions','host-transferred','you-are-cohost','forced-mute',
       'forced-camera-off','forced-stop-screen','existing-participants','user-joined',
       'offer','answer','ice-candidate','user-left','peer-media-state','peer-screen-share','raise-hand'
      ].forEach(e => socket.off(e));
      socket.disconnect();
    };
  }, [ready]);

  return {
    localStream, peers, audioEnabled, videoEnabled, isScreenSharing, screenStream, screenSharerId,
    raisedHand, hostSocketId, coHosts, isHost, isCoHost, roomPermissions,
    isWaiting, isWaitingForHost, waitingParticipants, waitingRoomEnabled,
    toggleAudio, toggleVideo, toggleScreenShare, toggleHand,
    grantCoHost, revokeCoHost, transferHost, updatePermissions,
    approveParticipant, rejectParticipant, toggleWaitingRoom,
    localStreamRef
  };
}
