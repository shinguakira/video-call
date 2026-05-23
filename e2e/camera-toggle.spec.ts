import { test, expect, BrowserContext, Page, TestInfo } from "@playwright/test";
import path from "path";
import fs from "fs";
import { mockCamera } from "./mock-camera";

const SS_DIR = path.join(__dirname, "..", "test-screenshots", "camera-toggle");

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

async function shot(page: Page, label: string, testInfo: TestInfo) {
  const buf = await page.screenshot({ fullPage: false });
  const filename = `${testInfo.title.replace(/[^a-z0-9]/gi, "_")}__${label}.png`;
  ensureDir(SS_DIR);
  fs.writeFileSync(path.join(SS_DIR, filename), buf);
  await testInfo.attach(label, { body: buf, contentType: "image/png" });
}

async function joinRoom(ctx: BrowserContext, roomId: string, userName: string): Promise<Page> {
  const page = await ctx.newPage();
  await page.goto(`/lobby?roomId=${roomId}`);
  await page.getByLabel("Display Name").fill(userName);
  await page.getByRole("button", { name: /Join Meeting/i }).click();
  await page.waitForURL(`/room/${roomId}?name=${encodeURIComponent(userName)}`);
  // Wait until connected
  await expect(page.getByText(/Connecting to room/i)).not.toBeVisible({ timeout: 20_000 });
  return page;
}

test.describe("Camera on/off toggle", () => {
  test.setTimeout(60_000);

  test("video reappears after off→on toggle (no black screen)", async ({ browser }, testInfo) => {
    const ctx = await browser.newContext();
    await mockCamera(ctx, "Alice");

    try {
      const page = await joinRoom(ctx, "e2e-cam-toggle", "Alice");

      // 1. Camera ON — <video> visible, avatar hidden
      const video = page.locator("video").first();
      await expect(video).toBeVisible({ timeout: 10_000 });
      await expect(video).not.toHaveClass(/hidden/);
      await shot(page, "01_camera_on", testInfo);

      // 2. Turn camera OFF
      await page.getByRole("button", { name: "Toggle camera" }).click();
      // Avatar placeholder must appear
      await expect(page.locator('[class*="from-gray-800"]').first()).toBeVisible({
        timeout: 5_000,
      });
      // <video> must be hidden (CSS class), NOT removed from DOM
      await expect(video).toBeHidden();
      await expect(video).toBeAttached(); // still in DOM — srcObject preserved
      await shot(page, "02_camera_off", testInfo);

      // 3. Turn camera back ON
      await page.getByRole("button", { name: "Toggle camera" }).click();
      // <video> must become visible again — not black
      await expect(video).toBeVisible({ timeout: 5_000 });
      await expect(video).not.toHaveClass(/hidden/);
      // Avatar placeholder must be gone
      await expect(page.locator('[class*="from-gray-800"]').first()).toBeHidden();
      await shot(page, "03_camera_back_on", testInfo);

      // 4. Verify srcObject is set (not null) — ensures stream is attached
      const hasSrcObject = await video.evaluate((el) => {
        return (el as HTMLVideoElement).srcObject !== null;
      });
      expect(hasSrcObject).toBe(true);
      await shot(page, "04_srcObject_verified", testInfo);
    } finally {
      await ctx.close();
    }
  });

  test("multiple off→on cycles stay stable", async ({ browser }, testInfo) => {
    const ctx = await browser.newContext();
    await mockCamera(ctx, "Bob");

    try {
      const page = await joinRoom(ctx, "e2e-cam-cycles", "Bob");
      const video = page.locator("video").first();
      const cameraBtn = page.getByRole("button", { name: "Toggle camera" });

      await expect(video).toBeVisible({ timeout: 10_000 });

      // Toggle off→on 3 times
      for (let i = 0; i < 3; i++) {
        await cameraBtn.click(); // off
        await expect(video).toBeHidden({ timeout: 5_000 });
        await cameraBtn.click(); // on
        await expect(video).toBeVisible({ timeout: 5_000 });
      }

      // After 3 cycles, srcObject must still be set
      const hasSrcObject = await video.evaluate((el) => {
        return (el as HTMLVideoElement).srcObject !== null;
      });
      expect(hasSrcObject).toBe(true);
      await shot(page, "01_after_3_cycles", testInfo);
    } finally {
      await ctx.close();
    }
  });
});
