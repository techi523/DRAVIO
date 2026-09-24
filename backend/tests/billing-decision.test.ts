import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.PLATFORM_FEE_PCT = '0.20';

const { computeBillingDecision } = await import(
  '../src/modules/billing/core/billing-decision.js'
);
const { computeFees } = await import('../src/modules/payment/money.js');

test('replay or non-increasing usage report is not billable', () => {
  const replay = computeBillingDecision(1_000_000n, 1_000_000n, 0.1, 0);
  assert.equal(replay.billable, false);
  assert.equal(replay.moveMoney, false);

  const regression = computeBillingDecision(2_000_000n, 1_000_000n, 0.1, 0);
  assert.equal(regression.billable, false);
  assert.equal(regression.moveMoney, false);
});

test('zero/negative price yields no money movement', () => {
  const d = computeBillingDecision(0n, 1_048_576n, 0, 0);
  assert.equal(d.exactCost, 0);
  assert.equal(d.moveMoney, false);
});

test('sub-cent charges carry over until a whole cent accrues (no lost micro-charges)', () => {
  // 10 MB at $0.00049/MB = $0.0049 per report.
  const price = 0.00049;
  const step = 10_485_760n;
  let pending = 0;
  let moves = 0;
  for (let i = 0; i < 30; i++) {
    const d = computeBillingDecision(BigInt(i) * step, BigInt(i + 1) * step, price, pending);
    if (d.moveMoney) {
      moves += 1;
      assert.ok(d.settledCost >= 0.01);
      assert.ok(Number.isInteger(d.settledCost * 100));
    }
    pending = d.carryOver;
    assert.ok(pending >= 0 && pending < 0.01);
  }
  assert.ok(moves >= 2, `expected micro-charges to settle across reports, got ${moves}`);
});

test('fractional-cent aggregation across 3 reports mirrors wallet cent accounting', () => {
  const r1 = computeBillingDecision(0n, 10_485_760n, 0.00049, 0);
  assert.equal(r1.settledCost, 0);
  assert.equal(r1.carryOver, 0.0049);
  assert.equal(r1.moveMoney, false);

  const r1b = computeBillingDecision(0n, 10_485_760n, 0.00049, r1.carryOver);
  assert.equal(r1b.settledCost, 0);
  assert.equal(r1b.carryOver, 0.0098);

  const r2 = computeBillingDecision(0n, 10_485_760n, 0.00049, r1b.carryOver);
  assert.equal(r2.settledCost, 0.01);
  assert.equal(r2.carryOver, 0.0047);
  assert.equal(r2.moveMoney, true);
});

test('exact cent multiples settle fully with no carry', () => {
  const d = computeBillingDecision(0n, 1_048_576n, 1.25, 0);
  assert.equal(d.exactCost, 1.25);
  assert.equal(d.settledCost, 1.25);
  assert.equal(d.carryOver, 0);
  assert.equal(d.moveMoney, true);
});

test('settled money splits into platform fee + seller net without loss', () => {
  for (const price of [0.00049, 0.01, 0.499, 1.25]) {
    let pending = 0;
    for (let i = 0; i < 40; i++) {
      const d = computeBillingDecision(BigInt(i) * 1_048_576n, BigInt(i + 1) * 1_048_576n, price, pending);
      if (d.moveMoney) {
        const fees = computeFees(d.settledCost);
        assert.ok(fees.platformFeeUsd >= 0 && fees.sellerNetUsd >= 0);
        assert.ok(Math.abs(fees.platformFeeUsd + fees.sellerNetUsd - d.settledCost) < 0.000001);
        assert.ok(fees.platformFeeUsd <= d.settledCost);
      }
      pending = d.carryOver;
    }
  }
});

test('carry-over never loses value or grows without a cent being settled', () => {
  let pending = 0;
  for (let i = 0; i < 500; i++) {
    const d = computeBillingDecision(0n, 1_048_576n, 0.000013911, pending);
    assert.ok(d.carryOver < 0.01);
    assert.ok(d.carryOver >= d.exactCost - 0.01 - 1e-9);
    pending = d.carryOver;
    if (d.moveMoney) assert.ok(d.settledCost >= 0.01);
  }
});