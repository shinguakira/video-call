/**
 * WebRTC Signaling Service
 * Handles WebSocket communication for WebRTC offer/answer/ICE candidate exchange
 */

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
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private currentUserId: string | null = null;
  private currentRoomId: string | null = null;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  /**
   * Connect to WebSocket signaling server
   */
  async connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Use relative URL if provided without protocol
        const wsUrl = url.startsWith('ws://') || url.startsWith('wss://') 
          ? url 
          : `ws://${window.location.hostname}:8080${url}`;
        
        console.log('[SignalingService] Connecting to:', wsUrl);
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('[SignalingService] WebSocket connected');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as SignalingMessage;
            console.log('[SignalingService] Received message:', message.type, message);
            this.handleMessage(message);
          } catch (error) {
            console.error('[SignalingService] Failed to parse message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[SignalingService] WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('[SignalingService] WebSocket closed');
          this.handleReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle automatic reconnection
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`[SignalingService] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      
      setTimeout(() => {
        if (this.ws?.readyState === WebSocket.CLOSED) {
          // Reconnect logic would go here
          console.log('[SignalingService] Reconnect attempted');
        }
      }, delay);
    }
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
    this.messageHandlers.get(type)!.push(handler);
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
   * Join a room
   */
  joinRoom(roomId: string, userId: string): void {
    this.currentRoomId = roomId;
    this.currentUserId = userId;
    this.sessionId = userId; // Use userId as sessionId for simplicity
    
    const message: SignalingMessage = {
      type: 'join',
      roomId,
      senderId: userId,
      timestamp: new Date().toISOString(),
    };
    
    this.sendMessage(message);
    console.log('[SignalingService] Joined room:', roomId, 'as', userId);
  }

  /**
   * Leave a room
   */
  leaveRoom(roomId: string): void {
    if (!this.currentUserId) return;

    const message: SignalingMessage = {
      type: 'leave',
      roomId,
      senderId: this.currentUserId,
      timestamp: new Date().toISOString(),
    };
    
    this.sendMessage(message);
    this.currentRoomId = null;
    console.log('[SignalingService] Left room:', roomId);
  }

  /**
   * Send an offer to a specific peer
   */
  sendOffer(roomId: string, targetId: string, offer: RTCSessionDescriptionInit): void {
    const message: SignalingMessage = {
      type: 'offer',
      roomId,
      senderId: this.currentUserId!,
      targetId,
      data: offer,
      timestamp: new Date().toISOString(),
    };
    
    this.sendMessage(message);
    console.log('[SignalingService] Sent offer to:', targetId);
  }

  /**
   * Send an answer to a specific peer
   */
  sendAnswer(roomId: string, targetId: string, answer: RTCSessionDescriptionInit): void {
    const message: SignalingMessage = {
      type: 'answer',
      roomId,
      senderId: this.currentUserId!,
      targetId,
      data: answer,
      timestamp: new Date().toISOString(),
    };
    
    this.sendMessage(message);
    console.log('[SignalingService] Sent answer to:', targetId);
  }

  /**
   * Send an ICE candidate to a specific peer
   */
  sendIceCandidate(roomId: string, targetId: string, candidate: RTCIceCandidateInit): void {
    const message: SignalingMessage = {
      type: 'ice-candidate',
      roomId,
      senderId: this.currentUserId!,
      targetId,
      data: candidate,
      timestamp: new Date().toISOString(),
    };
    
    this.sendMessage(message);
    console.log('[SignalingService] Sent ICE candidate to:', targetId);
  }

  /**
   * Send a message through WebSocket
   */
  sendMessage(message: SignalingMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('[SignalingService] WebSocket not connected, cannot send message');
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
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
   * Disconnect from signaling server
   */
  disconnect(): void {
    if (this.currentRoomId && this.currentUserId) {
      this.leaveRoom(this.currentRoomId);
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.sessionId = null;
    this.currentUserId = null;
    this.currentRoomId = null;
    this.messageHandlers.clear();
    console.log('[SignalingService] Disconnected');
  }
}
