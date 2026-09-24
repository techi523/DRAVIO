import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.PLATFORM_FEE_PCT = '0.20';

const { computeFees, getPlatformFeePct, settleCentCarry } = await import(
  '../src/modules/payment/money.js'
);

test('computeFees applies 20% platform fee and rounds to cents', () => {
  const fees = computeFees(10.0);
  assert.equal(fees.platformFeeUsd, 2.0);
  assert.equal(fees.sellerNetUsd, 8.0);
  assert.equal(fees.amountUsd, 10.0);
});

test('computeFees handles small sub-cent amounts without negatives', () => {
  const fees = computeFees(0.005);
  assert.ok(fees.platformFeeUsd >= 0);
  assert.ok(fees.sellerNetUsd >= 0);
  assert.equal(fees.platformFeeUsd + fees.sellerNetUsd, fees.amountUsd);
});

test('computeFees never overshoots the amount (fee <= amount)', () => {
  for (const amount of [0.01, 0.99, 5.55, 123.45]) {
    const fees = computeFees(amount);
    assert.ok(fees.platformFeeUsd + fees.sellerNetUsd <= fees.amountUsd + 0.000001);
  }
});

test('getPlatformFeePct clamps out-of-range config to default', () => {
  process.env.PLATFORM_FEE_PCT = '9';
  assert.equal(getPlatformFeePct(), 0.2);
  process.env.PLATFORM_FEE_PCT = '-1';
  assert.equal(getPlatformFeePct(), 0.2);
  process.env.PLATFORM_FEE_PCT = '0.20';
  assert.equal(getPlatformFeePct(), 0.2);
});

test('settleCentCarry does not lose sub-cent charges across reports', () => {
  // 10 MB at $0.00049/MB = $0.0049 → below a cent: carried over, no cost.
  const first = settleCentCarry(0, 0.0049);
  assert.equal(first.cost, 0);
  assert.equal(first.carryOver, 0.0049);

  // Next report adds another $0.0049 → total $0.0098, still below a cent.
  const second = settleCentCarry(first.carryOver, 0.0049);
  assert.equal(second.cost, 0);
  assert.equal(second.carryOver, 0.0098);

  // Third report crosses a cent: settle $0.01, carry $0.0047.
  const third = settleCentCarry(second.carryOver, 0.0049);
  assert.equal(third.cost, 0.01);
  assert.equal(third.carryOver, 0.0047);
});

test('settleCentCarry preserves exact cent multiples', () => {
  const result = settleCentCarry(0, 1.25);
  assert.equal(result.cost, 1.25);
  assert.equal(result.carryOver, 0);
});