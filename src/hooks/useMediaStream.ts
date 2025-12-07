import { useState, useEffect, useRef } from 'react';

interface UseMediaStreamReturn {
  stream: MediaStream | null;
  isLoading: boolean;
  error: Error | null;
  toggleAudio: () => void;
  toggleVideo: () => void;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
}

export const useMediaStream = (): UseMediaStreamReturn => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);

  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const userStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const getStream = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          },
          audio: true
        });

        setStream(mediaStream);
        userStreamRef.current = mediaStream;
        setIsLoading(false);
      } catch (err) {
        console.error('Error accessing media devices:', err);
        setError(err as Error);
        setIsLoading(false);
      }
    };

    getStream();

    // Cleanup on unmount
    return () => {
      if (userStreamRef.current) {
        userStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const toggleAudio = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false // System audio sharing is tricky, skipping for now
      });

      const screenTrack = screenStream.getVideoTracks()[0];

      // Handle user stopping screen share via browser UI
      screenTrack.onended = () => {
        stopScreenShare();
      };

      if (stream && userStreamRef.current) {
        // Replace video track in current stream
        const videoTrack = stream.getVideoTracks()[0];
        stream.removeTrack(videoTrack);
        stream.addTrack(screenTrack);
        
        // Force update
        setStream(new MediaStream(stream.getTracks()));
        setIsScreenSharing(true);
      }
    } catch (err) {
      console.error('Error starting screen share:', err);
    }
  };

  const stopScreenShare = () => {
    if (stream && userStreamRef.current) {
      const screenTrack = stream.getVideoTracks()[0];
      screenTrack.stop(); // Stop screen share

      // Restore camera track
      const cameraTrack = userStreamRef.current.getVideoTracks()[0];
      stream.removeTrack(screenTrack);
      stream.addTrack(cameraTrack);

      // Force update
      setStream(new MediaStream(stream.getTracks()));
      setIsScreenSharing(false);
    }
  };

  return {
    stream,
    isLoading,
    error,
    toggleAudio,
    toggleVideo,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    startScreenShare,
    stopScreenShare
  };
};
