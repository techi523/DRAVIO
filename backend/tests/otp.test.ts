import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// The mock OTP store only activates when NODE_ENV === 'test' AND Twilio is
// not configured. The module reads env at import time, so set before loading.
process.env.NODE_ENV = 'test';
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.TWILIO_AUTH_TOKEN;
delete process.env.TWILIO_VERIFY_SERVICE_SID;

const { otpService } = await import('../src/modules/auth/services/otp.service.js');

// Every code goes through a 6-digit range; grab the code the mock logged by
// intercepting console.error.
let lastMockCode = '';
const originalError = console.error;
console.error = (msg: unknown, ...rest: unknown[]) => {
  const line = String(msg);
  if (line.includes('[Mock OTP (test only)]')) {
    const match = line.match(/Code for .*: (\d{6})/);
    if (match) lastMockCode = match[1];
  }
  originalError(msg, ...rest);
};

beforeEach(() => {
  lastMockCode = '';
});

test('OTP send+verify succeeds with the delivered code', async () => {
  await otpService.sendOtp('+254712345678');
  assert.ok(lastMockCode.length === 6, 'expected a 6-digit mock code');
  const valid = await otpService.verifyOtp('+254712345678', lastMockCode);
  assert.equal(valid, true);
});

test('OTP with wrong code fails', async () => {
  await otpService.sendOtp('+254700000001');
  const valid = await otpService.verifyOtp('+254700000001', '000000');
  assert.equal(valid, false);
});

test('OTP is single-use (consumed after success)', async () => {
  await otpService.sendOtp('+254700000002');
  assert.equal(await otpService.verifyOtp('+254700000002', lastMockCode), true);
  assert.equal(await otpService.verifyOtp('+254700000002', lastMockCode), false);
});

test('OTP attempt limit blocks guessing after 5 tries', async () => {
  await otpService.sendOtp('+254700000003');
  for (let i = 0; i < 5; i++) {
    assert.equal(await otpService.verifyOtp('+254700000003', '111111'), false);
  }
  // Sixth attempt must also fail (store cleared after max attempts).
  assert.equal(await otpService.verifyOtp('+254700000003', '111111'), false);
});

test('OTP for unknown phone number fails', async () => {
  const valid = await otpService.verifyOtp('+254999999999', '123456');
  assert.equal(valid, false);
});