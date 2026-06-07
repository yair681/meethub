const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const { db, initDB } = require('./db');
const authRoutes = require('./routes/auth');
const meetingsRoutes = require('./routes/meetings');
const adminRoutes = require('./routes/admin');
const usersRoutes = require('./routes/users');

const isProd = process.env.NODE_ENV === 'production';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: isProd ? { origin: true } : { origin: 'http://localhost:5173', methods: ['GET', 'POST'] }
});

app.use(cors(isProd ? { origin: true } : { origin: 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', usersRoutes);

const DEFAULT_PERMISSIONS = { chat: true, mic: true, camera: true, screen: true, reactions: true };

// roomCode -> { participants: Map, host: socketId, coHosts: Set, permissions: {}, waitingRoomEnabled: bool, waitingRoom: Map }
const rooms = new Map();

function getRoomState(roomCode) {
  if (!rooms.has(roomCode)) {
    let savedSettings = {};
    try {
      const meeting = db.prepare('SELECT settings FROM meetings WHERE code = ?').get(roomCode);
      if (meeting?.settings) savedSettings = JSON.parse(meeting.settings);
    } catch {}
    rooms.set(roomCode, {
      participants: new Map(),
      host: null,
      coHosts: new Set(),
      permissions: { ...DEFAULT_PERMISSIONS, ...(savedSettings.permissions || {}) },
      waitingRoomEnabled: !!savedSettings.waitingRoomEnabled,
      waitingRoom: new Map(),
      waitingForHost: new Map()
    });
  }
  return rooms.get(roomCode);
}

function savePermanentSettings(roomCode, room) {
  const meeting = db.prepare('SELECT type FROM meetings WHERE code = ?').get(roomCode);
  if (meeting?.type === 'permanent') {
    db.prepare('UPDATE meetings SET settings=? WHERE code=?').run(
      JSON.stringify({ permissions: room.permissions, waitingRoomEnabled: room.waitingRoomEnabled }),
      roomCode
    );
  }
}

function broadcastActiveMeetings() {
  const active = [];
  for (const [code, room] of rooms.entries()) {
    active.push({ code, count: room.participants.size, participants: Array.from(room.participants.values()) });
  }
  io.emit('active-meetings-update', active);
}

function broadcastRoomRoles(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  io.to(roomCode).emit('room-roles', { host: room.host, coHosts: Array.from(room.coHosts) });
}

function broadcastWaitingRoom(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const list = Array.from(room.waitingRoom.values());
  if (room.host) io.to(room.host).emit('waiting-room-update', list);
  for (const coHostId of room.coHosts) io.to(coHostId).emit('waiting-room-update', list);
}

function isAuthorized(room, socketId) {
  return room.host === socketId || room.coHosts.has(socketId);
}

function doJoin(room, roomCode, socket, userId, userName) {
  socket.join(roomCode);
  room.participants.set(socket.id, {
    socketId: socket.id, userId, userName, audio: true, video: true, handRaised: false, screenSharing: false
  });
  if (!room.host) room.host = socket.id;

  const others = Array.from(room.participants.entries())
    .filter(([id]) => id !== socket.id)
    .map(([, d]) => d);

  socket.emit('existing-participants', others);
  socket.emit('room-roles', { host: room.host, coHosts: Array.from(room.coHosts) });
  socket.emit('room-permissions', room.permissions);
  socket.emit('room-settings', { waitingRoomEnabled: room.waitingRoomEnabled });
  socket.to(roomCode).emit('user-joined', { socketId: socket.id, userId, userName });
  broadcastActiveMeetings();
}

io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('join-room', ({ roomCode, userId, userName }) => {
    currentRoom = roomCode;
    const room = getRoomState(roomCode);

    const meeting = db.prepare('SELECT host_id FROM meetings WHERE code = ?').get(roomCode);
    const isCreator = !!(meeting?.host_id && userId && meeting.host_id === userId);

    // If room is empty and this person is not the creator → wait for host
    if (meeting?.host_id && room.participants.size === 0 && !isCreator) {
      room.waitingForHost.set(socket.id, { socketId: socket.id, userId, userName });
      socket.emit('waiting-for-host');
      return;
    }

    if (!room.waitingRoomEnabled || room.participants.size === 0) {
      doJoin(room, roomCode, socket, userId, userName);
    } else {
      room.waitingRoom.set(socket.id, { socketId: socket.id, userId, userName });
      socket.emit('you-are-waiting');
      broadcastWaitingRoom(roomCode);
    }

    // Creator just joined — admit everyone waiting for host
    if (isCreator && room.waitingForHost.size > 0) {
      for (const [sid, waiting] of [...room.waitingForHost.entries()]) {
        room.waitingForHost.delete(sid);
        const targetSocket = io.sockets.sockets.get(sid);
        if (!targetSocket) continue;
        if (room.waitingRoomEnabled) {
          room.waitingRoom.set(sid, waiting);
          targetSocket.emit('you-are-waiting');
        } else {
          doJoin(room, roomCode, targetSocket, waiting.userId, waiting.userName);
        }
      }
      if (room.waitingRoomEnabled) broadcastWaitingRoom(roomCode);
    }
  });

  // WebRTC signaling
  socket.on('offer', ({ to, offer }) => io.to(to).emit('offer', { from: socket.id, offer }));
  socket.on('answer', ({ to, answer }) => io.to(to).emit('answer', { from: socket.id, answer }));
  socket.on('ice-candidate', ({ to, candidate }) => io.to(to).emit('ice-candidate', { from: socket.id, candidate }));

  // Chat — blocked if permission off
  socket.on('chat-message', ({ roomCode, message, userName, timestamp }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    if (!room.permissions.chat && !isAuthorized(room, socket.id)) return;
    io.to(roomCode).emit('chat-message', { socketId: socket.id, message, userName, timestamp });
  });

  // Reactions — blocked if permission off
  socket.on('reaction', ({ roomCode, emoji, userName }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    if (!room.permissions.reactions && !isAuthorized(room, socket.id)) return;
    io.to(roomCode).emit('reaction', { socketId: socket.id, emoji, userName });
  });

  // Raise hand
  socket.on('raise-hand', ({ roomCode, raised, userName }) => {
    const room = rooms.get(roomCode);
    if (room?.participants.has(socket.id)) room.participants.get(socket.id).handRaised = raised;
    io.to(roomCode).emit('raise-hand', { socketId: socket.id, raised, userName });
  });

  // Media state
  socket.on('media-state', ({ roomCode, audio, video }) => {
    const room = rooms.get(roomCode);
    if (room?.participants.has(socket.id)) {
      Object.assign(room.participants.get(socket.id), { audio, video });
    }
    socket.to(roomCode).emit('peer-media-state', { socketId: socket.id, audio, video });
  });

  // Screen share — blocked if permission off
  socket.on('screen-share', ({ roomCode, sharing }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    if (sharing && !room.permissions.screen && !isAuthorized(room, socket.id)) return;
    if (room.participants.has(socket.id)) room.participants.get(socket.id).screenSharing = !!sharing;
    socket.to(roomCode).emit('peer-screen-share', { socketId: socket.id, sharing });
  });

  // ---- Permissions management (host/co-host only) ----
  socket.on('update-room-permissions', ({ roomCode, permissions }) => {
    const room = rooms.get(roomCode);
    if (!room || !isAuthorized(room, socket.id)) return;

    const old = { ...room.permissions };
    room.permissions = { ...room.permissions, ...permissions };
    io.to(roomCode).emit('room-permissions', room.permissions);

    if (old.mic && !room.permissions.mic) {
      for (const [sid] of room.participants.entries()) {
        if (!isAuthorized(room, sid) && sid !== room.host) io.to(sid).emit('forced-mute');
      }
    }
    if (old.camera && !room.permissions.camera) {
      for (const [sid] of room.participants.entries()) {
        if (!isAuthorized(room, sid) && sid !== room.host) io.to(sid).emit('forced-camera-off');
      }
    }
    if (old.screen && !room.permissions.screen) {
      for (const [sid] of room.participants.entries()) {
        if (!isAuthorized(room, sid) && sid !== room.host) io.to(sid).emit('forced-stop-screen');
      }
    }
  });

  // ---- Waiting room management ----
  socket.on('approve-participant', ({ targetSocketId, roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || !isAuthorized(room, socket.id)) return;
    const waiting = room.waitingRoom.get(targetSocketId);
    if (!waiting) return;
    room.waitingRoom.delete(targetSocketId);
    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (!targetSocket) { broadcastWaitingRoom(roomCode); return; }
    doJoin(room, roomCode, targetSocket, waiting.userId, waiting.userName);
    broadcastWaitingRoom(roomCode);
  });

  socket.on('reject-participant', ({ targetSocketId, roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || !isAuthorized(room, socket.id)) return;
    const waiting = room.waitingRoom.get(targetSocketId);
    if (!waiting) return;
    room.waitingRoom.delete(targetSocketId);
    io.to(targetSocketId).emit('you-are-rejected');
    broadcastWaitingRoom(roomCode);
  });

  socket.on('toggle-waiting-room', ({ roomCode, enabled }) => {
    const room = rooms.get(roomCode);
    if (!room || !isAuthorized(room, socket.id)) return;
    room.waitingRoomEnabled = !!enabled;
    io.to(roomCode).emit('room-settings', { waitingRoomEnabled: room.waitingRoomEnabled });

    // If disabled, auto-approve everyone waiting
    if (!enabled && room.waitingRoom.size > 0) {
      for (const [sid, waiting] of [...room.waitingRoom.entries()]) {
        room.waitingRoom.delete(sid);
        const targetSocket = io.sockets.sockets.get(sid);
        if (targetSocket) doJoin(room, roomCode, targetSocket, waiting.userId, waiting.userName);
      }
      broadcastWaitingRoom(roomCode);
    }
  });

  // ---- Host/co-host controls ----
  socket.on('grant-cohost', ({ targetSocketId, roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.host !== socket.id) return;
    room.coHosts.add(targetSocketId);
    broadcastRoomRoles(roomCode);
    io.to(targetSocketId).emit('you-are-cohost', true);
  });

  socket.on('revoke-cohost', ({ targetSocketId, roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.host !== socket.id) return;
    room.coHosts.delete(targetSocketId);
    broadcastRoomRoles(roomCode);
    io.to(targetSocketId).emit('you-are-cohost', false);
  });

  socket.on('transfer-host', ({ targetSocketId, roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.host !== socket.id) return;
    room.coHosts.delete(targetSocketId);
    room.coHosts.add(socket.id);
    room.host = targetSocketId;
    broadcastRoomRoles(roomCode);
    io.to(roomCode).emit('host-transferred', { from: socket.id, to: targetSocketId });
  });

  socket.on('mute-participant', ({ targetSocketId, roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || !isAuthorized(room, socket.id)) return;
    io.to(targetSocketId).emit('forced-mute');
  });

  socket.on('kick-participant', ({ targetSocketId, roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || !isAuthorized(room, socket.id)) return;
    io.to(targetSocketId).emit('kicked');
    const target = io.sockets.sockets.get(targetSocketId);
    if (target) {
      target.leave(roomCode);
      room.participants.delete(targetSocketId);
      room.coHosts.delete(targetSocketId);
      io.to(roomCode).emit('user-left', { socketId: targetSocketId });
      broadcastRoomRoles(roomCode);
    }
    broadcastActiveMeetings();
  });

  socket.on('end-meeting', ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (!room || room.host !== socket.id) return;
    for (const [sid] of room.waitingRoom.entries()) {
      io.to(sid).emit('you-are-rejected');
    }
    for (const [sid] of room.waitingForHost.entries()) {
      io.to(sid).emit('meeting-ended');
    }
    io.to(roomCode).emit('meeting-ended');
    const meeting = db.prepare('SELECT type FROM meetings WHERE code = ?').get(roomCode);
    if (meeting?.type === 'permanent') {
      db.prepare("UPDATE meetings SET status='active', settings=? WHERE code=?").run(
        JSON.stringify({ permissions: room.permissions, waitingRoomEnabled: room.waitingRoomEnabled }),
        roomCode
      );
    } else {
      db.prepare("UPDATE meetings SET status='ended', ended_at=CURRENT_TIMESTAMP WHERE code=?").run(roomCode);
    }
    rooms.delete(roomCode);
    broadcastActiveMeetings();
  });

  socket.on('disconnect', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      const room = rooms.get(currentRoom);

      // If they were waiting for host, just remove from queue
      if (room.waitingForHost.has(socket.id)) {
        room.waitingForHost.delete(socket.id);
        return;
      }

      // If they were in the waiting room, just remove from queue
      if (room.waitingRoom.has(socket.id)) {
        room.waitingRoom.delete(socket.id);
        broadcastWaitingRoom(currentRoom);
        return;
      }

      room.participants.delete(socket.id);
      room.coHosts.delete(socket.id);
      if (room.host === socket.id) {
        let newHost = room.coHosts.size > 0 ? room.coHosts.values().next().value
          : room.participants.size > 0 ? room.participants.keys().next().value : null;
        if (newHost) room.coHosts.delete(newHost);
        room.host = newHost;
      }
      if (room.participants.size === 0) {
        for (const [sid] of room.waitingRoom.entries()) {
          io.to(sid).emit('you-are-rejected');
        }
        for (const [sid] of room.waitingForHost.entries()) {
          io.to(sid).emit('you-are-rejected');
        }
        savePermanentSettings(currentRoom, room);
        rooms.delete(currentRoom);
      } else {
        io.to(currentRoom).emit('user-left', { socketId: socket.id });
        broadcastRoomRoles(currentRoom);
      }
      broadcastActiveMeetings();
    }
  });
});

initDB();

// In production: serve the built frontend
if (isProd) {
  const distPath = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`MeetHub running on port ${PORT}`));
