import { test, expect } from '@playwright/test';

test.describe('Deployment Health & Authentication', () => {
  test('Phase 1: Homepage loads successfully', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    // Basic check to see if the page actually renders something
    await expect(page.locator('body')).toBeVisible();
    
    // Check console errors
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('react-devtools') && !msg.text().includes('favicon')) {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    console.log("Console errors detected:", errors);
    expect(errors.length).toBe(0);
  });

  test('Phase 2: Authentication Screens Render', async ({ page }) => {
    // Navigate to Sign Up
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /JOIN DRAVIO/i })).toBeVisible();
    
    // Navigate to Login
    await page.goto('/login');
    // We assume there's a login heading, but if there isn't, we can check for an input
    await expect(page.getByRole('textbox', { name: /email/i }).or(page.locator('input[type="email"]'))).toBeVisible();
  });

  test('Phase 3: Signup Flow Testing (Validation)', async ({ page }) => {
    await page.goto('/register');
    
    // Fill out the form with a password that is too short to bypass HTML5 required and hit our custom validation
    await page.locator('input[type="text"]').first().fill('Test User');
    await page.locator('input[type="email"]').first().fill('test@example.com');
    await page.locator('input[type="password"]').first().fill('short');
    await page.locator('input[type="password"]').nth(1).fill('short');

    await page.getByRole('button', { name: /Create Account/i }).click();
    
    // Expect some validation errors to be visible (e.g. "Password must be at least 8 characters.")
    const validationErrors = page.locator('text=/at least 8 characters|required|invalid|must be/i');
    await expect(validationErrors.first()).toBeVisible();
  });

  test('Phase 4: Login Flow Testing (Invalid Credentials)', async ({ page }) => {
    let apiStatus = 0;
    page.on('response', response => {
      // Only track XHR/Fetch requests to identitytoolkit or auth endpoints
      if ((response.url().includes('identitytoolkit') || response.url().includes('/api/')) && response.request().resourceType() === 'fetch') {
        apiStatus = response.status();
      }
    });

    await page.goto('/login');
    
    // Try to find email input and fill it
    const emailInput = page.getByRole('textbox', { name: /email/i }).or(page.locator('input[type="email"]'));
    const passwordInput = page.getByRole('textbox', { name: /password/i }).or(page.locator('input[type="password"]'));
    
    await emailInput.fill('invalid_e2e_test@dravio.invalid');
    await passwordInput.fill('wrongpassword123');
    // Using a more generic locator for the login button
    await page.locator('button[type="submit"]').click();

    // Expect an error message
    const errorMsg = page.locator('text=/invalid|wrong|error|incorrect|failed/i');
    await expect(errorMsg.first()).toBeVisible();

    if (apiStatus !== 0) {
      expect(apiStatus).toBeGreaterThanOrEqual(400);
      expect(apiStatus).toBeLessThan(500); // 500 would be a server crash
    }
  });
});

