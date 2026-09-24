import { test } from 'node:test';
import assert from 'node:assert/strict';

const { retentionFor, isLegallyRetained, retentionCategories, RETENTION_REGISTRY } = await import(
  '../src/modules/compliance/pure/retention.js'
);
const { configuredRestrictedCountries, evaluateCountry, assertCountryAllowed } = await import(
  '../src/modules/compliance/pure/sanctions.js'
);
const { buildAuditEvent, sanitizeMetadata, AUDIT_ACTIONS } = await import(
  '../src/modules/compliance/pure/audit-events.js'
);

test('retention registry covers every category with a lawful-basis label (no fabricated legal claims)', () => {
  assert.ok(retentionCategories().length >= 12);
  for (const cat of retentionCategories()) {
    const rule = retentionFor(cat);
    assert.ok(rule, `missing rule for ${cat}`);
    assert.ok(rule.lawfulBasis.length > 0);
  }
});

test('financial records are legally retained; profiles/tokens are erasable', () => {
  assert.equal(isLegallyRetained('payments.transactions'), true);
  assert.equal(isLegallyRetained('billing.ledger_entries'), true);
  assert.equal(isLegallyRetained('payments.payouts'), true);
  assert.equal(isLegallyRetained('auth.refresh_tokens'), false);
  assert.equal(isLegallyRetained('users.profiles'), false);
});

test('registry snapshot has the recognized categories across the data model', () => {
  const cats = retentionCategories();
  for (const expected of [
    'auth.credentials',
    'payments.transactions',
    'billing.ledger_entries',
    'sessions.routing',
    'analytics.metrics',
    'audit.audit_log',
    'device.identifier',
  ]) {
    assert.ok(cats.includes(expected), `missing ${expected}`);
  }
});

test('sanctions config is EMPTY by default (no fabricated restricted list)', () => {
  const prev = process.env.SANCTIONED_COUNTRIES;
  delete process.env.SANCTIONED_COUNTRIES;
  try {
    assert.deepEqual(configuredRestrictedCountries(), []);
    assert.equal(evaluateCountry('KE').restricted, false);
    assert.equal(evaluateCountry('ZZ').restricted, false);
    assert.equal(evaluateCountry('KE').reason, undefined);
  } finally {
    if (prev !== undefined) {
      process.env.SANCTIONED_COUNTRIES = prev;
    }
  }
});

test('sanctions gate honors an operator-configured env list and rejects only those', () => {
  const prev = process.env.SANCTIONED_COUNTRIES;
  process.env.SANCTIONED_COUNTRIES = 'XX, YY ,ZZ';
  try {
    assert.deepEqual(configuredRestrictedCountries(), ['XX', 'YY', 'ZZ']);
    assert.equal(evaluateCountry('KE').restricted, false);
    assert.equal(evaluateCountry('xx').restricted, true);
    assert.equal(evaluateCountry('YY').restricted, true);
    assert.throws(() => assertCountryAllowed('XX'), /COUNTRY_RESTRICTED/);
    assert.doesNotThrow(() => assertCountryAllowed('KE'));
  } finally {
    if (prev !== undefined) process.env.SANCTIONED_COUNTRIES = prev;
  }
});

test('audit events accept only known actions and redact sensitive metadata', () => {
  assert.ok(AUDIT_ACTIONS.includes('payment.transition'));
  assert.throws(() => buildAuditEvent({ action: 'custom.hack', service: 'x', resource_type: 'y' }));
  const event = buildAuditEvent({
    actor_id: 'usr-1',
    action: 'payment.transition',
    service: 'payment',
    resource_type: 'transaction',
    resource_id: 'tx-9',
    metadata: { from: 'PAID', token: 'abc', nested: { password: 'secret', amount: 5 } },
  });
  assert.equal(event.action, 'payment.transition');
  assert.equal(event.metadata.token, '[REDACTED]');
  assert.equal(event.metadata.nested.password, '[REDACTED]');
  assert.equal(event.metadata.from, 'PAID');
  assert.equal(event.metadata.nested.amount, 5);
});

test('sanitizeMetadata redacts known sensitive key shapes anywhere in the tree', () => {
  const clean = sanitizeMetadata({
    api_key: 'k',
    Authorization: 'Bearer x',
    session_token: 's',
    fine: 'yes',
  });
  assert.equal(clean.api_key, '[REDACTED]');
  assert.equal(clean.Authorization, '[REDACTED]');
  assert.equal(clean.session_token, '[REDACTED]');
  assert.equal(clean.fine, 'yes');
});