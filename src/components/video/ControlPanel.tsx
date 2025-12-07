'use client';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare, Monitor } from 'lucide-react';

interface ControlPanelProps {
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onLeave: () => void;
  onToggleChat?: () => void;
  onShareScreen?: () => void;
}

export const ControlPanel = ({
  isAudioEnabled,
  isVideoEnabled,
  onToggleAudio,
  onToggleVideo,
  onLeave,
  onToggleChat,
  onShareScreen
}: ControlPanelProps) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-20 bg-background/95 backdrop-blur-sm border-t flex items-center justify-center gap-4 px-8">
      <TooltipProvider>
        {/* Microphone */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isAudioEnabled ? 'default' : 'destructive'}
              size="icon"
              className="w-12 h-12 rounded-full"
              onClick={onToggleAudio}
            >
              {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isAudioEnabled ? 'Mute' : 'Unmute'}</p>
          </TooltipContent>
        </Tooltip>

        {/* Camera */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isVideoEnabled ? 'default' : 'destructive'}
              size="icon"
              className="w-12 h-12 rounded-full"
              onClick={onToggleVideo}
            >
              {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}</p>
          </TooltipContent>
        </Tooltip>

        {/* Screen Share */}
        {onShareScreen && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="w-12 h-12 rounded-full"
                onClick={onShareScreen}
              >
                <Monitor className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Share screen</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Chat */}
        {onToggleChat && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="w-12 h-12 rounded-full"
                onClick={onToggleChat}
              >
                <MessageSquare className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Toggle chat</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Leave Call */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="destructive"
              size="icon"
              className="w-12 h-12 rounded-full"
              onClick={onLeave}
            >
              <PhoneOff className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Leave call</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};
