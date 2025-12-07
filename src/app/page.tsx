'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Video, Users, Shield, Zap } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [roomId, setRoomId] = useState('');

  const createMeeting = () => {
    const newRoomId = Math.random().toString(36).substring(2, 15);
    router.push(`/lobby?roomId=${newRoomId}`);
  };

  const joinMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim()) {
      router.push(`/lobby?roomId=${roomId}`);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Video className="w-6 h-6 text-primary" />
            <span className="text-xl font-bold">VideoCall</span>
          </div>
          <nav className="flex gap-4">
            <Button variant="ghost">Features</Button>
            <Button variant="ghost">About</Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 container mx-auto px-4 py-16 flex flex-col lg:flex-row items-center gap-12">
        <div className="flex-1 space-y-8">
          <h1 className="text-5xl font-bold tracking-tight lg:text-6xl">
            Premium Video Meetings for Everyone
          </h1>
          <p className="text-xl text-muted-foreground">
            Connect, collaborate, and celebrate from anywhere with secure, high-quality video calls.
            No sign-up required for basic use.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <Button size="lg" className="text-lg px-8 py-6" onClick={createMeeting}>
              <Video className="mr-2 w-5 h-5" />
              New Meeting
            </Button>
            
            <form onSubmit={joinMeeting} className="flex gap-2">
              <Input 
                placeholder="Enter code or link" 
                className="h-auto text-lg px-4"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
              />
              <Button type="submit" variant="secondary" size="lg" className="text-lg px-6 py-6">
                Join
              </Button>
            </form>
          </div>
          
          <div className="pt-8 border-t">
            <p className="text-sm text-muted-foreground mb-4">Trusted by developers worldwide</p>
            <div className="flex gap-8 opacity-50 grayscale">
              {/* Placeholders for logos */}
              <div className="font-bold text-xl">ACME Corp</div>
              <div className="font-bold text-xl">GlobalTech</div>
              <div className="font-bold text-xl">Nebula</div>
            </div>
          </div>
        </div>

        <div className="flex-1 w-full max-w-md lg:max-w-full">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <Users className="w-8 h-8 text-blue-500 mb-2" />
                <CardTitle>Unlimited Users</CardTitle>
                <CardDescription>Connect with large groups seamlessly.</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Shield className="w-8 h-8 text-green-500 mb-2" />
                <CardTitle>Secure</CardTitle>
                <CardDescription>End-to-end encryption for privacy.</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Zap className="w-8 h-8 text-yellow-500 mb-2" />
                <CardTitle>Fast</CardTitle>
                <CardDescription>Low latency P2P connection.</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Video className="w-8 h-8 text-purple-500 mb-2" />
                <CardTitle>HD Video</CardTitle>
                <CardDescription>Crystal clear video quality.</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 bg-muted/30">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2024 VideoCall App. Built with Next.js and WebRTC.</p>
        </div>
      </footer>
    </div>
  );
}
