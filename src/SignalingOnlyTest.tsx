import React, { useEffect, useState } from 'react';
import { WebRTCSignalingService } from './telemedicine/service/WebRTCSignalingService';

/**
 * Signaling-only test - no media streams
 * Tests offer/answer exchange without camera/mic
 */
const SignalingOnlyTest: React.FC = () => {
  const [signalingService] = useState(() => new WebRTCSignalingService());
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [roomId] = useState('test-room-1');
  const [userId] = useState(`user-${Math.random().toString(36).substring(2, 10)}`);
  const [logs, setLogs] = useState<string[]>([]);
  const [remoteUserId, setRemoteUserId] = useState('');

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[SignalingTest] ${message}`);
  };

  useEffect(() => {
    const init = async () => {
      try {
        addLog('Connecting to signaling server...');
        await signalingService.connect(); // Now connects to Socket.IO on port 4001
        addLog('✅ Connected to signaling server');

        // Setup message handlers
        signalingService.onMessage('offer', async (message) => {
          addLog(`📥 Received OFFER from ${message.senderId}`);
          if (!peerConnection) {
            addLog('Creating peer connection to handle offer...');
            const pc = new RTCPeerConnection();
            setPeerConnection(pc);

            await pc.setRemoteDescription(message.data as RTCSessionDescriptionInit);
            addLog('✅ Set remote description (offer)');

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            addLog('✅ Created and set local description (answer)');

            signalingService.sendAnswer(roomId, message.senderId, answer);
            addLog(`📤 Sent ANSWER to ${message.senderId}`);
          }
        });

        signalingService.onMessage('answer', async (message) => {
          addLog(`📥 Received ANSWER from ${message.senderId}`);
          if (peerConnection) {
            await peerConnection.setRemoteDescription(message.data as RTCSessionDescriptionInit);
            addLog('✅ Set remote description (answer)');
            addLog('🎉 SIGNALING COMPLETE - Connection established!');
          }
        });

        signalingService.onMessage('join', (message) => {
          if (message.senderId !== userId) {
            addLog(`👤 User ${message.senderId} joined the room`);
          }
        });

        addLog(`Joining room: ${roomId} as ${userId}`);
        signalingService.joinRoom(roomId, userId);
        addLog('✅ Joined room');
      } catch (error) {
        addLog(`❌ Error: ${error}`);
      }
    };

    init();

    return () => {
      if (peerConnection) {
        peerConnection.close();
      }
      signalingService.disconnect();
    };
  }, []);

  const sendOffer = async () => {
    if (!remoteUserId) {
      addLog('❌ Please enter remote user ID');
      return;
    }

    try {
      addLog('Creating peer connection...');
      const pc = new RTCPeerConnection();
      setPeerConnection(pc);

      addLog('Creating offer...');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      addLog('✅ Created and set local description (offer)');

      addLog(`📤 Sending OFFER to ${remoteUserId}`);
      signalingService.sendOffer(roomId, remoteUserId, offer);
      addLog('✅ Offer sent via signaling');
    } catch (error) {
      addLog(`❌ Error creating offer: ${error}`);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>WebRTC Signaling Test (No Media)</h1>

      <div style={{ marginBottom: '20px', padding: '10px', background: '#f0f0f0' }}>
        <p>
          <strong>Your User ID:</strong> {userId}
        </p>
        <p>
          <strong>Room ID:</strong> {roomId}
        </p>
        <p>
          <strong>Session ID:</strong> {signalingService.getSessionId() || 'Not connected'}
        </p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>Send Offer</h3>
        <input
          type="text"
          placeholder="Enter remote user ID"
          value={remoteUserId}
          onChange={(e) => setRemoteUserId(e.target.value)}
          style={{ padding: '5px', marginRight: '10px', width: '200px' }}
        />
        <button onClick={sendOffer} style={{ padding: '5px 15px' }}>
          Send Offer
        </button>
      </div>

      <div style={{ marginTop: '20px' }}>
        <h3>Logs:</h3>
        <div
          style={{
            background: '#000',
            color: '#0f0',
            padding: '10px',
            height: '400px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '12px',
          }}
        >
          {logs.map((log, index) => (
            <div key={index}>{log}</div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '20px', padding: '10px', background: '#ffffcc' }}>
        <h4>Instructions:</h4>
        <ol>
          <li>Open this page in 2 tabs/browsers</li>
          <li>Copy the "Your User ID" from Tab 2</li>
          <li>Paste it into "Remote user ID" field in Tab 1</li>
          <li>Click "Send Offer" in Tab 1</li>
          <li>Watch logs in both tabs - you should see offer/answer exchange</li>
        </ol>
      </div>
    </div>
  );
};

export default SignalingOnlyTest;
