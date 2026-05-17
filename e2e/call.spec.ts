import { test, expect, Browser, BrowserContext, Page } from "@playwright/test";

async function joinRoom(
  browser: Browser,
  roomId: string,
  userName: string,
): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto(`/lobby?roomId=${roomId}`);
  await page.getByLabel("Display Name").fill(userName);
  await page.getByRole("button", { name: /Join Meeting/i }).click();
  await page.waitForURL(`/room/${roomId}?name=${encodeURIComponent(userName)}`);

  return { ctx, page };
}

/** Wait until the loading spinner is gone (socket connected + media ready). */
async function waitForRoomReady(page: Page) {
  await expect(page.getByText(/Connecting to room/i)).not.toBeVisible({
    timeout: 20_000,
  });
}

/**
 * Returns the debug-overlay <li> element for a remote peer by name.
 * The overlay renders `{peer.userName} ({peer.peerId.slice(0,4)}...)`.
 */
function remotePeerEntry(page: Page, name: string) {
  return page.locator("ul li").filter({ hasText: name });
}

test.describe("Two-browser call (localhost, no STUN/TURN)", () => {
  // ICE negotiation + stream arrival can take time; give each test plenty of room.
  test.setTimeout(90_000);

  test("both users connect and see each other's video", async ({ browser }) => {
    const roomId = "e2e-call-connect";
    const { ctx: ctxA, page: pageA } = await joinRoom(browser, roomId, "Alice");
    const { ctx: ctxB, page: pageB } = await joinRoom(browser, roomId, "Bob");

    try {
      await waitForRoomReady(pageA);
      await waitForRoomReady(pageB);

      // Each user should have a remote peer entry in the debug overlay
      await expect(remotePeerEntry(pageA, "Bob")).toBeVisible({ timeout: 30_000 });
      await expect(remotePeerEntry(pageB, "Alice")).toBeVisible({ timeout: 30_000 });

      // Two <video> elements: local (index 0) + remote (index 1)
      await expect(pageA.locator("video").nth(1)).toBeVisible({ timeout: 30_000 });
      await expect(pageB.locator("video").nth(1)).toBeVisible({ timeout: 30_000 });
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test("user B leaving removes them from user A's view", async ({ browser }) => {
    const roomId = "e2e-call-leave";
    const { ctx: ctxA, page: pageA } = await joinRoom(browser, roomId, "Alice");
    const { ctx: ctxB, page: pageB } = await joinRoom(browser, roomId, "Bob");

    try {
      await waitForRoomReady(pageA);
      await waitForRoomReady(pageB);

      // Confirm both are connected
      await expect(remotePeerEntry(pageA, "Bob")).toBeVisible({ timeout: 30_000 });

      // Bob leaves (PhoneOff icon button with aria-label="Leave call")
      await pageB.getByRole("button", { name: "Leave call" }).click();

      // Alice should drop back to 1 participant (remote peer list disappears)
      await expect(remotePeerEntry(pageA, "Bob")).not.toBeVisible({ timeout: 10_000 });
      await expect(pageA.getByText(/Waiting for others/i)).toBeVisible({ timeout: 10_000 });
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
