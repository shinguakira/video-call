import React, { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';

import {
  SignalingMessage,
  WebRTCSignalingService,
} from '../telemedicine/service/WebRTCSignalingService';

const Container = styled.div`
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
`;

const Title = styled.h1`
  color: #333;
  margin-bottom: 1rem;
`;

const VideoContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
`;

const VideoBox = styled.div`
  border: 2px solid #ddd;
  border-radius: 8px;
  padding: 1rem;
  background: #f9f9f9;
`;

const VideoLabel = styled.h3`
  margin: 0 0 0.5rem 0;
  color: #555;
`;

const Video = styled.video`
  width: 100%;
  height: 300px;
  background: #000;
  border-radius: 4px;
`;

const ControlPanel = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
`;

const Button = styled.button<{ variant?: 'primary' | 'danger' }>`
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  background: ${(props) => (props.variant === 'danger' ? '#dc3545' : '#007bff')};
  color: white;

  &:hover {
    opacity: 0.9;
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
`;

const StatusPanel = styled.div`
  background: #f0f0f0;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
`;

const StatusItem = styled.div`
  margin-bottom: 0.5rem;
  font-family: monospace;
`;

const LogPanel = styled.div`
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 1rem;
  border-radius: 4px;
  max-height: 300px;
  overflow-y: auto;
  font-family: monospace;
  font-size: 0.875rem;
`;

const LogEntry = styled.div<{ level: 'info' | 'warn' | 'error' }>`
  margin-bottom: 0.25rem;
  color: ${(props) => {
    switch (props.level) {
      case 'error':
        return '#f48771';
      case 'warn':
        return '#dcdcaa';
      default:
        return '#d4d4d4';
    }
  }};
`;

interface LogMessage {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

const WebRTCTestPage: React.FC = () => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const isSettingRemoteAnswerPendingRef = useRef(false);
  const signalingServiceRef = useRef<WebRTCSignalingService | null>(null);
  const remoteUserIdRef = useRef<string | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isPolite, setIsPolite] = useState(true);
  const [connectionState, setConnectionState] = useState<string>('new');
  const [iceConnectionState, setIceConnectionState] = useState<string>('new');
  const [signalingState, setSignalingState] = useState<string>('stable');
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [roomId, setRoomId] = useState<string>('test-room-1');
  const [userId, setUserId] = useState<string>(`user-${Date.now()}`);
  const [isSignalingConnected, setIsSignalingConnected] = useState(false);
  const [remoteUserId, setRemoteUserId] = useState<string | null>(null);

  const addLog = (level: 'info' | 'warn' | 'error', message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { timestamp, level, message }]);
  };

  // シグナリングサーバーに接続
  const connectSignaling = useCallback(async () => {
    try {
      addLog('info', '🔌 Connecting to signaling server...');
      const service = new WebRTCSignalingService();
      signalingServiceRef.current = service;

      await service.connect('/ws/telemedicine');
      setIsSignalingConnected(true);
      addLog('info', '✅ Connected to signaling server');

      // メッセージハンドラーを設定
      service.onMessage('join', (message: SignalingMessage) => {
        const currentSessionId = service.getSessionId();
        addLog('info', `👤 User joined: ${message.senderId}`);
        addLog('info', `📊 My session ID: ${currentSessionId}, My user ID: ${userId}`);

        if (message.senderId !== currentSessionId && message.senderId !== userId) {
          addLog('info', `🎯 Remote user detected: ${message.senderId}`);
          addLog('info', `📊 Setting remote user ID to: ${message.senderId}`);
          setRemoteUserId(message.senderId);
          remoteUserIdRef.current = message.senderId;

          // 自動的にofferを送信しない - 手動ボタンで制御
          addLog('info', '✅ Remote user ready. Click "Send Offer" to initiate connection.');
        } else {
          addLog('info', `ℹ️ Ignoring own join message`);
        }
      });

      service.onMessage('offer', async (message: SignalingMessage) => {
        addLog('info', `📥 Received offer from: ${message.senderId}`);
        // リモートユーザーIDを設定（まだ設定されていない場合）
        if (!remoteUserIdRef.current) {
          setRemoteUserId(message.senderId);
          remoteUserIdRef.current = message.senderId;
          addLog('info', `🎯 Set remote user from offer: ${message.senderId}`);
        }
        await handleOffer(message.data as RTCSessionDescriptionInit);
      });

      service.onMessage('answer', async (message: SignalingMessage) => {
        addLog('info', `📥 Received answer from: ${message.senderId}`);
        // リモートユーザーIDを設定（まだ設定されていない場合）
        if (!remoteUserIdRef.current) {
          setRemoteUserId(message.senderId);
          remoteUserIdRef.current = message.senderId;
          addLog('info', `🎯 Set remote user from answer: ${message.senderId}`);
        }
        await handleAnswer(message.data as RTCSessionDescriptionInit);
      });

      service.onMessage('ice-candidate', async (message: SignalingMessage) => {
        addLog('info', `🧊 Received ICE candidate from: ${message.senderId}`);
        // リモートユーザーIDを設定（まだ設定されていない場合）
        if (!remoteUserIdRef.current) {
          setRemoteUserId(message.senderId);
          remoteUserIdRef.current = message.senderId;
          addLog('info', `🎯 Set remote user from ICE: ${message.senderId}`);
        }
        await handleIceCandidate(message.data as RTCIceCandidateInit);
      });

      service.onMessage('leave', (message: SignalingMessage) => {
        addLog('info', `👋 User left: ${message.senderId}`);
        setRemoteUserId(null);
        remoteUserIdRef.current = null;
      });
    } catch (error) {
      addLog('error', `❌ Failed to connect to signaling server: ${error}`);
      setIsSignalingConnected(false);
    }
  }, [userId, isPolite]);

  // ルームに参加
  const joinRoom = useCallback(() => {
    const service = signalingServiceRef.current;
    if (!service || !service.isConnected()) {
      addLog('error', '❌ Not connected to signaling server');
      return;
    }

    try {
      addLog('info', `🚪 Joining room: ${roomId} as ${userId}`);
      service.joinRoom(roomId, userId);
      addLog('info', '✅ Joined room successfully');
    } catch (error) {
      addLog('error', `❌ Failed to join room: ${error}`);
    }
  }, [roomId, userId]);

  // ローカルストリーム取得
  const startLocalStream = async () => {
    try {
      addLog('info', 'Requesting local media stream...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      addLog('info', '✅ Local stream started');
    } catch (error) {
      addLog('error', `❌ Failed to get local stream: ${error}`);
    }
  };

  // PeerConnection初期化
  const initializePeerConnection = () => {
    try {
      addLog('info', 'Initializing PeerConnection...');

      const configuration: RTCConfiguration = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      };

      const pc = new RTCPeerConnection(configuration);
      pcRef.current = pc;

      // ローカルストリームのトラックを追加
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          pc.addTrack(track, localStream);
          addLog('info', `Added ${track.kind} track to PeerConnection`);
        });
      }

      // リモートトラック受信
      pc.ontrack = (event) => {
        addLog('info', `📥 Received remote ${event.track.kind} track`);
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // ICE候補
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addLog('info', `🧊 ICE candidate: ${event.candidate.candidate.substring(0, 50)}...`);
          const service = signalingServiceRef.current;
          const targetId = remoteUserIdRef.current;
          if (service && targetId) {
            service.sendIceCandidate(roomId, targetId, event.candidate.toJSON());
            addLog('info', `📤 Sent ICE candidate to: ${targetId}`);
          }
        }
      };

      // 接続状態変化
      pc.onconnectionstatechange = () => {
        setConnectionState(pc.connectionState);
        addLog('info', `Connection state: ${pc.connectionState}`);
      };

      pc.oniceconnectionstatechange = () => {
        setIceConnectionState(pc.iceConnectionState);
        addLog('info', `ICE connection state: ${pc.iceConnectionState}`);
      };

      pc.onsignalingstatechange = () => {
        setSignalingState(pc.signalingState);
        addLog('info', `Signaling state: ${pc.signalingState}`);
      };

      // Perfect Negotiation パターン - 自動ネゴシエーションを無効化
      // テスト用に手動制御にする
      pc.onnegotiationneeded = async () => {
        addLog('info', '🔄 Negotiation needed (auto-negotiation disabled for testing)');
      };

      addLog('info', '✅ PeerConnection initialized');
    } catch (error) {
      addLog('error', `❌ Failed to initialize PeerConnection: ${error}`);
    }
  };

  // Offer受信処理（Perfect Negotiation）
  const handleOffer = async (description: RTCSessionDescriptionInit) => {
    try {
      const pc = pcRef.current;
      if (!pc) {
        addLog('error', '❌ PeerConnection not initialized');
        return;
      }

      addLog('info', `📥 Received offer (current state: ${pc.signalingState})`);
      addLog('info', `📊 Offer SDP: ${description.sdp?.substring(0, 80)}...`);
      addLog('info', `📊 makingOffer: ${makingOfferRef.current}, isPolite: ${isPolite}`);

      const offerCollision =
        description.type === 'offer' && (makingOfferRef.current || pc.signalingState !== 'stable');

      ignoreOfferRef.current = !isPolite && offerCollision;

      if (ignoreOfferRef.current) {
        addLog('warn', '⚠️ Ignoring offer due to collision (impolite)');
        return;
      }

      // Polite側で衝突が発生した場合、既存のofferをロールバック
      if (offerCollision) {
        addLog('warn', '⚠️ Offer collision detected (polite peer rolling back)');
        await Promise.all([
          pc.setLocalDescription({ type: 'rollback' }),
          pc.setRemoteDescription(description),
        ]);
      } else {
        await pc.setRemoteDescription(description);
      }

      addLog('info', '✅ Remote description set (offer)');

      if (description.type === 'offer') {
        await pc.setLocalDescription();
        addLog('info', `📤 Creating and sending answer (type: ${pc.localDescription?.type})`);

        const service = signalingServiceRef.current;
        const targetId = remoteUserIdRef.current;
        if (service && targetId && pc.localDescription) {
          const currentUserId = service.getCurrentUserId();
          addLog('info', `📤 Sending answer from ${currentUserId} to ${targetId}`);
          service.sendAnswer(roomId, targetId, pc.localDescription);
          addLog('info', `✅ Answer sent successfully`);
        } else {
          addLog('error', `❌ Cannot send answer: service=${!!service}, targetId=${targetId}`);
        }
      }
    } catch (error) {
      addLog('error', `❌ Error handling offer: ${error}`);
    } finally {
      makingOfferRef.current = false;
    }
  };

  // Answer受信処理
  const handleAnswer = async (description: RTCSessionDescriptionInit) => {
    try {
      const pc = pcRef.current;
      if (!pc) {
        addLog('error', '❌ PeerConnection not initialized');
        return;
      }

      addLog('info', `📥 Received answer (current state: ${pc.signalingState})`);
      await pc.setRemoteDescription(description);
      addLog('info', '✅ Remote description set (answer)');
      makingOfferRef.current = false; // ネゴシエーション完了
    } catch (error) {
      addLog('error', `❌ Error handling answer: ${error}`);
      makingOfferRef.current = false;
    }
  };

  // ICE候補追加
  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    try {
      const pc = pcRef.current;
      if (!pc) {
        addLog('error', '❌ PeerConnection not initialized');
        return;
      }

      await pc.addIceCandidate(candidate);
      addLog('info', '✅ ICE candidate added');
    } catch (error) {
      if (!ignoreOfferRef.current) {
        addLog('error', `❌ Error adding ICE candidate: ${error}`);
      }
    }
  };

  // クリーンアップ
  const cleanup = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    const service = signalingServiceRef.current;
    if (service && service.isConnected()) {
      if (service.getCurrentRoomId()) {
        service.leaveRoom(roomId);
      }
      service.disconnect();
    }
    signalingServiceRef.current = null;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setConnectionState('closed');
    setIceConnectionState('closed');
    setSignalingState('closed');
    setIsSignalingConnected(false);
    setRemoteUserId(null);
    remoteUserIdRef.current = null;
    addLog('info', '🧹 Cleanup completed');
  }, [localStream, roomId]);

  // 接続を開始（手動トリガー用）
  const initiateConnection = useCallback(
    async (targetId: string) => {
      const pc = pcRef.current;
      if (!pc) {
        addLog('error', '❌ PeerConnection not initialized');
        return;
      }

      if (makingOfferRef.current) {
        addLog('warn', '⚠️ Already making offer, skipping (waiting for answer)');
        addLog('warn', '💡 If stuck, click Cleanup and restart');
        return;
      }

      try {
        addLog('info', `🚀 Initiating connection to: ${targetId} (state: ${pc.signalingState})`);
        makingOfferRef.current = true;

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        addLog('info', `✅ Local description set (type: ${pc.localDescription?.type})`);
        addLog('info', `📊 Offer SDP: ${offer.sdp?.substring(0, 80)}...`);

        const service = signalingServiceRef.current;
        if (service && pc.localDescription) {
          const currentUserId = service.getCurrentUserId();
          addLog('info', `📤 Sending offer from ${currentUserId} to ${targetId}`);
          addLog('info', `📊 Offer details: roomId=${roomId}, targetId=${targetId}`);
          addLog('info', `📊 SDP type: ${pc.localDescription.type}`);

          try {
            service.sendOffer(roomId, targetId, pc.localDescription);
            addLog('info', `✅ Offer sent successfully (check backend logs)`);
          } catch (error) {
            addLog('error', `❌ Failed to send offer: ${error}`);
          }
        } else {
          addLog(
            'error',
            `❌ Cannot send: service=${!!service}, localDesc=${!!pc.localDescription}`
          );
        }
      } catch (error) {
        addLog('error', `❌ Error initiating connection: ${error}`);
        makingOfferRef.current = false;
      }
      // makingOfferRefはanswerを受信するまでtrueのまま
    },
    [roomId]
  );

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  return (
    <Container>
      <Title>WebRTC Perfect Negotiation Test Page</Title>

      <VideoContainer>
        <VideoBox>
          <VideoLabel>Local Video (Polite Peer)</VideoLabel>
          <Video ref={localVideoRef} autoPlay playsInline muted />
        </VideoBox>
        <VideoBox>
          <VideoLabel>Remote Video</VideoLabel>
          <Video ref={remoteVideoRef} autoPlay playsInline />
        </VideoBox>
      </VideoContainer>

      <ControlPanel>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label>Room ID:</label>
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
          />
          <label>User ID:</label>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
          />
          <label>
            <input
              type="checkbox"
              checked={isPolite}
              onChange={(e) => setIsPolite(e.target.checked)}
            />
            Polite
          </label>
        </div>
      </ControlPanel>

      <ControlPanel>
        <Button onClick={connectSignaling} disabled={isSignalingConnected}>
          1. Connect Signaling
        </Button>
        <Button onClick={joinRoom} disabled={!isSignalingConnected}>
          2. Join Room
        </Button>
        <Button onClick={startLocalStream} disabled={!!localStream}>
          3. Start Local Stream
        </Button>
        <Button onClick={initializePeerConnection} disabled={!localStream || !!pcRef.current}>
          4. Initialize PeerConnection
        </Button>
        <Button
          onClick={() => remoteUserId && initiateConnection(remoteUserId)}
          disabled={!pcRef.current || !remoteUserId}
        >
          5. Send Offer (Manual)
        </Button>
        <Button
          onClick={() => {
            const service = signalingServiceRef.current;
            if (service) {
              addLog('info', '🧪 Testing: Sending test message to room topic');
              const testMsg = {
                type: 'join' as const,
                roomId,
                senderId: 'TEST',
                timestamp: new Date().toISOString(),
              };
              // @ts-ignore - テスト用
              service.sendMessage(testMsg);
            }
          }}
          disabled={!isSignalingConnected}
        >
          Test Room Broadcast
        </Button>
        <Button variant="danger" onClick={cleanup}>
          Cleanup
        </Button>
      </ControlPanel>

      <StatusPanel>
        <StatusItem>
          <strong>Role:</strong> {isPolite ? 'Polite' : 'Impolite'}
        </StatusItem>
        <StatusItem>
          <strong>Room ID:</strong> {roomId}
        </StatusItem>
        <StatusItem>
          <strong>User ID:</strong> {userId}
        </StatusItem>
        <StatusItem>
          <strong>Signaling:</strong> {isSignalingConnected ? '✅ Connected' : '❌ Disconnected'}
        </StatusItem>
        <StatusItem>
          <strong>Remote User:</strong> {remoteUserId || '❌ Not detected'}
        </StatusItem>
        <StatusItem>
          <strong>Session ID:</strong>{' '}
          {signalingServiceRef.current?.getSessionId() || '❌ Not connected'}
        </StatusItem>
        <StatusItem>
          <strong>Subscriptions:</strong> Listening on /user/queue/telemedicine/*
        </StatusItem>
        <StatusItem>
          <strong>Connection State:</strong> {connectionState}
        </StatusItem>
        <StatusItem>
          <strong>ICE Connection State:</strong> {iceConnectionState}
        </StatusItem>
        <StatusItem>
          <strong>Signaling State:</strong> {signalingState}
        </StatusItem>
        <StatusItem>
          <strong>Local Stream:</strong> {localStream ? '✅ Active' : '❌ Not started'}
        </StatusItem>
        <StatusItem>
          <strong>PeerConnection:</strong> {pcRef.current ? '✅ Initialized' : '❌ Not initialized'}
        </StatusItem>
      </StatusPanel>

      <LogPanel>
        {logs.map((log, index) => (
          <LogEntry key={index} level={log.level}>
            [{log.timestamp}] {log.message}
          </LogEntry>
        ))}
      </LogPanel>

      <div
        style={{ marginTop: '1rem', padding: '1rem', background: '#d1ecf1', borderRadius: '4px' }}
      >
        <strong>Instructions:</strong>
        <ol style={{ marginTop: '0.5rem', marginBottom: 0 }}>
          <li>Open this page in two different browser tabs/windows</li>
          <li>
            <strong>Tab 1 (Polite):</strong> Room ID: test-room-1, User ID: user-1, Polite: ✅
          </li>
          <li>
            <strong>Tab 2 (Impolite):</strong> Room ID: test-room-1, User ID: user-2, Polite: ❌
          </li>
          <li>
            <strong>Both tabs:</strong> Click buttons 1-4 in order (Connect → Join → Start Stream →
            Initialize)
          </li>
          <li>
            <strong>IMPORTANT:</strong> Only ONE tab should click "Send Offer" (recommend Tab 1)
          </li>
          <li>The other tab will automatically respond with an answer</li>
          <li>
            <strong>Check logs below</strong> to see offer/answer exchange and ICE candidates
          </li>
        </ol>
      </div>

      <div
        style={{
          marginTop: '1rem',
          padding: '1rem',
          background: '#fff3cd',
          borderRadius: '4px',
          fontSize: '0.9rem',
        }}
      >
        <strong>⚠️ Troubleshooting:</strong>
        <ul style={{ marginTop: '0.5rem', marginBottom: 0 }}>
          <li>
            If you see "Already making offer, skipping" - wait for answer or click Cleanup and
            restart
          </li>
          <li>If no offer is received - check that both tabs are in the same room</li>
          <li>If ICE connection fails - check firewall/network settings</li>
        </ul>
      </div>
    </Container>
  );
};

export default WebRTCTestPage;
