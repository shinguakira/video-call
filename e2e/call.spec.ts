import { test, expect, Browser, BrowserContext, Page } from "@playwright/test";
import path from "path";
import fs from "fs";
import { mockCamera } from "./mock-camera";

const SS_DIR = path.join(__dirname, "..", "test-screenshots", "call");

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

async function shot(page: Page, label: string, testInfo: Parameters<Parameters<typeof test>[1]>[0]) {
  const buf = await page.screenshot({ fullPage: false });
  const filename = `${testInfo.title.replace(/[^a-z0-9]/gi, "_")}__${label}.png`;
  ensureDir(SS_DIR);
  fs.writeFileSync(path.join(SS_DIR, filename), buf);
  await testInfo.attach(label, { body: buf, contentType: "image/png" });
}

async function joinRoom(
  browser: Browser,
  roomId: string,
  userName: string,
): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext();
  await mockCamera(ctx, userName);
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
  test.setTimeout(90_000);

  test("both users connect and see each other's video", async ({ browser }, testInfo) => {
    const roomId = "e2e-call-connect";
    const { ctx: ctxA, page: pageA } = await joinRoom(browser, roomId, "Alice");
    const { ctx: ctxB, page: pageB } = await joinRoom(browser, roomId, "Bob");

    try {
      await waitForRoomReady(pageA);
      await waitForRoomReady(pageB);
      await shot(pageA, "01_alice_room_ready", testInfo);
      await shot(pageB, "02_bob_room_ready", testInfo);

      // Each user should have a remote peer entry in the debug overlay
      await expect(remotePeerEntry(pageA, "Bob")).toBeVisible({ timeout: 30_000 });
      await expect(remotePeerEntry(pageB, "Alice")).toBeVisible({ timeout: 30_000 });
      // Each user sees exactly 1 remote peer in the overlay
      await expect(pageA.locator("ul li")).toHaveCount(1);
      await expect(pageB.locator("ul li")).toHaveCount(1);
      await shot(pageA, "03_alice_sees_bob_peer", testInfo);
      await shot(pageB, "04_bob_sees_alice_peer", testInfo);

      // Two <video> elements: local (index 0) + remote (index 1)
      await expect(pageA.locator("video").nth(1)).toBeVisible({ timeout: 30_000 });
      await expect(pageB.locator("video").nth(1)).toBeVisible({ timeout: 30_000 });
      // Exactly 2 video elements each (local + remote)
      await expect(pageA.locator("video")).toHaveCount(2);
      await expect(pageB.locator("video")).toHaveCount(2);
      await shot(pageA, "05_alice_two_videos", testInfo);
      await shot(pageB, "06_bob_two_videos", testInfo);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test("user B leaving removes them from user A's view", async ({ browser }, testInfo) => {
    const roomId = "e2e-call-leave";
    const { ctx: ctxA, page: pageA } = await joinRoom(browser, roomId, "Alice");
    const { ctx: ctxB, page: pageB } = await joinRoom(browser, roomId, "Bob");

    try {
      await waitForRoomReady(pageA);
      await waitForRoomReady(pageB);

      // Confirm both are connected
      await expect(remotePeerEntry(pageA, "Bob")).toBeVisible({ timeout: 30_000 });
      await expect(pageA.locator("ul li")).toHaveCount(1);
      await shot(pageA, "01_alice_bob_connected", testInfo);
      await shot(pageB, "02_bob_connected", testInfo);

      // Bob leaves
      await pageB.getByRole("button", { name: "Leave call" }).click();
      await shot(pageB, "03_bob_left_click", testInfo);

      // Alice: peer list is empty, "Waiting for others" appears, only 1 video
      await expect(remotePeerEntry(pageA, "Bob")).not.toBeVisible({ timeout: 10_000 });
      await expect(pageA.locator("ul li")).toHaveCount(0);
      await expect(pageA.getByText(/Waiting for others/i)).toBeVisible({ timeout: 10_000 });
      await expect(pageA.locator("video")).toHaveCount(1);
      await shot(pageA, "04_alice_after_bob_left", testInfo);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
