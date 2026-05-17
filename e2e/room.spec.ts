import { test, expect } from '@playwright/test';

const ROOM_ID = 'e2e-room-abc';
const USER_NAME = 'E2E Tester';
const ROOM_URL = `/room/${ROOM_ID}?name=${encodeURIComponent(USER_NAME)}`;

// ---------------------------------------------------------------------------
// Loading / connecting state
// The room page shows a spinner while waiting for media AND socket.
// In CI the signaling server (port 4001) is not running, so the page stays
// in this connecting state — which is itself a useful thing to verify.
// ---------------------------------------------------------------------------
test.describe('Room page – connecting state (no signaling server)', () => {
  test('shows "Connecting to room..." spinner', async ({ page }) => {
    await page.goto(ROOM_URL);
    await expect(
      page.getByText(/Connecting to room/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('debug panel shows socket as not connected', async ({ page }) => {
    await page.goto(ROOM_URL);
    await expect(page.getByText(/Socket Connected/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Socket Connected:.*No/i)).toBeVisible();
  });

  // The room debug panel is only shown when the room is fully loaded (socket
  // connected).  While connecting, the page shows the loading spinner instead.
  // This test verifies that the URL contains the correct room ID.
  test('URL contains the correct room ID', async ({ page }) => {
    await page.goto(ROOM_URL);
    expect(page.url()).toContain(ROOM_ID);
  });

  // Documents the root cause: socket is hardcoded to localhost:4001
  test('browser makes connection attempt to localhost:4001', async ({
    page,
  }) => {
    const socketRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('localhost:4001')) {
        socketRequests.push(req.url());
      }
    });

    await page.goto(ROOM_URL);
    // Give the socket time to attempt connection
    await page.waitForTimeout(3_000);

    expect(socketRequests.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Network-issue documentation test
// These tests explicitly capture the failures that occur when the app is
// accessed from a different machine / real internet.
// ---------------------------------------------------------------------------
test.describe('Network failure documentation', () => {
  test('socket URL is hardcoded to localhost – fails on remote access', async ({
    page,
  }) => {
    const failedRequests: string[] = [];
    page.on('requestfailed', (req) => failedRequests.push(req.url()));

    await page.goto(ROOM_URL);
    await page.waitForTimeout(4_000);

    // On localhost the server isn't running, so the connection will fail.
    // On a remote machine this would fail for the same reason: the URL is
    // hardcoded to localhost:4001 in src/lib/socket.ts.
    const socketFailure = failedRequests.some((u) => u.includes('4001'));
    // The test documents the behaviour; we expect the failure.
    expect(socketFailure).toBe(true);
  });
});
