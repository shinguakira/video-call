import { useState, useEffect, useRef } from 'react';
import SimplePeer from 'simple-peer';
import { Socket } from 'socket.io-client';

// ICE server configuration for NAT traversal
const ICE_SERVERS_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

interface PeerData {
  peerId: string;
  peer: SimplePeer.Instance;
  stream: MediaStream | null;
  userName: string;
}

interface UseWebRTCProps {
  roomId: string;
  userId: string;
  userName: string;
  localStream: MediaStream | null;
  socket: Socket | null;
  isConnected: boolean;
}

interface UseWebRTCReturn {
  peers: Map<string, PeerData>;
}

export const useWebRTC = ({
  roomId,
  userId,
  userName,
  localStream,
  socket,
  isConnected
}: UseWebRTCProps): UseWebRTCReturn => {
  const [peers, setPeers] = useState<Map<string, PeerData>>(new Map());
  const peersRef = useRef<Map<string, SimplePeer.Instance>>(new Map());
  const streamRef = useRef<MediaStream | null>(localStream);

  // Handle stream updates (Screen Share)
  useEffect(() => {
    if (!localStream || !streamRef.current) {
      streamRef.current = localStream;
      return;
    }

    // Check if video track changed
    const oldVideoTrack = streamRef.current.getVideoTracks()[0];
    const newVideoTrack = localStream.getVideoTracks()[0];

    if (oldVideoTrack && newVideoTrack && oldVideoTrack.id !== newVideoTrack.id) {
      console.log('Replacing video track...');
      peersRef.current.forEach((peer) => {
        // replaceTrack(oldTrack, newTrack, stream)
        peer.replaceTrack(oldVideoTrack, newVideoTrack, streamRef.current!);
      });
    }

    streamRef.current = localStream;
  }, [localStream]);

  // Register event listeners once when socket is available
  useEffect(() => {
    if (!socket) {
      console.log('useWebRTC: No socket, skipping listener registration');
      return;
    }

    console.log('useWebRTC: Registering event listeners');

    // Handle new user joined
    const handleUserJoined = ({ userId: newUserId, userName: newUserName }: {
      userId: string;
      userName: string;
    }) => {
      console.log('[CLIENT] Received user-joined event:', { newUserId, newUserName });
      console.log('[CLIENT] Current peers:', Array.from(peersRef.current.keys()));
      console.log('[CLIENT] Current stream available:', !!streamRef.current);

      if (!streamRef.current) {
        console.error('[CLIENT] Cannot create peer - no local stream available yet');
        console.error('[CLIENT] This is a critical error - user-joined fired before stream was ready');
        return;
      }

      // Check if peer already exists (prevent duplicates)
      if (peersRef.current.has(newUserId)) {
        console.warn('[CLIENT] Peer already exists for', newUserId, '- skipping duplicate creation');
        return;
      }

      // Create peer connection (we are initiator)
      const peer = new SimplePeer({
        initiator: true,
        stream: streamRef.current,
        trickle: true,
        config: ICE_SERVERS_CONFIG
      });

      console.log('[CLIENT] Created peer as INITIATOR for', newUserId);

      // When peer generates signal, send to socket
      peer.on('signal', (signal) => {
        console.log('[CLIENT] Sending signal to', newUserId, 'type:', signal.type);
        socket.emit('signal', {
          targetUserId: newUserId,
          signal
        });
      });

      // When we receive remote stream
      peer.on('stream', (remoteStream) => {
        console.log('[CLIENT] Received remote stream from', newUserId);
        setPeers(prev => {
          const newPeers = new Map(prev);
          newPeers.set(newUserId, {
            peerId: newUserId,
            peer,
            stream: remoteStream,
            userName: newUserName
          });
          console.log('[CLIENT] Updated peers state, now have:', newPeers.size, 'peers');
          return newPeers;
        });
      });

      // Handle connection
      peer.on('connect', () => {
        console.log('[CLIENT] Peer connected successfully with', newUserId);
      });

      // Handle errors
      peer.on('error', (err) => {
        console.error('[CLIENT] Peer error with', newUserId, ':', err);
      });

      // Handle close
      peer.on('close', () => {
        console.log('[CLIENT] Peer connection closed with', newUserId);
      });

      peersRef.current.set(newUserId, peer);
      console.log('[CLIENT] Added peer to peersRef, total:', peersRef.current.size);
    };

    // Handle existing users in room
    const handleExistingUsers = (existingUsers: Array<{ userId: string; userName: string }>) => {
      console.log('[CLIENT] Received existing-users event:', existingUsers);
      console.log('[CLIENT] Will create', existingUsers.length, 'peer connections as NON-INITIATOR');
      console.log('[CLIENT] Current stream available:', !!streamRef.current);
      
      if (!streamRef.current) {
        console.error('[CLIENT] Cannot create peers - no local stream available yet');
        console.error('[CLIENT] This is a critical error - existing-users fired before stream was ready');
        return;
      }

      existingUsers.forEach(({ userId: existingUserId, userName: existingUserName }) => {
        console.log('[CLIENT] Creating peer for existing user:', existingUserId);
        
        // Check if peer already exists (prevent duplicates)
        if (peersRef.current.has(existingUserId)) {
          console.warn('[CLIENT] Peer already exists for existing user', existingUserId, '- skipping');
          return;
        }
        
        // Create peer connection (we are NOT initiator)
        const peer = new SimplePeer({
          initiator: false,
          stream: streamRef.current as MediaStream,
          trickle: true,
          config: ICE_SERVERS_CONFIG
        });

        peer.on('signal', (signal) => {
          console.log('[CLIENT] Sending signal to existing user', existingUserId, 'type:', signal.type);
          socket.emit('signal', {
            targetUserId: existingUserId,
            signal
          });
        });

        peer.on('stream', (remoteStream) => {
          console.log('[CLIENT] Received remote stream from existing user', existingUserId);
          setPeers(prev => {
            const newPeers = new Map(prev);
            newPeers.set(existingUserId, {
              peerId: existingUserId,
              peer,
              stream: remoteStream,
              userName: existingUserName
            });
            console.log('[CLIENT] Updated peers state, now have:', newPeers.size, 'peers');
            return newPeers;
          });
        });

        peer.on('connect', () => {
          console.log('[CLIENT] Peer connected successfully with existing user', existingUserId);
        });

        peer.on('error', (err) => {
          console.error('[CLIENT] Peer error with existing user', existingUserId, ':', err);
        });

        peer.on('close', () => {
          console.log('[CLIENT] Peer connection closed with existing user', existingUserId);
        });

        peersRef.current.set(existingUserId, peer);
      });
      
      console.log('[CLIENT] Finished processing existing users, peersRef has:', peersRef.current.size, 'peers');
    };

    // Handle incoming signal
    const handleSignal = ({ fromUserId, signal }: {
      fromUserId: string;
      signal: any;
    }) => {
      console.log('[CLIENT] Received signal from', fromUserId, 'type:', signal.type);
      const peer = peersRef.current.get(fromUserId);
      if (peer) {
        console.log('[CLIENT] Found peer for', fromUserId, ', passing signal');
        try {
          peer.signal(signal);
        } catch (error) {
          console.error('[CLIENT] Error signaling peer', fromUserId, ':', error);
        }
      } else {
        console.error('[CLIENT] No peer found for', fromUserId, '! Available peers:', Array.from(peersRef.current.keys()));
        console.error('[CLIENT] This might be a race condition - signal arrived before peer was created');
      }
    };

    // Handle user left
    const handleUserLeft = ({ userId: leftUserId }: { userId: string }) => {
      const peer = peersRef.current.get(leftUserId);
      if (peer) {
        peer.destroy();
        peersRef.current.delete(leftUserId);

        setPeers(prev => {
          const newPeers = new Map(prev);
          newPeers.delete(leftUserId);
          return newPeers;
        });
      }
    };

    // Register socket event listeners
    socket.on('user-joined', handleUserJoined);
    socket.on('existing-users', handleExistingUsers);
    socket.on('signal', handleSignal);
    socket.on('user-left', handleUserLeft);

    // Cleanup on unmount
    return () => {
      socket.off('user-joined', handleUserJoined);
      socket.off('existing-users', handleExistingUsers);
      socket.off('signal', handleSignal);
      socket.off('user-left', handleUserLeft);

      // Destroy all peer connections
      peersRef.current.forEach(peer => peer.destroy());
      peersRef.current.clear();

      // Leave room
      socket.emit('leave-room', { roomId, userId });
    };
  }, [socket, roomId, userId]);

  // Separate effect to join room when both socket and stream are ready
  useEffect(() => {
    console.log('useWebRTC join effect triggered', { 
      socketId: socket?.id, 
      isConnected,
      hasStream: !!localStream, 
      roomId, 
      userId 
    });

    if (!socket || !isConnected || !localStream) {
      console.log('useWebRTC: Not ready to join', {
        hasSocket: !!socket,
        isConnected,
        hasStream: !!localStream
      });
      return;
    }

    console.log('useWebRTC: Emitting join-room NOW');
    // Ensure stream is set in ref before joining
    streamRef.current = localStream;
    socket.emit('join-room', { roomId, userId, userName });
  }, [socket, isConnected, localStream, roomId, userId, userName]);

  return { peers };
};
