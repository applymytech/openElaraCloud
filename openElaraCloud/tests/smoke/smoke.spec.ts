import { test, expect } from '@playwright/test';

test.describe('OpenElara Cloud Smoke Tests', () => {
  test('Landing page loads and shows login form', async ({ page }) => {
    await page.goto('/');
    
    // Check for logo and app name
    const logoText = page.locator('.elara-logo-name');
    await expect(logoText).toBeVisible();
    await expect(logoText).toContainText('OpenElara');

    // Check for login form fields
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Sign In');
  });

  test('Invite-only notice is present', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.invite-notice')).toBeVisible();
    await expect(page.locator('.invite-notice')).toContainText('Invite Only');
  });

  test('Password reset navigation', async ({ page }) => {
    await page.goto('/');
    await page.click('button:has-text("Forgot Password?")');
    
    await expect(page.locator('h2.form-title')).toContainText('Reset Password');
    await expect(page.locator('button:has-text("Send Reset Link")')).toBeVisible();
    
    await page.click('button:has-text("Back to Sign In")');
    await expect(page.locator('button[type="submit"]')).toContainText('Sign In');
  });
});
