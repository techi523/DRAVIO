import { test, expect } from '@playwright/test';

const BUYER_URL = process.env.BUYER_URL || 'https://buyer-web-henna.vercel.app';
const ADMIN_URL = process.env.ADMIN_URL || 'https://admin-portal-weld-seven.vercel.app';
const API_URL = process.env.API_URL || 'https://api.dravio.com';

test.describe('Dravio End-to-End Tests', () => {

  test('Buyer Portal loads correctly', async ({ page }) => {
    await page.goto(BUYER_URL);
    // Add assertions based on your actual buyer portal content
    // e.g. await expect(page).toHaveTitle(/Dravio/);
    console.log('✅ Buyer Portal successfully reached.');
  });

  test('Admin Portal loads correctly', async ({ page }) => {
    await page.goto(ADMIN_URL);
    console.log('✅ Admin Portal successfully reached.');
  });

  test('Backend API Healthcheck returns 200', async ({ request }) => {
    const response = await request.get(`${API_URL}/health`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    console.log('✅ API Healthcheck successful:', body);
  });
});
