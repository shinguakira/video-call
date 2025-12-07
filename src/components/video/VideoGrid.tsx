'use client';

import { VideoTile } from './VideoTile';

interface Peer {
  peerId: string;
  stream: MediaStream | null;
  userName: string;
}

interface VideoGridProps {
  localStream: MediaStream | null;
  peers: Map<string, Peer>;
  localUserId: string;
  localUserName?: string;
  isAudioEnabled?: boolean;
  isVideoEnabled?: boolean;
}

export const VideoGrid = ({
  localStream,
  peers,
  localUserId,
  localUserName = 'You',
  isAudioEnabled = true,
  isVideoEnabled = true
}: VideoGridProps) => {
  const totalParticipants = 1 + peers.size; // Local + remote peers

  // Determine grid layout based on number of participants
  const getGridClass = () => {
    if (totalParticipants === 1) {
      return 'grid-cols-1 grid-rows-1';
    } else if (totalParticipants === 2) {
      return 'grid-cols-2 grid-rows-1';
    } else if (totalParticipants <= 4) {
      return 'grid-cols-2 grid-rows-2';
    } else if (totalParticipants <= 9) {
      return 'grid-cols-3 grid-rows-3';
    } else {
      return 'grid-cols-4 grid-rows-auto';
    }
  };

  const getVideoHeight = () => {
    if (totalParticipants === 1) return 'h-full';
    if (totalParticipants === 2) return 'h-full';
    if (totalParticipants <= 4) return 'h-[50vh]';
    if (totalParticipants <= 9) return 'h-[33vh]';
    return 'h-[25vh]';
  };

  return (
    <div className={`grid ${getGridClass()} gap-2 p-4 w-full h-[calc(100vh-80px)] overflow-auto`}>
      {/* Local video */}
      <div className={getVideoHeight()}>
        <VideoTile
          stream={localStream}
          peerId={localUserId}
          isLocal={true}
          isMuted={!isAudioEnabled}
          isVideoOff={!isVideoEnabled}
          name={localUserName}
        />
      </div>

      {/* Remote peers */}
      {Array.from(peers.values()).map((peer) => (
        <div key={peer.peerId} className={getVideoHeight()}>
          <VideoTile
            stream={peer.stream}
            peerId={peer.peerId}
            isLocal={false}
            name={peer.userName}
          />
        </div>
      ))}
    </div>
  );
};
