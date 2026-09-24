import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';

const { buildVpnConfigFromSeller, canAccessSession, isAdminUser } = await import(
  '../src/modules/session/access.js'
);
const { validateSessionStart, MIN_SESSION_BALANCE_USD } = await import(
  '../src/modules/billing/core/session-gate.js'
);

test('buildVpnConfigFromSeller fails closed when seller has no live relay endpoint', () => {
  assert.throws(
    () => buildVpnConfigFromSeller({ relay_endpoint: null, relay_public_key: 'abc' }),
    (err: any) => err.message === 'SELLER_RELAY_NOT_REGISTERED' && err.statusCode === 409,
  );
});

test('buildVpnConfigFromSeller fails closed when seller has no relay public key', () => {
  assert.throws(
    () => buildVpnConfigFromSeller({ relay_endpoint: 'wg.example.com:51820', relay_public_key: null }),
    (err: any) => err.message === 'SELLER_RELAY_NOT_REGISTERED' && err.statusCode === 409,
  );
});

test('buildVpnConfigFromSeller emits the seller real relay config, never an invented relay', () => {
  const cfg = buildVpnConfigFromSeller({
    relay_endpoint: 'wg.dravio.example:51820',
    relay_public_key: 'REALSELLERKEY0123456789abcdef',
  });
  assert.match(cfg, /10\.42\.\d{1,3}\.5\/32/);
  assert.match(cfg, /Endpoint = wg\.dravio\.example:51820/);
  assert.match(cfg, /REALSELLERKEY0123456789abcdef/);
  assert.match(cfg, /PrivateKey = \[CLIENT-KEY-GENERATED-ON-DEVICE\]/);
  assert.match(cfg, /AllowedIPs = 0\.0\.0\.0\/0/);
});

test('session ownership: owner may act, other users are rejected (403 IDOR surface)', () => {
  const session = { buyer_id: 'buyer-1' };
  assert.equal(canAccessSession(session, 'buyer-1', undefined), true);
  assert.equal(canAccessSession(session, 'buyer-2', undefined), false);
  assert.equal(canAccessSession(session, 'buyer-2', ['BUYER']), false);
});

test('only ADMIN/SUPER_ADMIN roles may act on another user session', () => {
  const session = { buyer_id: 'buyer-1' };
  assert.equal(canAccessSession(session, 'buyer-2', ['ADMIN']), true);
  assert.equal(canAccessSession(session, 'buyer-2', ['SUPER_ADMIN']), true);
  assert.equal(canAccessSession(session, 'buyer-2', ['OP']), false);
});

test('isAdminUser accepts only the two operator roles', () => {
  assert.equal(isAdminUser(undefined), false);
  assert.equal(isAdminUser([]), false);
  assert.equal(isAdminUser(['ADMIN']), true);
  assert.equal(isAdminUser(['SUPER_ADMIN']), true);
  assert.equal(isAdminUser(['BUYER', 'SUPER_ADMIN']), true);
});

test('validateSessionStart gate order: seller required before balance', () => {
  assert.equal(validateSessionStart({ sellerId: '', hardwareId: 'h', pricePerMb: 1, balanceUsd: 99 }), 'SELLER_REQUIRED');
  assert.equal(validateSessionStart({ sellerId: undefined, hardwareId: 'h', pricePerMb: 1, balanceUsd: 99 }), 'SELLER_REQUIRED');
});

test('validateSessionStart rejects blank/missing hardware id', () => {
  const base = { sellerId: 's', pricePerMb: 1, balanceUsd: 99 } as any;
  assert.equal(validateSessionStart({ ...base, hardwareId: '   ' }), 'HARDWARE_REQUIRED');
  assert.equal(validateSessionStart({ ...base, hardwareId: undefined }), 'HARDWARE_REQUIRED');
});

test('validateSessionStart rejects non-positive or missing server price (client cannot set own price)', () => {
  const base = { sellerId: 's', hardwareId: 'h', balanceUsd: 99 } as any;
  assert.equal(validateSessionStart({ ...base, pricePerMb: 0 }), 'SELLER_PRICE_UNAVAILABLE');
  assert.equal(validateSessionStart({ ...base, pricePerMb: -1 }), 'SELLER_PRICE_UNAVAILABLE');
  assert.equal(validateSessionStart({ ...base, pricePerMb: undefined }), 'SELLER_PRICE_UNAVAILABLE');
});

test('validateSessionStart enforces the server-side minimum balance', () => {
  const base = { sellerId: 's', hardwareId: 'h', pricePerMb: 0.1 } as any;
  assert.equal(validateSessionStart({ ...base, balanceUsd: MIN_SESSION_BALANCE_USD - 0.01 }), 'INSUFFICIENT_FUNDS');
  assert.equal(validateSessionStart({ ...base, balanceUsd: MIN_SESSION_BALANCE_USD }), 'OK');
  assert.equal(validateSessionStart({ ...base, balanceUsd: 100 }), 'OK');
});