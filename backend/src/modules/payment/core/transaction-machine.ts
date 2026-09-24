// Transaction lifecycle state machine (dispute / refund / cancel / reverse).
// Pure module: NO DB/IO imports so it can be unit-tested in isolation.
//
// The current implementation only ever writes PENDING/COMPLETED/FAILED. This
// machine defines the full auditable lifecycle a transaction may traverse and
// enforces transition validity + authorization rules. Repository layers persist
// the transition and append a compliance.transaction_events row (CAS-guarded).

export const TRANSACTION_STATES = [
  'PENDING',
  'AUTHORIZED',
  'PAID',
  'FULFILLED',
  'FAILED',
  'CANCELLED',
  'DISPUTED',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'REVERSED',
] as const;

export type TransactionState = (typeof TRANSACTION_STATES)[number];

export const TERMINAL_STATES: ReadonlySet<TransactionState> = new Set([
  'FAILED',
  'REFUNDED',
  'REVERSED',
]);

export const SYSTEM_ROLE = 'SYSTEM';

export interface TransitionContext {
  /** Role token as carried by the authenticated caller, or SYSTEM_ROLE. */
  requesterRole: string | null;
  /** True when the requester is the buyer who owns the transaction. */
  requesterIsOwner: boolean;
}

export interface TransitionError {
  code:
    | 'UNKNOWN_STATE'
    | 'TERMINAL_STATE'
    | 'TRANSITION_NOT_ALLOWED'
    | 'FORBIDDEN_ROLE'
    | 'REASON_REQUIRED'
    | 'OWNERSHIP_REQUIRED';
  message: string;
}

/** Core transition rules. Money-affecting transitions (REFUND/PARTIALLY_REFUNDED/
 *  REVERSED) require a billing administrator: a buyer may initiate a dispute,
 *  but only an authorized operator can move money. */
export const TRANSITION_RULES: ReadonlyArray<{
  from: TransactionState;
  to: TransactionState;
  roles: ReadonlyArray<string>;
  requiresOwner?: boolean;
  reasonRequired?: boolean;
}> = [
  { from: 'PENDING', to: 'AUTHORIZED', roles: [SYSTEM_ROLE] },
  { from: 'PENDING', to: 'FAILED', roles: [SYSTEM_ROLE, 'BILLING_ADMIN'] },
  { from: 'PENDING', to: 'CANCELLED', roles: [SYSTEM_ROLE, 'BILLING_ADMIN'], reasonRequired: true },
  { from: 'PENDING', to: 'DISPUTED', roles: ['BUYER', 'BILLING_ADMIN'], requiresOwner: true, reasonRequired: true },

  { from: 'AUTHORIZED', to: 'PAID', roles: [SYSTEM_ROLE] },
  { from: 'AUTHORIZED', to: 'CANCELLED', roles: [SYSTEM_ROLE, 'BILLING_ADMIN'], reasonRequired: true },
  { from: 'AUTHORIZED', to: 'FAILED', roles: [SYSTEM_ROLE] },

  { from: 'PAID', to: 'FULFILLED', roles: [SYSTEM_ROLE] },
  { from: 'PAID', to: 'DISPUTED', roles: ['BUYER', 'BILLING_ADMIN'], requiresOwner: true, reasonRequired: true },
  { from: 'PAID', to: 'PARTIALLY_REFUNDED', roles: ['BILLING_ADMIN'], reasonRequired: true },
  { from: 'PAID', to: 'REFUNDED', roles: ['BILLING_ADMIN'], reasonRequired: true },

  { from: 'FULFILLED', to: 'DISPUTED', roles: ['BUYER', 'BILLING_ADMIN'], requiresOwner: true, reasonRequired: true },
  { from: 'FULFILLED', to: 'PARTIALLY_REFUNDED', roles: ['BILLING_ADMIN'], reasonRequired: true },
  { from: 'FULFILLED', to: 'REFUNDED', roles: ['BILLING_ADMIN'], reasonRequired: true },

  { from: 'DISPUTED', to: 'FULFILLED', roles: ['BILLING_ADMIN'], reasonRequired: true },
  { from: 'DISPUTED', to: 'PARTIALLY_REFUNDED', roles: ['BILLING_ADMIN'], reasonRequired: true },
  { from: 'DISPUTED', to: 'REFUNDED', roles: ['BILLING_ADMIN'], reasonRequired: true },
  { from: 'DISPUTED', to: 'REVERSED', roles: ['BILLING_ADMIN'], reasonRequired: true },

  { from: 'PARTIALLY_REFUNDED', to: 'REFUNDED', roles: ['BILLING_ADMIN'], reasonRequired: true },
  { from: 'PARTIALLY_REFUNDED', to: 'DISPUTED', roles: ['BUYER', 'BILLING_ADMIN'], requiresOwner: true, reasonRequired: true },
];

export function isTransactionState(value: string): value is TransactionState {
  return (TRANSACTION_STATES as readonly string[]).includes(value);
}

export function isTerminalState(state: TransactionState): boolean {
  return TERMINAL_STATES.has(state);
}

/** States reachable directly from `from` under the machine rules. */
export function nextAllowedStates(from: TransactionState): TransactionState[] {
  return TRANSITION_RULES.filter((r) => r.from === from).map((r) => r.to);
}

/** Validate a transition (authorization + invariant). Throws TransitionError. */
export function assertTransitionAllowed(
  from: string,
  to: string,
  ctx: TransitionContext
): void {
  if (!isTransactionState(from)) {
    throw {
      code: 'UNKNOWN_STATE',
      message: `Unknown source state: ${from}`,
    } satisfies TransitionError;
  }
  if (!isTransactionState(to)) {
    throw {
      code: 'UNKNOWN_STATE',
      message: `Unknown target state: ${to}`,
    } satisfies TransitionError;
  }
  if (from === to) {
    throw {
      code: 'TRANSITION_NOT_ALLOWED',
      message: `No-op transition ${from} -> ${to} is not permitted`,
    } satisfies TransitionError;
  }
  if (isTerminalState(from)) {
    throw {
      code: 'TERMINAL_STATE',
      message: `Terminal state ${from} is immutable`,
    } satisfies TransitionError;
  }

  const rule = TRANSITION_RULES.find((r) => r.from === from && r.to === to);
  if (!rule) {
    throw {
      code: 'TRANSITION_NOT_ALLOWED',
      message: `Transition ${from} -> ${to} is not allowed`,
    } satisfies TransitionError;
  }

  // Role is evaluated FIRST so unauthorized callers never learn whether they
  // own the target resource (ownership disclosure only to permitted roles).
  const role = ctx.requesterRole || null;
  if (!rule.roles.some((allowed) => allowed === role)) {
    throw {
      code: 'FORBIDDEN_ROLE',
      message: `Role ${role ?? 'none'} is not authorized for ${from} -> ${to}`,
    } satisfies TransitionError;
  }

  if (rule.requiresOwner && !ctx.requesterIsOwner) {
    throw {
      code: 'OWNERSHIP_REQUIRED',
      message: `Transition ${from} -> ${to} requires the transaction owner`,
    } satisfies TransitionError;
  }
}

/** Non-throwing wrapper returning an error descriptor or null. */
export function canTransition(
  from: string,
  to: string,
  ctx: TransitionContext
): TransitionError | null {
  try {
    assertTransitionAllowed(from, to, ctx);
    return null;
  } catch (err) {
    return err as TransitionError;
  }
}

export function isTerminalTransitionTarget(to: TransactionState): boolean {
  return TERMINAL_STATES.has(to);
}