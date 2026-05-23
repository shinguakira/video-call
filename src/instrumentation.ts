/**
 * Next.js Instrumentation Hook
 * Runs once when the Next.js server starts.
 * Starts the Socket.IO signaling server in the same process —
 * no separate `node server.js` needed.
 */

let started = false;

export async function register() {
  // Only run in Node.js runtime (not Edge), and only once
  if (process.env.NEXT_RUNTIME !== "nodejs" || started) return;
  started = true;

  const { createServer } = await import("http");
  const { Server } = await import("socket.io");

  type RoomUser = { socketId: string; userId: string; userName: string };
  const rooms = new Map<string, Map<string, RoomUser>>();

  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  io.on("connection", (socket) => {
    console.log(`[Signal] connected: ${socket.id}`);

    socket.on("join-room", ({ roomId, userId, userName }: { roomId: string; userId: string; userName: string }) => {
      if (!rooms.has(roomId)) rooms.set(roomId, new Map());
      const room = rooms.get(roomId)!;

      // Idempotent — React Strict Mode can fire join-room twice
      if (room.get(userId)?.socketId === socket.id) {
        console.log(`[Signal] duplicate join ignored: ${userId}`);
        return;
      }

      socket.join(roomId);
      const existingUsers = Array.from(room.values());
      room.set(userId, { socketId: socket.id, userId, userName });

      if (existingUsers.length === 0) {
        socket.emit("room-joined", { isFirst: true });
      } else {
        socket.to(roomId).emit("user-joined", { userId, userName });
        socket.emit("existing-users", existingUsers.map((u) => ({ userId: u.userId, userName: u.userName })));
      }
      console.log(`[Signal] ${userId} joined ${roomId} (${room.size} users)`);
    });

    socket.on("signal", ({ targetUserId, signal }: { targetUserId: string; signal: unknown }) => {
      let targetSocketId: string | null = null;
      let fromUserId: string | null = null;

      rooms.forEach((users) => {
        const target = users.get(targetUserId);
        if (target) targetSocketId = target.socketId;
        users.forEach((u) => { if (u.socketId === socket.id) fromUserId = u.userId; });
      });

      if (targetSocketId && fromUserId) {
        io.to(targetSocketId).emit("signal", { fromUserId, signal });
      }
    });

    socket.on("leave-room", ({ roomId, userId }: { roomId: string; userId: string }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      room.delete(userId);
      socket.to(roomId).emit("user-left", { userId });
      socket.leave(roomId);
      if (room.size === 0) rooms.delete(roomId);
    });

    socket.on("chat-message", ({ roomId, message }: { roomId: string; message: string }) => {
      const room = rooms.get(roomId);
      const user = room && Array.from(room.values()).find((u) => u.socketId === socket.id);
      socket.to(roomId).emit("chat-message", {
        userId: user?.userId ?? null,
        userName: user?.userName ?? "Guest",
        message,
        timestamp: Date.now(),
      });
    });

    socket.on("disconnect", () => {
      console.log(`[Signal] disconnected: ${socket.id}`);
      rooms.forEach((users, roomId) => {
        users.forEach((user, userId) => {
          if (user.socketId === socket.id) {
            users.delete(userId);
            socket.to(roomId).emit("user-left", { userId });
            if (users.size === 0) rooms.delete(roomId);
          }
        });
      });
    });
  });

  const PORT = 4001;
  httpServer.listen(PORT, () => {
    console.log(`[Signal] Socket.IO server running on port ${PORT}`);
  });
}
