import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  classifyRight,
  isPrivacyRight,
  canCreateRequest,
  correctionEditableFields,
  deletionOutcomePlan,
  assertRequestTransition,
} = await import('../src/modules/compliance/pure/privacy-rights.js');

test('rights classification: ACCESS/CORRECTION/PORTABILITY automated, DELETION/OBJECTION reviewed', () => {
  assert.equal(classifyRight('ACCESS').automated, true);
  assert.equal(classifyRight('CORRECTION').automated, true);
  assert.equal(classifyRight('PORTABILITY').automated, true);
  assert.equal(classifyRight('PORTABILITY').deliverable, 'file');
  assert.equal(classifyRight('DELETION').requiresReview, true);
  assert.equal(classifyRight('OBJECTION').requiresReview, true);
});

test('rights vocabulary validation', () => {
  assert.ok(isPrivacyRight('ACCESS'));
  assert.ok(isPrivacyRight('PORTABILITY'));
  assert.equal(isPrivacyRight('TRACKING'), false);
});

test('data subjects can raise requests; SYSTEM/admin roles cannot', () => {
  assert.equal(canCreateRequest('ACCESS', ['BUYER']), true);
  assert.equal(canCreateRequest('ACCESS', ['SELLER', 'PROVIDER']), true);
  assert.equal(canCreateRequest('ACCESS', ['SYSTEM']), false);
  assert.equal(canCreateRequest('ACCESS', ['SERVICE']), false);
  assert.equal(canCreateRequest('DELETION', []), true);
});

test('correction accepts only profile fields and normalizes them', () => {
  const result = correctionEditableFields({
    full_name: '  Jane Doe  ',
    phone_number: '+1 (555) 010-0200',
    country_code: 'ke',
    email: 'jane@example.com',
    roles: ['SELLER'],
  });
  assert.equal(result.normalized.full_name, 'Jane Doe');
  assert.equal(result.normalized.phone_number, '+15550100200');
  assert.equal(result.normalized.country_code, 'KE');
  assert.ok(result.rejected.includes('email'));
  assert.ok(result.rejected.includes('roles'));
});

test('correction rejects malformed values', () => {
  const result = correctionEditableFields({ full_name: 'x', phone_number: '12' });
  assert.equal(result.normalized.full_name, undefined);
  assert.equal(result.normalized.phone_number, undefined);
});

test('deletion plan partitions erasable vs legally-retained financial records', () => {
  const plan = deletionOutcomePlan();
  assert.ok(plan.erasable.includes('users.profiles'));
  assert.ok(plan.retained.includes('payments.transactions'));
  assert.ok(plan.retained.includes('billing.ledger_entries'));
  assert.ok(plan.retained.includes('audit.audit_log'));
  assert.ok(plan.retained.includes('payments.payouts'));
  // Erasable and retained categories never overlap.
  const intersection = plan.erasable.filter((x) => plan.retained.includes(x));
  assert.equal(intersection.length, 0);
});

test('request lifecycle: owner may withdraw only own request; reviewer completes/rejects', () => {
  assert.deepEqual(
    assertRequestTransition('PENDING', 'WITHDRAWN', { requesterIsOwner: true, requesterIsReviewer: false }),
    { ok: true }
  );
  assert.equal(
    assertRequestTransition('PENDING', 'WITHDRAWN', { requesterIsOwner: false, requesterIsReviewer: false }).code,
    'OWNERSHIP_REQUIRED'
  );
  assert.equal(
    assertRequestTransition('PENDING', 'COMPLETED', { requesterIsOwner: true, requesterIsReviewer: false }).code,
    'FORBIDDEN_ROLE'
  );
  assert.deepEqual(
    assertRequestTransition('IN_REVIEW', 'REJECTED', { requesterIsOwner: false, requesterIsReviewer: true }),
    { ok: true }
  );
  assert.equal(
    assertRequestTransition('COMPLETED', 'REOPENED', { requesterIsOwner: true, requesterIsReviewer: true }).code,
    'TERMINAL_STATE'
  );
});