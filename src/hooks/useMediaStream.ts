import { useState, useEffect, useRef } from "react";

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
  // Saved camera track so stopScreenShare can restore it after screen sharing.
  const savedCameraTrackRef = useRef<MediaStreamTrack | null>(null);

  useEffect(() => {
    const getStream = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
          audio: true,
        });

        setStream(mediaStream);
        userStreamRef.current = mediaStream;
        setIsLoading(false);
      } catch (err) {
        console.error("Error accessing media devices:", err);
        setError(err as Error);
        setIsLoading(false);
      }
    };

    getStream();

    return () => {
      // userStreamRef holds the original camera stream; stop all its tracks.
      // Avoid referencing `stream` state here — the closure captures the value
      // at effect creation time (always null for a [] dep effect).
      userStreamRef.current?.getTracks().forEach((track) => track.stop());
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
        audio: false,
      });

      const screenTrack = screenStream.getVideoTracks()[0];
      screenTrack.onended = () => stopScreenShare();

      if (stream) {
        const cameraTrack = stream.getVideoTracks()[0];
        // Save the camera track BEFORE removing it from the stream so
        // stopScreenShare can restore it. userStreamRef.current is the same
        // object as stream, so we can't rely on it after removeTrack mutates it.
        savedCameraTrackRef.current = cameraTrack;

        stream.removeTrack(cameraTrack);
        stream.addTrack(screenTrack);
        setStream(new MediaStream(stream.getTracks()));
        setIsScreenSharing(true);
      }
    } catch (err) {
      console.error("Error starting screen share:", err);
    }
  };

  const stopScreenShare = () => {
    if (!stream || !savedCameraTrackRef.current) return;

    const screenTrack = stream.getVideoTracks()[0];
    if (screenTrack) {
      screenTrack.stop();
      stream.removeTrack(screenTrack);
    }

    stream.addTrack(savedCameraTrackRef.current);
    savedCameraTrackRef.current = null;
    setStream(new MediaStream(stream.getTracks()));
    setIsScreenSharing(false);
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
    stopScreenShare,
  };
};
