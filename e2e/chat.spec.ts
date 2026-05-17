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

  await expect(page.getByText(/Connecting to room/i)).not.toBeVisible({
    timeout: 20_000,
  });

  return { ctx, page };
}

async function openChat(page: Page) {
  await page.getByRole("button", { name: "Toggle chat" }).click();
  await expect(page.getByText("In-call messages")).toBeVisible();
}

async function sendMessage(page: Page, text: string) {
  await page.getByPlaceholder("Type a message...").fill(text);
  await page.getByRole("button", { name: "Send message" }).click();
}

/**
 * The sender-name label rendered inside a chat message bubble.
 * Targets the specific <span class="text-xs font-medium text-muted-foreground">
 * that ChatPanel renders above each bubble — scoped narrowly to avoid matching
 * the video tile name badge or debug overlay.
 */
function senderLabel(page: Page, name: string) {
  return page.locator("span.text-xs.font-medium.text-muted-foreground", {
    hasText: new RegExp(`^${name}$`),
  });
}

test.describe("In-call chat (two browsers)", () => {
  test.setTimeout(90_000);

  test("message sent by A appears in B's chat panel", async ({ browser }) => {
    const roomId = "e2e-chat-basic";
    const { ctx: ctxA, page: pageA } = await joinRoom(browser, roomId, "Alice");
    const { ctx: ctxB, page: pageB } = await joinRoom(browser, roomId, "Bob");

    try {
      await openChat(pageA);
      await openChat(pageB);

      await sendMessage(pageA, "Hello from Alice");

      // Alice sees her own message immediately (optimistic)
      await expect(pageA.getByText("Hello from Alice")).toBeVisible();

      // Bob receives the message via Socket.IO
      await expect(pageB.getByText("Hello from Alice")).toBeVisible({ timeout: 5_000 });
      // Bob sees "Alice" as the sender label, not "You"
      await expect(senderLabel(pageB, "Alice")).toBeVisible({ timeout: 5_000 });
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test("both users can exchange messages back and forth", async ({ browser }) => {
    const roomId = "e2e-chat-exchange";
    const { ctx: ctxA, page: pageA } = await joinRoom(browser, roomId, "Alice");
    const { ctx: ctxB, page: pageB } = await joinRoom(browser, roomId, "Bob");

    try {
      await openChat(pageA);
      await openChat(pageB);

      await sendMessage(pageA, "Hi Bob!");
      await sendMessage(pageB, "Hey Alice!");

      // Both messages visible for Alice
      await expect(pageA.getByText("Hi Bob!")).toBeVisible();
      await expect(pageA.getByText("Hey Alice!")).toBeVisible({ timeout: 5_000 });

      // Both messages visible for Bob
      await expect(pageB.getByText("Hi Bob!")).toBeVisible({ timeout: 5_000 });
      await expect(pageB.getByText("Hey Alice!")).toBeVisible();
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test("sender's own message shows 'You', receiver sees real name", async ({ browser }) => {
    const roomId = "e2e-chat-labels";
    const { ctx: ctxA, page: pageA } = await joinRoom(browser, roomId, "Alice");
    const { ctx: ctxB, page: pageB } = await joinRoom(browser, roomId, "Bob");

    try {
      await openChat(pageA);
      await openChat(pageB);

      await sendMessage(pageA, "Label check");

      // Alice sees "You" as her sender label in the chat bubble
      await expect(senderLabel(pageA, "You")).toBeVisible();

      // Bob sees "Alice" as the sender label
      await expect(pageB.getByText("Label check")).toBeVisible({ timeout: 5_000 });
      await expect(senderLabel(pageB, "Alice")).toBeVisible({ timeout: 5_000 });
      // "You" should NOT appear in Bob's chat (he didn't send anything)
      await expect(senderLabel(pageB, "You")).not.toBeVisible();
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test("messages are not received by users in a different room", async ({ browser }) => {
    const { ctx: ctxA, page: pageA } = await joinRoom(browser, "e2e-chat-room1", "Alice");
    const { ctx: ctxB, page: pageB } = await joinRoom(browser, "e2e-chat-room2", "Bob");

    try {
      await openChat(pageA);
      await openChat(pageB);

      await sendMessage(pageA, "Secret message");

      // Alice sees it
      await expect(pageA.getByText("Secret message")).toBeVisible();
      // Bob in a different room does NOT see it
      await expect(pageB.getByText("Secret message")).not.toBeVisible({ timeout: 3_000 });
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
