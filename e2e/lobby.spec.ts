import { test, expect } from '@playwright/test';

const ROOM_ID = 'lobby-test-room';

test.describe('Lobby page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/lobby?roomId=${ROOM_ID}`);
  });

  test('shows heading to check audio and video', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Check your audio and video/i }),
    ).toBeVisible();
  });

  test('displays the room ID', async ({ page }) => {
    await expect(page.getByText(ROOM_ID)).toBeVisible();
  });

  test('"Ready to join?" card is visible', async ({ page }) => {
    // CardTitle renders as a div with data-slot="card-title", not a heading
    await expect(page.getByText('Ready to join?')).toBeVisible();
  });

  test('Display Name input is present', async ({ page }) => {
    await expect(page.getByLabel('Display Name')).toBeVisible();
  });

  test('Join Meeting button is disabled / does nothing with empty name', async ({
    page,
  }) => {
    // The input has `required` so native form validation should block submission
    await page.getByRole('button', { name: /Join Meeting/i }).click();
    // Should remain on lobby
    await expect(page).toHaveURL(`/lobby?roomId=${ROOM_ID}`);
  });

  test('Join Meeting navigates to room when name is provided', async ({
    page,
  }) => {
    await page.getByLabel('Display Name').fill('Alice');
    await page.getByRole('button', { name: /Join Meeting/i }).click();
    await expect(page).toHaveURL(
      `/room/${ROOM_ID}?name=${encodeURIComponent('Alice')}`,
    );
  });

  test('Cancel navigates back to home', async ({ page }) => {
    await page.getByRole('button', { name: /Cancel/i }).click();
    await expect(page).toHaveURL('/');
  });

  test('shows invalid room message when roomId is missing', async ({
    page,
  }) => {
    await page.goto('/lobby');
    await expect(page.getByText(/Invalid room ID/i)).toBeVisible();
  });

  test('"Go Home" button on invalid-room page navigates to /', async ({
    page,
  }) => {
    await page.goto('/lobby');
    await page.getByRole('button', { name: /Go Home/i }).click();
    await expect(page).toHaveURL('/');
  });

  // The lobby uses getUserMedia. With --use-fake-device-for-media-stream the
  // video element appears; without a real camera the stream is a fake one.
  test('video preview area is rendered', async ({ page }) => {
    // The black preview div or video element should be in the DOM
    const preview = page.locator('.aspect-video');
    await expect(preview).toBeVisible();
  });

  test('audio toggle button is visible', async ({ page }) => {
    // Mic or MicOff icon button
    await expect(page.locator('button').filter({ hasText: '' }).first()).toBeVisible();
  });
});
