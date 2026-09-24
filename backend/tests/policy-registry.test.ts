import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  POLICY_CATALOG,
  policyById,
  validateAcceptance,
  assertSatisfiesGate,
  requiredPoliciesForGate,
} = await import('../src/modules/compliance/pure/policy-registry.js');

test('catalog includes the five policy documents with version + gates', () => {
  const ids = POLICY_CATALOG.map((p) => p.id);
  assert.deepEqual([...ids].sort(), ['aup', 'buyer_terms', 'privacy', 'provider_terms', 'terms']);
  const terms = policyById('terms');
  assert.ok(terms);
  assert.ok(terms.requiredGates.includes('REGISTER'));
  const buyer = policyById('buyer_terms');
  assert.ok(buyer?.requiredGates.includes('PURCHASE'));
  const provider = policyById('provider_terms');
  assert.ok(provider?.requiredGates.includes('SELL'));
});

test('acceptance is valid only for the current version at/after effectiveAt', () => {
  assert.equal(validateAcceptance('terms', '1.0', '2026-09-10T00:00:00.000Z').ok, true);
  assert.equal(validateAcceptance('terms', '0.9', '2026-09-10T00:00:00.000Z').code, 'VERSION_MISMATCH');
  assert.equal(validateAcceptance('terms', '1.0', '2025-01-01T00:00:00.000Z').code, 'NOT_YET_EFFECTIVE');
  assert.equal(validateAcceptance('nope', '1.0', '2026-09-10T00:00:00.000Z').code, 'UNKNOWN_POLICY');
});

test('PURCHASE gate requires buyer_terms (current version) to be accepted', () => {
  const noAcceptance = assertSatisfiesGate('PURCHASE', []);
  assert.equal(noAcceptance.satisfied, false);
  assert.ok(noAcceptance.missing.some((m) => m.policyId === 'buyer_terms'));

  const staleVersion = assertSatisfiesGate('PURCHASE', [
    { policyId: 'buyer_terms', version: '0.9', acceptedAt: '2026-09-10T00:00:00.000Z' },
  ]);
  assert.equal(staleVersion.satisfied, false);

  const satisfied = assertSatisfiesGate('PURCHASE', [
    { policyId: 'buyer_terms', version: '1.0', acceptedAt: '2026-09-10T00:00:00.000Z' },
  ]);
  assert.equal(satisfied.satisfied, true);
  assert.equal(satisfied.missing.length, 0);
});

test('REGISTER gate requires terms/privacy/aup', () => {
  const required = requiredPoliciesForGate('REGISTER').map((r) => r.policyId);
  assert.deepEqual([...required].sort(), ['aup', 'privacy', 'terms']);
  const gate = assertSatisfiesGate('REGISTER', [
    { policyId: 'terms', version: '1.0', acceptedAt: '2026-09-10T00:00:00.000Z' },
  ]);
  assert.equal(gate.satisfied, false);
  const full = assertSatisfiesGate('REGISTER', [
    { policyId: 'terms', version: '1.0', acceptedAt: '2026-09-10T00:00:00.000Z' },
    { policyId: 'privacy', version: '1.0', acceptedAt: '2026-09-10T00:00:00.000Z' },
    { policyId: 'aup', version: '1.0', acceptedAt: '2026-09-10T00:00:00.000Z' },
  ]);
  assert.equal(full.satisfied, true);
});

test('SELL gate requires provider_terms', () => {
  const gate = assertSatisfiesGate('SELL', [
    { policyId: 'provider_terms', version: '1.0', acceptedAt: '2026-09-10T00:00:00.000Z' },
  ]);
  assert.equal(gate.satisfied, true);
});