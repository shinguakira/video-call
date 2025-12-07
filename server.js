const { Server } = require('socket.io');
const http = require('http');

const httpServer = http.createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Allow all origins for dev
    methods: ['GET', 'POST']
  }
});

const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.onAny((event, ...args) => {
    console.log(`[DEBUG] Received event: ${event}`, args);
  });

  // Join room
  socket.on('join-room', ({ roomId, userId, userName }) => {
    console.log(`[JOIN] ========================================`);
    console.log(`[JOIN] User ${userId} (${userName}) joining room ${roomId}`);
    console.log(`[JOIN] Socket ID: ${socket.id}`);
    
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }

    const room = rooms.get(roomId);
    const existingUsers = Array.from(room.values());

    console.log(`[JOIN] Room ${roomId} had ${existingUsers.length} existing users before this join`);
    if (existingUsers.length > 0) {
      console.log(`[JOIN] Existing users:`, existingUsers.map(u => `${u.userName}(${u.userId})`).join(', '));
    }

    // Add user to room
    room.set(userId, { socketId: socket.id, userId, userName });

    if (existingUsers.length === 0) {
      // First user in room
      console.log(`[JOIN] ${userId} is FIRST user in room ${roomId}`);
      socket.emit('room-joined', { isFirst: true });
    } else {
      // Notify existing users about the new joiner
      console.log(`[JOIN] Broadcasting 'user-joined' to existing users in room ${roomId}`);
      console.log(`[JOIN] Message: { userId: ${userId}, userName: ${userName} }`);
      socket.to(roomId).emit('user-joined', { userId, userName });
      console.log(`[JOIN] Broadcast complete. Room now has ${io.sockets.adapter.rooms.get(roomId)?.size || 0} sockets`);

      // Send existing users to new user
      console.log(`[JOIN] Sending ${existingUsers.length} existing user(s) to ${userId}:`);
      existingUsers.forEach(u => console.log(`[JOIN]   - ${u.userName} (${u.userId})`));
      socket.emit('existing-users', existingUsers.map(u => ({
        userId: u.userId,
        userName: u.userName
      })));
    }

    console.log(`[JOIN] Room ${roomId} now has ${room.size} total users:`, Array.from(room.keys()).join(', '));
    console.log(`[JOIN] ========================================`);
  });

  // Relay WebRTC signals
  socket.on('signal', ({ targetUserId, signal }) => {
    console.log(`[SIGNAL] From ${socket.id} to ${targetUserId}, type: ${signal.type || 'unknown'}`);
    let targetSocketId = null;

    rooms.forEach((users) => {
      const user = users.get(targetUserId);
      if (user) {
        targetSocketId = user.socketId;
      }
    });

    if (targetSocketId) {
      // Find sender userId
      let fromUserId = null;
      rooms.forEach((users) => {
        users.forEach((user) => {
          if (user.socketId === socket.id) {
            fromUserId = user.userId;
          }
        });
      });

      if (fromUserId) {
        console.log(`[SIGNAL] Relaying from ${fromUserId} to ${targetUserId} (socket: ${targetSocketId})`);
        io.to(targetSocketId).emit('signal', {
          fromUserId,
          signal
        });
      } else {
        console.error(`[SIGNAL] Could not find sender userId for socket ${socket.id}`);
      }
    } else {
      console.error(`[SIGNAL] Could not find target socket for userId ${targetUserId}`);
    }
  });

  // Leave room
  socket.on('leave-room', ({ roomId, userId }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.delete(userId);
      socket.to(roomId).emit('user-left', { userId });
      socket.leave(roomId);

      if (room.size === 0) {
        rooms.delete(roomId);
      }
    }
  });

  // Chat message relay
  socket.on('chat-message', ({ roomId, message }) => {
    let userId = null;
    let userName = 'Guest';
    
    // Find user info
    const room = rooms.get(roomId);
    if (room) {
      const user = Array.from(room.values()).find(u => u.socketId === socket.id);
      if (user) {
        userId = user.userId;
        userName = user.userName;
      }
    }

    socket.to(roomId).emit('chat-message', {
      userId,
      userName,
      message,
      timestamp: Date.now()
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    rooms.forEach((users, roomId) => {
      users.forEach((user, userId) => {
        if (user.socketId === socket.id) {
          users.delete(userId);
          socket.to(roomId).emit('user-left', { userId });
          if (users.size === 0) {
            rooms.delete(roomId);
          }
        }
      });
    });
  });
});

const PORT = 4001;
httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});
