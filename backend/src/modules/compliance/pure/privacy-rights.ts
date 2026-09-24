// Data-subject rights core (Kenya DPA 2019-inspired and GDPR-aligned handling).
// Pure module: NO DB/IO imports. Repositories apply the decisions this module
// produces against the real tables.

export const PRIVACY_RIGHTS = [
  'ACCESS',
  'CORRECTION',
  'OBJECTION',
  'DELETION',
  'PORTABILITY',
] as const;

export type PrivacyRight = (typeof PRIVACY_RIGHTS)[number];
export type PrivacyRequestState =
  | 'PENDING'
  | 'IN_REVIEW'
  | 'COMPLETED'
  | 'REJECTED'
  | 'WITHDRAWN';

export const PRIVACY_REQUEST_STATES: ReadonlyArray<PrivacyRequestState> = [
  'PENDING',
  'IN_REVIEW',
  'COMPLETED',
  'REJECTED',
  'WITHDRAWN',
];

export const IGNORED_ROLES = new Set(['SYSTEM', 'SERVICE', 'ADMIN']);

export interface RightProfile {
  right: PrivacyRight;
  /** True when fulfillment can be fully or largely automated. */
  automated: boolean;
  /** True when the request must go through human/legal review before action. */
  requiresReview: boolean;
  /** Machine-readable payload (PORTABILITY) vs human review envelope (ACCESS). */
  deliverable: 'envelope' | 'file';
}

const RIGHT_PROFILES: Record<PrivacyRight, RightProfile> = {
  ACCESS: { right: 'ACCESS', automated: true, requiresReview: false, deliverable: 'envelope' },
  CORRECTION: { right: 'CORRECTION', automated: true, requiresReview: false, deliverable: 'envelope' },
  OBJECTION: { right: 'OBJECTION', automated: false, requiresReview: true, deliverable: 'envelope' },
  DELETION: { right: 'DELETION', automated: false, requiresReview: true, deliverable: 'envelope' },
  PORTABILITY: { right: 'PORTABILITY', automated: true, requiresReview: false, deliverable: 'file' },
};

export function classifyRight(right: PrivacyRight): RightProfile {
  return RIGHT_PROFILES[right];
}

export function isPrivacyRight(value: string): value is PrivacyRight {
  return (PRIVACY_RIGHTS as readonly string[]).includes(value);
}

/** Any authenticated natural person may raise a rights request; service and
 *  privileged roles cannot (they are not data subjects on their own accounts). */
export function canCreateRequest(right: PrivacyRight, requesterRoles: string[]): boolean {
  if (!isPrivacyRight(right)) return false;
  if (!Array.isArray(requesterRoles) || requesterRoles.length === 0) return true;
  return !requesterRoles.some((r) => IGNORED_ROLES.has(r));
}

/** Fields a data subject may correct directly (profile-level). Email changes
 *  require re-verification; email is included as requestable via review. */
export function correctionEditableFields(payload: Record<string, unknown>): {
  allowed: string[];
  rejected: string[];
  normalized: Record<string, unknown>;
} {
  const allowed = ['full_name', 'phone_number', 'country_code'];
  const rejected: string[] = [];
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (!allowed.includes(key)) {
      rejected.push(key);
      continue;
    }
    if (key === 'full_name' && typeof value === 'string' && value.trim().length >= 2) {
      normalized[key] = value.trim();
    } else if (key === 'phone_number' && typeof value === 'string') {
      const phone = value.trim().replace(/[^0-9+]/g, '');
      if (phone.length >= 7 && phone.length <= 20) normalized[key] = phone;
    } else if (
      key === 'country_code' &&
      typeof value === 'string' &&
      /^[A-Za-z]{2}$/.test(value)
    ) {
      normalized[key] = value.toUpperCase();
    } else {
      rejected.push(key);
    }
  }
  return { allowed: allowed.filter((k) => k in normalized), rejected, normalized };
}

/** The honest deletion outcome: which data stores can be erased vs which are
 *  legally retained with personal linkage broken (financial records must keep
 *  their accounting integrity). Returned as a partition plan. */
export function deletionOutcomePlan(): {
  erasable: string[];
  anonymizable: string[];
  retained: string[];
} {
  return {
    erasable: [
      'auth.providers',
      'auth.refresh_tokens',
      'users.profiles',
      'billing.wallets',
      'auth.users', // account record itself, after dependent anonymization
    ],
    // TEXT-keyed telemetry that can be rewritten to a deleted: marker.
    anonymizable: [
      'billing.sessions', // customer_id + hardware_id → DELETED marker
    ],
    retained: [
      'payments.transactions', // UUID-keyed financial record: pseudonymous UUID kept, identity rows removed
      'billing.ledger_entries', // immutable money movement: pseudonymous
      'payments.payouts', // financial record: pseudonymous
      'billing.seller_earnings', // financial record: pseudonymous
      'billing.invoices', // financial record: pseudonymous
      'billing.usage_records', // metering: pseudonymous
      'sessions.routing', // routing record: pseudonymous buyer/seller UUIDs
      'analytics.metrics', // aggregate only — no personal identifiers retained
      'analytics.session_telemetry', // keyed by session id, not person
      'audit.audit_log', // governance log — retains actor_id marker
    ],
  };
}

/** Request lifecycle transitions (owner may withdraw; operator/DPO reviews). */
export function assertRequestTransition(
  fromState: PrivacyRequestState,
  toState: PrivacyRequestState,
  ctx: { requesterIsOwner: boolean; requesterIsReviewer: boolean }
): { ok: boolean; code?: string; message?: string } {
  if (fromState === toState) {
    return { ok: false, code: 'NO_OP_TRANSITION', message: 'Request state unchanged' };
  }
  if (fromState === 'COMPLETED' || fromState === 'REJECTED' || fromState === 'WITHDRAWN') {
    return { ok: false, code: 'TERMINAL_STATE', message: `${fromState} is terminal` };
  }
  // Withdrawal is always owner-scoped; review transitions need a reviewer.
  if (toState === 'WITHDRAWN') {
    if (!ctx.requesterIsOwner) {
      return { ok: false, code: 'OWNERSHIP_REQUIRED', message: 'Only the requester may withdraw a request' };
    }
    return { ok: true };
  }
  if (toState === 'IN_REVIEW' || toState === 'COMPLETED' || toState === 'REJECTED') {
    if (!ctx.requesterIsReviewer) {
      return { ok: false, code: 'FORBIDDEN_ROLE', message: 'Requires a reviewer/DPO role' };
    }
    return { ok: true };
  }
  return { ok: false, code: 'TRANSITION_NOT_ALLOWED', message: `${fromState} -> ${toState} not allowed` };
}