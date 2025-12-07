import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket } from '@/lib/socket';

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  joinRoom: (roomId: string, userId: string, userName: string) => void;
  leaveRoom: (roomId: string, userId: string) => void;
}

export const useSocket = (): UseSocketReturn => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socketInstance = getSocket();
    socketRef.current = socketInstance;

    const onConnect = () => {
      console.log('Socket connected');
      setIsConnected(true);
    };

    const onDisconnect = () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    };

    const onConnectError = (err: Error) => {
      console.error('Socket connection error:', err);
      setIsConnected(false);
    };

    socketInstance.on('connect', onConnect);
    socketInstance.on('disconnect', onDisconnect);
    socketInstance.on('connect_error', onConnectError);

    if (socketInstance.connected) {
      setIsConnected(true);
    } else {
      console.log('Socket disconnected, attempting to connect...');
      socketInstance.connect();
    }

    return () => {
      socketInstance.off('connect', onConnect);
      socketInstance.off('disconnect', onDisconnect);
      socketInstance.off('connect_error', onConnectError);
    };
  }, []);

  const joinRoom = (roomId: string, userId: string, userName: string) => {
    if (socketRef.current) {
      socketRef.current.emit('join-room', { roomId, userId, userName });
    }
  };

  const leaveRoom = (roomId: string, userId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('leave-room', { roomId, userId });
    }
  };

  return {
    socket: socketRef.current,
    isConnected,
    joinRoom,
    leaveRoom
  };
};
