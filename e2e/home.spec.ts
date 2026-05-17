import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders header with brand name', async ({ page }) => {
    await expect(page.locator('header').getByText('VideoCall')).toBeVisible();
  });

  test('renders hero headline', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Premium Video Meetings/i }),
    ).toBeVisible();
  });

  test('renders four feature cards', async ({ page }) => {
    await expect(page.getByText('Unlimited Users', { exact: true })).toBeVisible();
    await expect(page.getByText('Secure', { exact: true })).toBeVisible();
    await expect(page.getByText('Fast', { exact: true })).toBeVisible();
    await expect(page.getByText('HD Video', { exact: true })).toBeVisible();
  });

  test('"New Meeting" navigates to /lobby with a generated roomId', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /New Meeting/i }).click();
    await expect(page).toHaveURL(/\/lobby\?roomId=\w+/);
  });

  test('Join form navigates to /lobby with the entered roomId', async ({
    page,
  }) => {
    const roomId = 'my-test-room';
    await page.getByPlaceholder('Enter code or link').fill(roomId);
    await page.getByRole('button', { name: /^Join$/i }).click();
    await expect(page).toHaveURL(`/lobby?roomId=${roomId}`);
  });

  test('Join form does not navigate when room ID is empty', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /^Join$/i }).click();
    await expect(page).toHaveURL('/');
  });

  test('renders footer copyright text', async ({ page }) => {
    await expect(page.getByText(/VideoCall App/)).toBeVisible();
  });
});
