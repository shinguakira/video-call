// Bob: a real Socket.IO client running as a separate Node.js process
import { io } from "socket.io-client";

const socket = io("http://localhost:4001");

socket.on("connect", () => {
  console.log("Bob connected:", socket.id);

  socket.emit("join-room", {
    roomId: "live-demo",
    userId: "bob-live-001",
    userName: "Bob",
  });

  // Give Alice time to see Bob join, then send a message
  setTimeout(() => {
    socket.emit("chat-message", {
      roomId: "live-demo",
      message: "こんにちは！これはBobからの本物のメッセージです",
    });
    console.log("Bob sent message");
  }, 1500);

  // Alice replies — listen for it
  socket.on("chat-message", (msg) => {
    console.log(`Bob received from ${msg.userName}: "${msg.message}"`);
    setTimeout(() => {
      socket.emit("chat-message", {
        roomId: "live-demo",
        message: "受け取ったよ！モックじゃないでしょ？",
      });
      console.log("Bob replied");
      setTimeout(() => process.exit(0), 2000);
    }, 500);
  });
});

socket.on("connect_error", (e) => {
  console.error("Connection failed:", e.message);
  process.exit(1);
});
