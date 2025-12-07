import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { NextRequest } from 'next/server';

interface RoomUser {
  socketId: string;
  userId: string;
  userName: string;
}

const rooms = new Map<string, Map<string, RoomUser>>();

let io: SocketIOServer | null = null;

function initializeSocket(httpServer: HTTPServer) {
  if (io) return io;

  io = new SocketIOServer(httpServer, {
    path: '/api/socket/io',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join room
    socket.on('join-room', ({ roomId, userId, userName }: {
      roomId: string;
      userId: string;
      userName: string;
    }) => {
      socket.join(roomId);

      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Map());
      }

      const room = rooms.get(roomId)!;
      const existingUsers = Array.from(room.values());

      // Add user to room
      room.set(userId, { socketId: socket.id, userId, userName });

      if (existingUsers.length === 0) {
        // First user in room
        socket.emit('room-joined', { isFirst: true });
      } else {
        // Notify existing users
        socket.to(roomId).emit('user-joined', { userId, userName });

        // Send existing users to new user
        socket.emit('existing-users', existingUsers.map(u => ({
          userId: u.userId,
          userName: u.userName
        })));
      }

      console.log(`User ${userId} joined room ${roomId}`);
    });

    // Relay WebRTC signals
    socket.on('signal', ({ targetUserId, signal }: {
      targetUserId: string;
      signal: any;
    }) => {
      // Find target socket
      let targetSocketId: string | null = null;

      rooms.forEach((users) => {
        const user = users.get(targetUserId);
        if (user) {
          targetSocketId = user.socketId;
        }
      });

      if (targetSocketId) {
        // Find sender userId
        let fromUserId: string | null = null;
        rooms.forEach((users) => {
          users.forEach((user) => {
            if (user.socketId === socket.id) {
              fromUserId = user.userId;
            }
          });
        });

        if (fromUserId) {
          io!.to(targetSocketId).emit('signal', {
            fromUserId,
            signal
          });
        }
      }
    });

    // Leave room
    socket.on('leave-room', ({ roomId, userId }: {
      roomId: string;
      userId: string;
    }) => {
      const room = rooms.get(roomId);
      if (room) {
        room.delete(userId);
        socket.to(roomId).emit('user-left', { userId });
        socket.leave(roomId);

        // Clean up empty rooms
        if (room.size === 0) {
          rooms.delete(roomId);
        }
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);

      // Find and remove user from all rooms
      rooms.forEach((users, roomId) => {
        users.forEach((user, userId) => {
          if (user.socketId === socket.id) {
            users.delete(userId);
            socket.to(roomId).emit('user-left', { userId });

            // Clean up empty rooms
            if (users.size === 0) {
              rooms.delete(roomId);
            }
          }
        });
      });
    });
  });

  return io;
}

// Next.js 13+ App Router WebSocket handler
export const GET = async (req: NextRequest) => {
  // @ts-ignore - upgrade is available in Node.js HTTP server
  const { socket: rawSocket, head } = req as any;

  if (rawSocket && !io) {
    const httpServer = rawSocket.server as HTTPServer;
    initializeSocket(httpServer);
  }

  return new Response('Socket.IO server running', { status: 200 });
};
