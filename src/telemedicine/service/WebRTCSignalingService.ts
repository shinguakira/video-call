/**
 * WebRTC Signaling Service
 * Handles Socket.IO communication for WebRTC offer/answer/ICE candidate exchange
 * Now uses the existing Socket.IO server on port 4001 instead of a separate WebSocket server
 */

import { io, Socket } from 'socket.io-client';

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave';
  roomId?: string;
  senderId: string;
  targetId?: string;
  data?: any;
  timestamp: string;
}

type MessageHandler = (message: SignalingMessage) => void;

export class WebRTCSignalingService {
  private socket: Socket | null = null;
  private sessionId: string | null = null;
  private currentUserId: string | null = null;
  private currentRoomId: string | null = null;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();

  /**
   * Connect to Socket.IO signaling server
   * @param url - Ignored parameter for backward compatibility. Always connects to localhost:4001
   */
  async connect(url?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Always connect to the Socket.IO server on port 4001
        const socketUrl = 'http://localhost:4001';
        console.log('[SignalingService] Connecting to Socket.IO server:', socketUrl);
        
        this.socket = io(socketUrl, {
          autoConnect: true,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        });

        this.socket.on('connect', () => {
          console.log('[SignalingService] Socket.IO connected, socket ID:', this.socket?.id);
          this.sessionId = this.socket?.id || null;
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('[SignalingService] Socket.IO connection error:', error);
          reject(error);
        });

        this.socket.on('disconnect', (reason) => {
          console.log('[SignalingService] Socket.IO disconnected:', reason);
        });

        // Setup listeners for WebRTC signaling messages
        this.setupSignalingListeners();

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Setup Socket.IO listeners for WebRTC signaling
   */
  private setupSignalingListeners(): void {
    if (!this.socket) return;

    // Listen for user-joined event (when another user joins)
    this.socket.on('user-joined', ({ userId, userName }: { userId: string; userName: string }) => {
      console.log('[SignalingService] User joined:', userId);
      const message: SignalingMessage = {
        type: 'join',
        senderId: userId,
        roomId: this.currentRoomId || undefined,
        timestamp: new Date().toISOString(),
      };
      this.handleMessage(message);
    });

    // Listen for existing-users event
    this.socket.on('existing-users', (users: Array<{ userId: string; userName: string }>) => {
      console.log('[SignalingService] Received existing users:', users);
      users.forEach(({ userId }) => {
        const message: SignalingMessage = {
          type: 'join',
          senderId: userId,
          roomId: this.currentRoomId || undefined,
          timestamp: new Date().toISOString(),
        };
        this.handleMessage(message);
      });
    });

    // Listen for signals (offer/answer/ICE)
    this.socket.on('signal', ({ fromUserId, signal }: { fromUserId: string; signal: any }) => {
      console.log('[SignalingService] Received signal from:', fromUserId, 'type:', signal.type);
      
      // Determine message type based on signal content
      let messageType: 'offer' | 'answer' | 'ice-candidate' = 'offer';
      let messageData = signal;
      
      if (signal.type === 'offer') {
        messageType = 'offer';
        messageData = signal;
      } else if (signal.type === 'answer') {
        messageType = 'answer';
        messageData = signal;
      } else if (signal.candidate) {
        messageType = 'ice-candidate';
        messageData = signal;
      }

      const message: SignalingMessage = {
        type: messageType,
        senderId: fromUserId,
        targetId: this.currentUserId || undefined,
        data: messageData,
        roomId: this.currentRoomId || undefined,
        timestamp: new Date().toISOString(),
      };
      this.handleMessage(message);
    });

    // Listen for user-left event
    this.socket.on('user-left', ({ userId }: { userId: string }) => {
      console.log('[SignalingService] User left:', userId);
      const message: SignalingMessage = {
        type: 'leave',
        senderId: userId,
        roomId: this.currentRoomId || undefined,
        timestamp: new Date().toISOString(),
      };
      this.handleMessage(message);
    });
  }

  /**
   * Handle incoming messages and route to appropriate handlers
   */
  private handleMessage(message: SignalingMessage): void {
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => handler(message));
    }
  }

  /**
   * Register a message handler for a specific message type
   */
  onMessage(type: string, handler: MessageHandler): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type).push(handler);
  }

  /**
   * Remove a message handler
   */
  offMessage(type: string, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Join a room via Socket.IO
   */
  joinRoom(roomId: string, userId: string): void {
    if (!this.socket) {
      console.error('[SignalingService] Cannot join room - not connected');
      return;
    }

    this.currentRoomId = roomId;
    this.currentUserId = userId;
    
    // Emit join-room event to Socket.IO server
    this.socket.emit('join-room', { roomId, userId, userName: userId });
    console.log('[SignalingService] Emitted join-room:', roomId, 'as', userId);
  }

  /**
   * Leave a room via Socket.IO
   */
  leaveRoom(roomId: string): void {
    if (!this.socket || !this.currentUserId) {
      console.error('[SignalingService] Cannot leave room - not connected or no user ID');
      return;
    }

    this.socket.emit('leave-room', { roomId, userId: this.currentUserId });
    this.currentRoomId = null;
    console.log('[SignalingService] Left room:', roomId);
  }

  /**
   * Send an offer to a specific peer via Socket.IO
   */
  sendOffer(roomId: string, targetId: string, offer: RTCSessionDescriptionInit): void {
    if (!this.socket || !this.currentUserId) {
      console.error('[SignalingService] Cannot send offer - not connected or not authenticated');
      return;
    }

    // Emit signal event with offer
    this.socket.emit('signal', {
      targetUserId: targetId,
      signal: offer
    });
    console.log('[SignalingService] Sent offer to:', targetId);
  }

  /**
   * Send an answer to a specific peer via Socket.IO
   */
  sendAnswer(roomId: string, targetId: string, answer: RTCSessionDescriptionInit): void {
    if (!this.socket || !this.currentUserId) {
      console.error('[SignalingService] Cannot send answer - not connected or not authenticated');
      return;
    }

    // Emit signal event with answer
    this.socket.emit('signal', {
      targetUserId: targetId,
      signal: answer
    });
    console.log('[SignalingService] Sent answer to:', targetId);
  }

  /**
   * Send an ICE candidate to a specific peer via Socket.IO
   */
  sendIceCandidate(roomId: string, targetId: string, candidate: RTCIceCandidateInit): void {
    if (!this.socket || !this.currentUserId) {
      console.error('[SignalingService] Cannot send ICE candidate - not connected or not authenticated');
      return;
    }

    // Emit signal event with ICE candidate
    this.socket.emit('signal', {
      targetUserId: targetId,
      signal: candidate
    });
    console.log('[SignalingService] Sent ICE candidate to:', targetId);
  }

  /**
   * Send a message through Socket.IO (for compatibility)
   */
  sendMessage(message: SignalingMessage): void {
    if (!this.socket) {
      console.error('[SignalingService] Socket.IO not connected, cannot send message');
      return;
    }

    // Map message types to Socket.IO events
    if (message.type === 'join') {
      this.socket.emit('join-room', {
        roomId: message.roomId,
        userId: message.senderId,
        userName: message.senderId
      });
    } else if (message.type === 'leave') {
      this.socket.emit('leave-room', {
        roomId: message.roomId,
        userId: message.senderId
      });
    } else {
      // For offer/answer/ICE, use signal event
      this.socket.emit('signal', {
        targetUserId: message.targetId,
        signal: message.data
      });
    }
  }

  /**
   * Check if connected to Socket.IO server
   */
  isConnected(): boolean {
    return this.socket !== null && this.socket.connected;
  }

  /**
   * Get session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Get current user ID
   */
  getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  /**
   * Get current room ID
   */
  getCurrentRoomId(): string | null {
    return this.currentRoomId;
  }

  /**
   * Disconnect from Socket.IO signaling server
   */
  disconnect(): void {
    if (this.currentRoomId && this.currentUserId) {
      this.leaveRoom(this.currentRoomId);
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.sessionId = null;
    this.currentUserId = null;
    this.currentRoomId = null;
    this.messageHandlers.clear();
    console.log('[SignalingService] Disconnected');
  }
}
