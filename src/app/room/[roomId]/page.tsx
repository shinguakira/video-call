'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useMediaStream } from '@/hooks/useMediaStream';
import { useSocket } from '@/hooks/useSocket';
import { useWebRTC } from '@/hooks/useWebRTC';
import { VideoGrid } from '@/components/video/VideoGrid';
import { ControlPanel } from '@/components/video/ControlPanel';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

function RoomContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const roomId = params.roomId as string;
  const userName = searchParams.get('name') || 'Guest';
  const [userId] = useState(() => Math.random().toString(36).substring(2, 15));

  const {
    stream: localStream,
    isAudioEnabled,
    isVideoEnabled,
    toggleAudio,
    toggleVideo,
    isLoading: isMediaLoading,
    isScreenSharing,
    startScreenShare,
    stopScreenShare
  } = useMediaStream();

  const { socket, isConnected } = useSocket();

  const { peers } = useWebRTC({
    roomId,
    userId,
    userName,
    localStream,
    socket,
    isConnected
  });

  const [isChatOpen, setIsChatOpen] = useState(false);

  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const originalLog = console.log;
    console.log = (...args) => {
      setLogs(prev => [...prev.slice(-4), args.map(a => JSON.stringify(a)).join(' ')]);
      originalLog(...args);
    };
    return () => {
      console.log = originalLog;
    };

  }, []);

  const handleLeave = () => {
    if (socket) {
      socket.emit('leave-room', { roomId, userId });
      socket.disconnect();
    }
    router.push('/');
  };

  if (isMediaLoading || !isConnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Connecting to room...</p>
        <div className="text-sm text-muted-foreground font-mono bg-muted p-2 rounded">
          <p>Media Loading: {isMediaLoading ? 'Yes' : 'No'}</p>
          <p>Socket Connected: {isConnected ? 'Yes' : 'No'}</p>
          <p>Socket ID: {socket?.id || 'None'}</p>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 relative flex">
        <div className="flex-1">
          <VideoGrid
            localStream={localStream}
            peers={peers}
            localUserId={userId}
            localUserName={userName}
            isAudioEnabled={isAudioEnabled}
            isVideoEnabled={isVideoEnabled}
          />
        </div>
        
        {isChatOpen && (
          <ChatPanel
            socket={socket}
            roomId={roomId}
            userId={userId}
            userName={userName}
            onClose={() => setIsChatOpen(false)}
          />
        )}

        {/* Visual Debug Overlay */}
        <div className="absolute top-4 left-4 bg-black/80 text-white p-4 rounded-lg text-xs font-mono z-50 pointer-events-none max-w-sm">
          <h3 className="font-bold mb-2 border-b pb-1">Room Debug Info</h3>
          <div className="space-y-1">
            <p><span className="text-muted-foreground">Room ID:</span> {roomId}</p>
            <p><span className="text-muted-foreground">Local User:</span> {userName} ({userId.slice(0, 4)}...)</p>
            <p><span className="text-muted-foreground">Total Participants:</span> {peers.size + 1}</p>
            <div className="mt-2 pt-2 border-t border-white/20">
              <p className="font-semibold mb-1">Remote Peers ({peers.size}):</p>
              {peers.size === 0 ? (
                <p className="text-muted-foreground italic">Waiting for others...</p>
              ) : (
                <ul className="list-disc pl-4 space-y-0.5">
                  {Array.from(peers.values()).map(peer => (
                    <li key={peer.peerId}>
                      {peer.userName} <span className="text-muted-foreground">({peer.peerId.slice(0, 4)}...)</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mt-2 pt-2 border-t border-white/20">
               <p className="font-semibold mb-1">Socket Status:</p>
               <p>Connected: {isConnected ? 'Yes' : 'No'}</p>
               <p>ID: {socket?.id || 'None'}</p>
               <button 
                 onClick={() => {
                   console.log('Force joining room...');
                   socket?.emit('join-room', { roomId, userId, userName });
                 }}
                 className="mt-2 bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-[10px]"
               >
                 Force Join
               </button>
            </div>
          </div>
        </div>
      </main>

      <ControlPanel
        isAudioEnabled={isAudioEnabled}
        isVideoEnabled={isVideoEnabled}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onLeave={handleLeave}
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
        onShareScreen={isScreenSharing ? stopScreenShare : startScreenShare}
      />
    </div>
  );
}

export default function RoomPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>}>
      <RoomContent />
    </Suspense>
  );
}
