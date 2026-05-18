import { test, expect, Browser, BrowserContext, Page } from "@playwright/test";
import path from "path";
import fs from "fs";
import { mockCamera } from "./mock-camera";

const SS_DIR = path.join(__dirname, "..", "test-screenshots", "chat");

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
  const input = page.getByPlaceholder("Type a message...");
  await input.fill(text);
  await expect(page.getByRole("button", { name: "Send message" })).toBeEnabled();
  await page.getByRole("button", { name: "Send message" }).click();
  // Input must be cleared after send
  await expect(input).toHaveValue("");
}

/**
 * Targets the sender-name <span> inside a chat bubble — scoped to avoid
 * matching the video tile badge or debug overlay.
 */
function senderLabel(page: Page, name: string) {
  return page.locator("span.text-xs.font-medium.text-muted-foreground", {
    hasText: new RegExp(`^${name}$`),
  });
}

/** Counts how many chat message bubbles are currently rendered. */
function messageBubbles(page: Page) {
  return page.locator('[data-testid="chat-message"]');
}

test.describe("In-call chat (two browsers)", () => {
  test.setTimeout(90_000);

  test("message sent by A appears in B's chat panel", async ({ browser }, testInfo) => {
    const roomId = "e2e-chat-basic";
    const { ctx: ctxA, page: pageA } = await joinRoom(browser, roomId, "Alice");
    const { ctx: ctxB, page: pageB } = await joinRoom(browser, roomId, "Bob");

    try {
      await openChat(pageA);
      await openChat(pageB);
      await shot(pageA, "01_alice_chat_open", testInfo);
      await shot(pageB, "02_bob_chat_open", testInfo);

      await sendMessage(pageA, "Hello from Alice");

      // Alice sees her own message immediately (optimistic render)
      await expect(pageA.getByText("Hello from Alice")).toBeVisible();
      // Alice's bubble is styled as local (bg-primary class)
      await expect(
        pageA.locator('[data-testid="chat-message"]').filter({ hasText: "Hello from Alice" }).locator(".bg-primary")
      ).toBeVisible();
      // Alice sees "You" label, NOT her own name
      await expect(senderLabel(pageA, "You")).toBeVisible();
      await expect(senderLabel(pageA, "Alice")).not.toBeVisible();
      // Exactly 1 message in Alice's panel
      await expect(messageBubbles(pageA)).toHaveCount(1);
      await shot(pageA, "03_alice_after_send", testInfo);

      // Bob receives the message via Socket.IO
      await expect(pageB.getByText("Hello from Alice")).toBeVisible({ timeout: 5_000 });
      // Bob sees "Alice" label, NOT "You"
      await expect(senderLabel(pageB, "Alice")).toBeVisible({ timeout: 5_000 });
      await expect(senderLabel(pageB, "You")).not.toBeVisible();
      // Bob's bubble is styled as remote (bg-muted class)
      await expect(
        pageB.locator('[data-testid="chat-message"]').filter({ hasText: "Hello from Alice" }).locator(".bg-muted")
      ).toBeVisible();
      // Exactly 1 message in Bob's panel
      await expect(messageBubbles(pageB)).toHaveCount(1);
      await shot(pageB, "04_bob_received_message", testInfo);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test("both users can exchange messages back and forth", async ({ browser }, testInfo) => {
    const roomId = "e2e-chat-exchange";
    const { ctx: ctxA, page: pageA } = await joinRoom(browser, roomId, "Alice");
    const { ctx: ctxB, page: pageB } = await joinRoom(browser, roomId, "Bob");

    try {
      await openChat(pageA);
      await openChat(pageB);

      await sendMessage(pageA, "Hi Bob!");
      await sendMessage(pageB, "Hey Alice!");

      // Alice: 2 messages — own optimistic + received from Bob
      await expect(pageA.getByText("Hi Bob!")).toBeVisible();
      await expect(pageA.getByText("Hey Alice!")).toBeVisible({ timeout: 5_000 });
      await expect(messageBubbles(pageA)).toHaveCount(2);
      // Alice sent "Hi Bob!" → local bubble
      await expect(
        pageA.locator('[data-testid="chat-message"]').filter({ hasText: "Hi Bob!" }).locator(".bg-primary")
      ).toBeVisible();
      // Alice received "Hey Alice!" → remote bubble
      await expect(
        pageA.locator('[data-testid="chat-message"]').filter({ hasText: "Hey Alice!" }).locator(".bg-muted")
      ).toBeVisible();
      await shot(pageA, "01_alice_both_messages", testInfo);

      // Bob: 2 messages — received from Alice + own optimistic
      await expect(pageB.getByText("Hi Bob!")).toBeVisible({ timeout: 5_000 });
      await expect(pageB.getByText("Hey Alice!")).toBeVisible();
      await expect(messageBubbles(pageB)).toHaveCount(2);
      // Bob received "Hi Bob!" → remote bubble
      await expect(
        pageB.locator('[data-testid="chat-message"]').filter({ hasText: "Hi Bob!" }).locator(".bg-muted")
      ).toBeVisible();
      // Bob sent "Hey Alice!" → local bubble
      await expect(
        pageB.locator('[data-testid="chat-message"]').filter({ hasText: "Hey Alice!" }).locator(".bg-primary")
      ).toBeVisible();
      await shot(pageB, "02_bob_both_messages", testInfo);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test("sender's own message shows 'You', receiver sees real name", async ({ browser }, testInfo) => {
    const roomId = "e2e-chat-labels";
    const { ctx: ctxA, page: pageA } = await joinRoom(browser, roomId, "Alice");
    const { ctx: ctxB, page: pageB } = await joinRoom(browser, roomId, "Bob");

    try {
      await openChat(pageA);
      await openChat(pageB);

      await sendMessage(pageA, "Label check");

      // Alice sees "You" as sender label
      await expect(senderLabel(pageA, "You")).toBeVisible();
      await expect(senderLabel(pageA, "Alice")).not.toBeVisible();
      await shot(pageA, "01_alice_you_label", testInfo);

      // Bob sees "Alice" as sender label, never "You"
      await expect(pageB.getByText("Label check")).toBeVisible({ timeout: 5_000 });
      await expect(senderLabel(pageB, "Alice")).toBeVisible({ timeout: 5_000 });
      await expect(senderLabel(pageB, "You")).not.toBeVisible();
      await shot(pageB, "02_bob_alice_label", testInfo);

      // Now Bob sends — he sees "You", Alice sees "Bob"
      await sendMessage(pageB, "Label check back");
      await expect(senderLabel(pageB, "You")).toBeVisible();
      await expect(senderLabel(pageB, "Bob")).not.toBeVisible();
      await shot(pageB, "03_bob_you_label", testInfo);

      await expect(pageA.getByText("Label check back")).toBeVisible({ timeout: 5_000 });
      await expect(senderLabel(pageA, "Bob")).toBeVisible({ timeout: 5_000 });
      await shot(pageA, "04_alice_bob_label", testInfo);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test("messages are not received by users in a different room", async ({ browser }, testInfo) => {
    const { ctx: ctxA, page: pageA } = await joinRoom(browser, "e2e-chat-room1", "Alice");
    const { ctx: ctxB, page: pageB } = await joinRoom(browser, "e2e-chat-room2", "Bob");

    try {
      await openChat(pageA);
      await openChat(pageB);
      await shot(pageA, "01_alice_room1_open", testInfo);
      await shot(pageB, "02_bob_room2_open", testInfo);

      await sendMessage(pageA, "Secret message");

      // Alice sees it, exactly 1 message
      await expect(pageA.getByText("Secret message")).toBeVisible();
      await expect(messageBubbles(pageA)).toHaveCount(1);
      await shot(pageA, "03_alice_sent_secret", testInfo);

      // Bob in a different room: still 0 messages
      await expect(pageB.getByText("Secret message")).not.toBeVisible({ timeout: 3_000 });
      await expect(messageBubbles(pageB)).toHaveCount(0);
      await shot(pageB, "04_bob_no_leak", testInfo);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
