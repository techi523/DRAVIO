import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.PLATFORM_FEE_PCT = '0.20';

const { quoteForAmount, quoteInCents, feeStatementLines } = await import(
  '../src/modules/compliance/pure/fee-disclosure.js'
);

test('buyer is charged the package price; 20% platform fee is seller-borne', () => {
  const q = quoteForAmount(10.0);
  assert.equal(q.packagePriceUsd, 10.0);
  assert.equal(q.totalChargedToBuyerUsd, 10.0);
  assert.equal(q.platformFeeUsd, 2.0);
  assert.equal(q.sellerNetUsd, 8.0);
  assert.equal(q.feeBearer, 'SELLER');
  assert.equal(q.currency, 'USD');
});

test('exact integer-cent settlement: package = fee + seller net', () => {
  const cents = quoteInCents(10.0);
  assert.equal(cents.packagePriceCents, 1000);
  assert.equal(cents.platformFeeCents, 200);
  assert.equal(cents.sellerNetCents, 800);
  assert.equal(cents.packagePriceCents, cents.platformFeeCents + cents.sellerNetCents);
});

test('sub-cent amounts never produce negative fee or unbalance the split', () => {
  for (const amount of [0.005, 0.01, 0.49, 5.55]) {
    const q = quoteForAmount(amount);
    assert.ok(q.platformFeeUsd >= 0);
    assert.ok(q.sellerNetUsd >= 0);
    assert.ok(Math.abs(q.platformFeeUsd + q.sellerNetUsd - q.packagePriceUsd) < 0.000001);
  }
});

test('fee statement lines fully disclose the breakdown', () => {
  const lines = feeStatementLines(10.0);
  assert.ok(lines[0].includes('$10.00'));
  assert.ok(lines[1].includes('$10.00'));
  assert.ok(lines.some((l) => l.includes('borne by seller')));
  assert.ok(lines.some((l) => l.includes('Seller receives: $8.00')));
});

test('invalid amounts are rejected', () => {
  assert.throws(() => quoteForAmount(0), /INVALID_AMOUNT/);
  assert.throws(() => quoteForAmount(-5), /INVALID_AMOUNT/);
  assert.throws(() => quoteForAmount(Number.NaN), /INVALID_AMOUNT/);
});