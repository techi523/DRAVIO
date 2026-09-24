import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  assertTransitionAllowed,
  canTransition,
  isTerminalState,
  nextAllowedStates,
  isTransactionState,
} = await import('../src/modules/payment/core/transaction-machine.js');
const { SYSTEM_ROLE } = await import('../src/modules/payment/core/transaction-machine.js');

const buyer = (owner = true) => ({ requesterRole: 'BUYER', requesterIsOwner: owner });
const seller = () => ({ requesterRole: 'SELLER', requesterIsOwner: false });
const billingAdmin = () => ({ requesterRole: 'BILLING_ADMIN', requesterIsOwner: false });
const system = () => ({ requesterRole: SYSTEM_ROLE, requesterIsOwner: false });

test('system completes the happy path PENDING→AUTHORIZED→PAID→FULFILLED', () => {
  assert.doesNotThrow(() => assertTransitionAllowed('PENDING', 'AUTHORIZED', system()));
  assert.doesNotThrow(() => assertTransitionAllowed('AUTHORIZED', 'PAID', system()));
  assert.doesNotThrow(() => assertTransitionAllowed('PAID', 'FULFILLED', system()));
});

test('payment failure and cancellation from PENDING', () => {
  assert.doesNotThrow(() => assertTransitionAllowed('PENDING', 'FAILED', system()));
  assert.doesNotThrow(() => assertTransitionAllowed('PENDING', 'CANCELLED', system()));
});

test('buyer can dispute their own paid/fulfilled transaction (ownership required)', () => {
  assert.doesNotThrow(() => assertTransitionAllowed('PAID', 'DISPUTED', buyer(true)));
  assert.doesNotThrow(() => assertTransitionAllowed('FULFILLED', 'DISPUTED', buyer(true)));
});

test('buyer cannot dispute a transaction they do not own', () => {
  assert.equal(canTransition('PAID', 'DISPUTED', buyer(false))?.code, 'OWNERSHIP_REQUIRED');
});

test('seller role cannot dispute, refund, or cancel money movement', () => {
  assert.equal(canTransition('PAID', 'DISPUTED', seller())?.code, 'FORBIDDEN_ROLE');
  assert.equal(canTransition('PAID', 'REFUNDED', seller())?.code, 'FORBIDDEN_ROLE');
  assert.equal(canTransition('FULFILLED', 'DISPUTED', seller())?.code, 'FORBIDDEN_ROLE');
});

test('refund/partial refund/reverse require a billing administrator', () => {
  assert.equal(canTransition('PAID', 'REFUNDED', buyer(true))?.code, 'FORBIDDEN_ROLE');
  assert.equal(canTransition('DISPUTED', 'REFUNDED', buyer(true))?.code, 'FORBIDDEN_ROLE');
  assert.doesNotThrow(() => assertTransitionAllowed('PAID', 'REFUNDED', billingAdmin()));
  assert.doesNotThrow(() => assertTransitionAllowed('PAID', 'PARTIALLY_REFUNDED', billingAdmin()));
  assert.doesNotThrow(() => assertTransitionAllowed('DISPUTED', 'REVERSED', billingAdmin()));
  assert.doesNotThrow(() => assertTransitionAllowed('PARTIALLY_REFUNDED', 'REFUNDED', billingAdmin()));
});

test('dispute resolution via admin back to FULFILLED', () => {
  assert.doesNotThrow(() => assertTransitionAllowed('DISPUTED', 'FULFILLED', billingAdmin()));
});

test('terminal states are immutable', () => {
  for (const terminal of ['FAILED', 'REFUNDED', 'REVERSED'] as const) {
    assert.ok(isTerminalState(terminal));
    assert.equal(canTransition(terminal, 'PENDING', system())?.code, 'TERMINAL_STATE');
  }
});

test('unknown states and illegal transitions are rejected', () => {
  assert.equal(canTransition('NOPE', 'PAID', system())?.code, 'UNKNOWN_STATE');
  assert.equal(canTransition('PENDING', 'REFUNDED', billingAdmin())?.code, 'TRANSITION_NOT_ALLOWED');
  assert.equal(canTransition('PENDING', 'PENDING', system())?.code, 'TRANSITION_NOT_ALLOWED');
});

test('nextAllowedStates returns the machine transitions for a state', () => {
  const fromPending = nextAllowedStates('PENDING');
  assert.deepEqual([...fromPending].sort(), ['AUTHORIZED', 'CANCELLED', 'DISPUTED', 'FAILED']);
});

test('isTransactionState validates known states', () => {
  assert.ok(isTransactionState('PENDING'));
  assert.ok(isTransactionState('PARTIALLY_REFUNDED'));
  assert.equal(isTransactionState('SHIPPED'), false);
});

test('CANCELLED is not reachable from PAID or FULFILLED (money already moved)', () => {
  assert.equal(canTransition('PAID', 'CANCELLED', billingAdmin())?.code, 'TRANSITION_NOT_ALLOWED');
  assert.equal(canTransition('FULFILLED', 'CANCELLED', billingAdmin())?.code, 'TRANSITION_NOT_ALLOWED');
});