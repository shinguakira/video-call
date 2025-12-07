# Video Call App Walkthrough

This guide explains how to run and use the video call application.

## 🚀 Running the Application

Because of Next.js App Router limitations with WebSockets in development, we use a **separate signaling server**. You need to run **two terminal commands**.

### 1. Start the Signaling Server (Terminal 1)
This handles the real-time socket connections.
```bash
node server.js
```
*You should see: `Socket.IO server running on port 4001`*

### 2. Start the Next.js App (Terminal 2)
This runs the frontend application.
```bash
npm run dev
```
*You should see: `Ready in ...` and `Local: http://localhost:3000`*

---

## 📹 How to Use

### 1. Create a Meeting
1. Open [http://localhost:3000](http://localhost:3000) in your browser.
2. Click **"New Meeting"**.
3. You will be redirected to the **Lobby**.

### 2. Join the Room
1. In the Lobby, check your camera and microphone.
2. Enter your **Display Name**.
3. Click **"Join Meeting"**.

### 3. Invite a Peer
1. Copy the **Room ID** (or the full URL) from your browser address bar.
2. Open a **new browser window** (Incognito mode recommended for testing on the same machine).
3. Paste the URL.
4. Enter a **different name**.
5. Click **"Join Meeting"**.

🎉 **Success!** You should see both videos connected.

---

## ✨ Features

### 💬 Chat
- Click the **Message Icon** in the control bar to open the chat panel.
- Messages are sent in real-time to all participants in the room.

### 🖥️ Screen Share
- Click the **Monitor Icon** to share your screen.
- Your camera feed will be replaced by your screen content for other participants.
- Click again (or use the browser's "Stop Sharing" button) to return to camera view.

### 🎤 Controls
- **Microphone**: Mute/Unmute your audio.
- **Camera**: Turn your video on/off.
- **Leave**: Disconnect from the meeting.

---

## 🔧 Troubleshooting

- **"Connecting to room..." stuck?**
  - Ensure `node server.js` is running!
  - Check if port 4001 is blocked.
- **Video not showing?**
  - Ensure you gave browser permissions for Camera/Microphone.
  - Check if another app is using the camera.
