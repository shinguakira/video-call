'use client';

import { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Mic, MicOff, User } from 'lucide-react';

interface VideoTileProps {
  stream: MediaStream | null;
  peerId: string;
  isLocal?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
  name?: string;
}

export const VideoTile = ({
  stream,
  peerId,
  isLocal = false,
  isMuted = false,
  isVideoOff = false,
  name = 'User'
}: VideoTileProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Card className="relative w-full h-full overflow-hidden bg-black">
      {stream && !isVideoOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
          <Avatar className="w-24 h-24">
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
              {initials || <User className="w-12 h-12" />}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      {/* Name badge */}
      <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-md flex items-center gap-2">
        {isMuted ? (
          <MicOff className="w-4 h-4 text-red-500" />
        ) : (
          <Mic className="w-4 h-4 text-green-500" />
        )}
        <span className="text-white text-sm font-medium">
          {name} {isLocal && '(You)'}
        </span>
      </div>
    </Card>
  );
};
