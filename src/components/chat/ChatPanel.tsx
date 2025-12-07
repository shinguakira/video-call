'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Send } from 'lucide-react';
import { Socket } from 'socket.io-client';

interface Message {
  userId: string;
  userName: string;
  message: string;
  timestamp: number;
  isLocal: boolean;
}

interface ChatPanelProps {
  socket: Socket | null;
  roomId: string;
  userId: string;
  userName: string;
  onClose: () => void;
}

export const ChatPanel = ({
  socket,
  roomId,
  userId,
  userName,
  onClose
}: ChatPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (msg: { userId: string; userName: string; message: string; timestamp: number }) => {
      setMessages(prev => [...prev, { ...msg, isLocal: msg.userId === userId }]);
    };

    socket.on('chat-message', handleMessage);

    return () => {
      socket.off('chat-message', handleMessage);
    };
  }, [socket, userId]);

  useEffect(() => {
    // Scroll to bottom
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket) return;

    // Send to server
    socket.emit('chat-message', {
      roomId,
      message: newMessage.trim()
    });

    // Add to local list immediately
    setMessages(prev => [...prev, {
      userId,
      userName,
      message: newMessage.trim(),
      timestamp: Date.now(),
      isLocal: true
    }]);

    setNewMessage('');
  };

  return (
    <div className="fixed right-0 top-0 bottom-20 w-80 bg-background border-l shadow-xl flex flex-col z-10">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold">In-call messages</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex flex-col ${msg.isLocal ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {msg.isLocal ? 'You' : msg.userName}
                </span>
                <span className="text-[10px] text-muted-foreground/70">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div
                className={`px-3 py-2 rounded-lg max-w-[85%] text-sm ${
                  msg.isLocal
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                {msg.message}
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <form onSubmit={handleSend} className="p-4 border-t flex gap-2">
        <Input
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={!newMessage.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
};
