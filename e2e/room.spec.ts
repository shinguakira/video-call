import { test, expect } from "@playwright/test";

const ROOM_ID = "e2e-room-abc";
const USER_NAME = "E2E Tester";
const ROOM_URL = `/room/${ROOM_ID}?name=${encodeURIComponent(USER_NAME)}`;

// ---------------------------------------------------------------------------
// Room page loading / URL
// ---------------------------------------------------------------------------
test.describe("Room page – loading state", () => {
  test('shows "Connecting to room..." spinner on initial load', async ({ page }) => {
    await page.goto(ROOM_URL);
    await expect(page.getByText(/Connecting to room/i)).toBeVisible({ timeout: 10_000 });
  });

  test("URL contains the correct room ID", async ({ page }) => {
    await page.goto(ROOM_URL);
    expect(page.url()).toContain(ROOM_ID);
  });

  test("browser makes connection attempt to localhost:4001", async ({ page }) => {
    const socketRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("localhost:4001")) {
        socketRequests.push(req.url());
      }
    });

    await page.goto(ROOM_URL);
    await page.waitForTimeout(3_000);

    expect(socketRequests.length).toBeGreaterThan(0);
  });

  test("socket connects and room UI loads (spinner disappears)", async ({ page }) => {
    await page.goto(ROOM_URL);
    // Once socket + media are ready the spinner is replaced by the room UI
    await expect(page.getByText(/Connecting to room/i)).not.toBeVisible({ timeout: 20_000 });
    // Control panel should be visible in the connected room view
    await expect(page.getByRole("button", { name: /Leave call/i })).toBeVisible({ timeout: 5_000 });
  });
});
