import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';

const { generateDeviceFingerprint, evaluateRiskScore } = await import(
  '../src/modules/auth/security.js'
);

test('device fingerprint is deterministic for identical headers', () => {
  const headers = { 'user-agent': 'UA-v1', 'accept-language': 'en-US' };
  assert.equal(generateDeviceFingerprint(headers), generateDeviceFingerprint({ ...headers }));
});

test('device fingerprint changes when the user agent changes', () => {
  const a = generateDeviceFingerprint({ 'user-agent': 'UA-a', 'accept-language': 'en-US' });
  const b = generateDeviceFingerprint({ 'user-agent': 'UA-b', 'accept-language': 'en-US' });
  assert.notEqual(a, b);
});

test('device fingerprint tolerates missing headers', () => {
  assert.ok(generateDeviceFingerprint({}));
  assert.ok(generateDeviceFingerprint(undefined));
});

test('risk score flags the known abuse IP only', () => {
  assert.equal(evaluateRiskScore('x', '1.2.3.4'), 100);
  assert.equal(evaluateRiskScore('x', '203.0.113.9'), 0);
  assert.equal(evaluateRiskScore('x', ''), 0);
});