# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e.spec.ts >> Dravio End-to-End Tests >> Backend API Healthcheck returns 200
- Location: tests\e2e.spec.ts:21:7

# Error details

```
Error: apiRequestContext.get: Client network socket disconnected before secure TLS connection was established
Call log:
  - → GET https://api.dravio.com/health
    - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.7827.55 Safari/537.36
    - accept: */*
    - accept-encoding: gzip,deflate,br

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const BUYER_URL = process.env.BUYER_URL || 'https://buyer-web-henna.vercel.app';
  4  | const ADMIN_URL = process.env.ADMIN_URL || 'https://admin-portal-weld-seven.vercel.app';
  5  | const API_URL = process.env.API_URL || 'https://api.dravio.com';
  6  | 
  7  | test.describe('Dravio End-to-End Tests', () => {
  8  | 
  9  |   test('Buyer Portal loads correctly', async ({ page }) => {
  10 |     await page.goto(BUYER_URL);
  11 |     // Add assertions based on your actual buyer portal content
  12 |     // e.g. await expect(page).toHaveTitle(/Dravio/);
  13 |     console.log('✅ Buyer Portal successfully reached.');
  14 |   });
  15 | 
  16 |   test('Admin Portal loads correctly', async ({ page }) => {
  17 |     await page.goto(ADMIN_URL);
  18 |     console.log('✅ Admin Portal successfully reached.');
  19 |   });
  20 | 
  21 |   test('Backend API Healthcheck returns 200', async ({ request }) => {
> 22 |     const response = await request.get(`${API_URL}/health`);
     |                                    ^ Error: apiRequestContext.get: Client network socket disconnected before secure TLS connection was established
  23 |     expect(response.status()).toBe(200);
  24 |     const body = await response.json();
  25 |     console.log('✅ API Healthcheck successful:', body);
  26 |   });
  27 | });
  28 | 
```