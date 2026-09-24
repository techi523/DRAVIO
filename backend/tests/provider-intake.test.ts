import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  PROVIDER_TYPE_CONFIG,
  providerTypeConfig,
  isProviderTypeId,
  validateIntake,
  intakeSatisfiesSellGate,
} = await import('../src/modules/compliance/pure/provider-intake.js');

test('provider type vocabulary is config-driven and validated', () => {
  assert.ok(isProviderTypeId('ISP'));
  assert.ok(isProviderTypeId('INDIVIDUAL'));
  assert.equal(isProviderTypeId('TELCO'), false);
  assert.equal(providerTypeConfig('ISP')?.label, 'Internet service provider');
  assert.equal(PROVIDER_TYPE_CONFIG.length, 6);
});

test('INDIVIDUAL intake requires no business record', () => {
  const ok = validateIntake('INDIVIDUAL', { country_code: 'KE' });
  assert.equal(ok.ok, true);
  assert.equal(ok.normalized.country_code, 'KE');
  assert.equal(intakeSatisfiesSellGate('INDIVIDUAL', { country_code: 'KE' }), true);
});

test('BUSINESS intake requires legal_name, registration_number, and business record', () => {
  const missing = validateIntake('BUSINESS', { legal_name: 'Acme Ltd' });
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.some((e) => e.field === 'registration_number'));
  assert.ok(missing.errors.some((e) => e.field === 'business_record_attached'));

  const ok = validateIntake('BUSINESS', {
    legal_name: 'Acme Ltd',
    registration_number: 'C123456',
    business_record_attached: true,
  });
  assert.equal(ok.ok, true);
  assert.equal(intakeSatisfiesSellGate('BUSINESS', ok.normalized), true);
});

test('ISP intake requires authorization identifier optionally, legal name + registration required', () => {
  const ok = validateIntake('ISP', {
    legal_name: 'EastLink Ltd',
    registration_number: 'L-88-001',
    authorization_identifier: 'CA-2024-0001',
    business_record_attached: true,
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.normalized.authorization_identifier, 'CA-2024-0001');
});

test('unknown fields and unknown provider types are rejected', () => {
  const unknownField = validateIntake('INDIVIDUAL', { some_random_field: 'x' });
  assert.equal(unknownField.ok, false);
  assert.ok(unknownField.errors.some((e) => e.message === 'UNKNOWN_FIELD'));
  const unknownType = validateIntake('ALIEN', {});
  assert.equal(unknownType.ok, false);
  assert.equal(unknownType.errors[0].message, 'UNKNOWN_PROVIDER_TYPE');
});

test('intake with short invalid legal_name is rejected', () => {
  const bad = validateIntake('BUSINESS', { legal_name: 'A', business_record_attached: true });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => e.message === 'REQUIRED'));
});

test('sell gate requires business record for business-style providers', () => {
  const noDocs = validateIntake('NETWORK_OPERATOR', {
    legal_name: 'NetCo',
    registration_number: 'R9',
  });
  assert.equal(noDocs.ok, false);
  assert.equal(
    intakeSatisfiesSellGate('NETWORK_OPERATOR', {
      legal_name: 'NetCo',
      registration_number: 'R9',
      business_record_attached: true,
    }),
    true
  );
});