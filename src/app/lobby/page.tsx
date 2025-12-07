'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { useMediaStream } from '@/hooks/useMediaStream';

function LobbyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId');
  
  const [name, setName] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const { 
    stream, 
    toggleAudio, 
    toggleVideo, 
    isAudioEnabled, 
    isVideoEnabled 
  } = useMediaStream();

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    // Load saved name
    const savedName = localStorage.getItem('userName');
    if (savedName) setName(savedName);
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !roomId) return;

    // Save name for next time
    localStorage.setItem('userName', name);
    
    // Navigate to room
    router.push(`/room/${roomId}?name=${encodeURIComponent(name)}`);
  };

  if (!roomId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="pt-6">
            <p>Invalid room ID. Please return home.</p>
            <Button onClick={() => router.push('/')} className="mt-4 w-full">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="grid md:grid-cols-2 gap-8 w-full max-w-4xl">
        {/* Preview Section */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Check your audio and video</h2>
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden shadow-xl">
            {stream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${!isVideoEnabled ? 'hidden' : ''}`}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white">
                Loading camera...
              </div>
            )}
            
            {!isVideoEnabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
                Camera is off
              </div>
            )}

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4">
              <Button
                variant={isAudioEnabled ? 'secondary' : 'destructive'}
                size="icon"
                className="rounded-full"
                onClick={toggleAudio}
              >
                {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </Button>
              <Button
                variant={isVideoEnabled ? 'secondary' : 'destructive'}
                size="icon"
                className="rounded-full"
                onClick={toggleVideo}
              >
                {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Join Form */}
        <div className="flex items-center">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Ready to join?</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleJoin} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Display Name</Label>
                  <Input
                    id="name"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Room ID</Label>
                  <div className="p-3 bg-muted rounded-md font-mono text-sm">
                    {roomId}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => router.push('/')}>
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1">
                    Join Meeting
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function LobbyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <LobbyContent />
    </Suspense>
  );
}
