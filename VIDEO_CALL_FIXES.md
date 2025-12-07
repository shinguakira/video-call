# Video Call Fixes Summary

## Problem Statement
The video call application had issues with WebRTC offer/answer exchange and ICE candidate handling, causing connections to fail. The issue referenced two working test files (SignalingOnlyTest.tsx and WebRTCTestPage.tsx) that demonstrate proper WebRTC signaling patterns.

## CRITICAL BUG FIXED: Endpoint Mismatch

**The Major Issue:** The test files tried to connect to a WebSocket server on port 8080 (`ws://localhost:8080/ws/telemedicine`) that didn't exist. Meanwhile, the main application correctly used Socket.IO on port 4001.

**The Fix:** Rewrote `WebRTCSignalingService` to use Socket.IO and connect to port 4001, matching the existing server infrastructure. All components now use the same signaling endpoint.

**Before:**
- Main app → Socket.IO on port 4001 ✓
- Test files → WebSocket on port 8080 ✗ (server doesn't exist)

**After:**
- Main app → Socket.IO on port 4001 ✓
- Test files → Socket.IO on port 4001 ✓

## Root Causes Identified

### 1. Missing WebRTCSignalingService
The test files referenced a `WebRTCSignalingService` class that didn't exist in the codebase. This service provides a clean abstraction for WebSocket-based WebRTC signaling.

### 2. Missing ICE Server Configuration
The SimplePeer instances were created without STUN server configuration, which is needed for NAT traversal and proper ICE candidate gathering.

### 3. Insufficient Logging
There was minimal logging for debugging WebRTC connection issues, making it difficult to diagnose offer/answer exchange problems.

### 4. Potential Race Conditions
- Peer connections could be created before media streams were ready
- No duplicate peer prevention checks
- Socket event handlers could potentially create multiple peer connections for the same user

### 5. Test Files Issues
- Incorrect import paths for WebRTCSignalingService
- Dependency on styled-components which wasn't installed

## Solutions Implemented

### 1. Created WebRTCSignalingService (/src/telemedicine/service/WebRTCSignalingService.ts)
A complete Socket.IO-based signaling service that:
- Connects to the existing Socket.IO server on port 4001 (NOT a separate WebSocket server on port 8080)
- Handles automatic reconnection via Socket.IO
- Provides message routing for offer/answer/ICE candidate exchange
- Supports room-based signaling
- Includes comprehensive error handling and logging

**IMPORTANT:** This service now uses Socket.IO instead of raw WebSocket to avoid endpoint confusion. All test files and the main application use the same signaling server on port 4001.

**Key Features:**
```typescript
- connect(): Connect to Socket.IO server on localhost:4001
- joinRoom(roomId, userId): Join a signaling room
- sendOffer/sendAnswer/sendIceCandidate: Send WebRTC signals via Socket.IO
- onMessage(type, handler): Register message handlers
- Auto-reconnection via Socket.IO built-in reconnection
```

### 2. Added ICE Server Configuration
Updated SimplePeer configuration in useWebRTC.ts to include STUN servers:
```typescript
config: {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
}
```

This ensures proper ICE candidate gathering for connections across different networks.

### 3. Enhanced Logging

#### Client-Side (useWebRTC.ts)
- Log all signal types (offer, answer, ice-candidate)
- Log peer connection state changes (connect, close, error)
- Log stream availability before peer creation
- Log duplicate peer prevention

#### Server-Side (server.js)
- Detailed join room flow with before/after user lists
- Signal relay tracking with from/to user IDs
- Socket ID and room membership information
- Clear visual separators for join events

### 4. Race Condition Fixes

#### Stream Availability Checks
```typescript
if (!streamRef.current) {
  console.error('[CLIENT] Cannot create peer - no local stream available yet');
  return;
}
```

#### Duplicate Peer Prevention
```typescript
if (peersRef.current.has(newUserId)) {
  console.warn('[CLIENT] Peer already exists - skipping duplicate creation');
  return;
}
```

#### Stream Reference Synchronization
```typescript
// Ensure stream is set in ref before joining
streamRef.current = localStream;
socket.emit('join-room', { roomId, userId, userName });
```

### 5. Fixed Test Files
- Updated import paths from `../telemedicine/...` to `./telemedicine/...`
- Replaced styled-components with inline styles
- Maintained all original test functionality

## How WebRTC Connection Works Now

### 1. User A Joins Room
```
1. User A: Connect socket → Join room
2. Server: Room is empty, User A is first
3. User A: Waits for others
```

### 2. User B Joins Room
```
1. User B: Connect socket → Join room
2. Server: Sends 'user-joined' event to User A
3. Server: Sends 'existing-users' list to User B
```

### 3. Peer Connection Establishment
```
User A (Initiator):
- Receives 'user-joined' event
- Creates SimplePeer with initiator=true
- Generates offer automatically
- Sends offer via socket

User B (Non-Initiator):
- Receives 'existing-users' event
- Creates SimplePeer with initiator=false
- Waits for offer
- Receives offer → generates answer
- Sends answer via socket
```

### 4. ICE Candidate Exchange
```
Both Peers:
- Generate ICE candidates as they're discovered
- Send each candidate via socket
- Receive and add remote candidates
- Connection established when valid candidate pair found
```

### 5. Media Stream Exchange
```
Both Peers:
- Remote stream received via 'stream' event
- Video/audio rendered in VideoTile components
- Track replacement handled for screen sharing
```

## Testing the Fixes

### CRITICAL: Endpoint Configuration
**All components now use the same Socket.IO server on port 4001:**
- Main application: `http://localhost:4001` (via `src/lib/socket.ts`)
- Test pages: `http://localhost:4001` (via `WebRTCSignalingService`)
- Server: Runs on port 4001 (via `server.js`)

**No separate WebSocket server needed!** The old reference to port 8080 was a bug and has been fixed.

### Using the Main Application
1. Start the Socket.IO server: `node server.js` (runs on port 4001)
2. Start Next.js dev server: `npm run dev` (runs on port 3000)
3. Open two browser tabs/windows
4. Tab 1: Create/join a room
5. Tab 2: Join the same room
6. Both users should see each other's video/audio

### Using Test Pages
The test pages provide more granular control and debugging:

#### SignalingOnlyTest.tsx
- Tests pure signaling (no media streams)
- Manual offer/answer exchange
- **Now connects to Socket.IO on port 4001** (fixed from port 8080)
- Good for debugging server-side signaling

#### WebRTCTestPage.tsx
- Full WebRTC test with media
- Manual step-by-step connection
- **Now connects to Socket.IO on port 4001** (fixed from port 8080)
- Perfect Negotiation pattern demonstration
- Detailed logging of every step

## Key Files Modified

1. **src/hooks/useWebRTC.ts**
   - Added ICE server configuration
   - Enhanced logging throughout
   - Added duplicate peer prevention
   - Added stream availability checks
   - Better error handling

2. **server.js**
   - Detailed join room logging
   - Signal relay tracking
   - Better debugging output

3. **src/telemedicine/service/WebRTCSignalingService.ts** (NEW)
   - Complete WebSocket signaling service
   - Used by test pages

4. **src/SignalingOnlyTest.tsx**
   - Fixed import paths
   - Ready to use for testing

5. **src/WebRTCTestPage.tsx**
   - Removed styled-components dependency
   - Fixed import paths
   - Converted to inline styles

## Debugging Tips

### Check Server Logs
The server now logs detailed information about:
- Room join operations
- Signal relay operations
- User lists before/after joins

### Check Browser Console
Look for these log patterns:
- `[CLIENT]` - Client-side peer operations
- `[JOIN]` - Join room operations
- `[SIGNAL]` - Signal relay operations
- Connection state changes
- Stream availability checks

### Common Issues and Solutions

#### No Video Connection
1. Check console for "Cannot create peer - no local stream" errors
2. Verify camera/mic permissions granted
3. Check ICE connection state in logs
4. Verify STUN servers are accessible

#### Signals Not Being Received
1. Check server logs for signal relay operations
2. Verify both users are in the same room
3. Check that socket connections are stable
4. Look for "No peer found" errors

#### Duplicate Connections
- Now prevented automatically
- Check logs for "Peer already exists" warnings

## Next Steps for Production

1. **Add TURN Servers** - For connections behind strict firewalls
2. **Handle Network Changes** - ICE restart on network switches
3. **Add Connection Quality Monitoring** - Track packet loss, jitter
4. **Implement Simulcast** - For better quality adaptation
5. **Add Recording** - MediaRecorder API integration
6. **Better Error Recovery** - Automatic reconnection logic

## References

- WebRTC Perfect Negotiation: https://w3c.github.io/webrtc-pc/#perfect-negotiation-example
- SimplePeer Documentation: https://github.com/feross/simple-peer
- Socket.IO Documentation: https://socket.io/docs/
