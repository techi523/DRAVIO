// Data retention registry (category → purpose/lawful basis/duration/deletability).
// Pure module mirroring the seeded compliance.retention_rules table. NO DB/IO.
// Durations here are CONFIGURATION (to be validated by qualified counsel), never
// claimed legal minimums.

export interface RetentionRule {
  category: string;
  purpose: string;
  durationDays: number | null;
  lawfulBasis: string;
  legallyRetained: boolean;
  autoDeletable: boolean;
  notes: string;
}

export const RETENTION_REGISTRY: ReadonlyArray<RetentionRule> = [
  {
    category: 'auth.credentials',
    purpose: 'Account authentication identity',
    durationDays: 36500,
    lawfulBasis: 'Contract — issue and support',
    legallyRetained: false,
    autoDeletable: true,
    notes: 'Erasable via the data-deletion workflow; removed after account deletion.',
  },
  {
    category: 'auth.social_providers',
    purpose: 'Linked identity providers used to authenticate',
    durationDays: 36500,
    lawfulBasis: 'Contract — issue and support',
    legallyRetained: false,
    autoDeletable: true,
    notes: 'Removed on account deletion.',
  },
  {
    category: 'auth.refresh_tokens',
    purpose: 'Session refresh material (stored hashed)',
    durationDays: 30,
    lawfulBasis: 'Security — session management',
    legallyRetained: false,
    autoDeletable: true,
    notes: 'Short-lived; revoked on logout.',
  },
  {
    category: 'payments.transactions',
    purpose: 'Payment execution records',
    durationDays: 7300,
    lawfulBasis: 'Legal requirement — accounting',
    legallyRetained: true,
    autoDeletable: false,
    notes: 'Financially significant records legally retained; linkage anonymized on deletion.',
  },
  {
    category: 'billing.ledger_entries',
    purpose: 'Immutable money-movement audit trail',
    durationDays: null,
    lawfulBasis: 'Legal requirement — accounting',
    legallyRetained: true,
    autoDeletable: false,
    notes: 'Append-only; retained for accounting/audit.',
  },
  {
    category: 'billing.wallets',
    purpose: 'Pre-funded wallet balances',
    durationDays: 36500,
    lawfulBasis: 'Contract — service provision',
    legallyRetained: false,
    autoDeletable: true,
    notes: 'Escrow/balance removed on account deletion.',
  },
  {
    category: 'billing.seller_earnings',
    purpose: 'Seller earnings entitlement records',
    durationDays: 7300,
    lawfulBasis: 'Contract and accounting',
    legallyRetained: true,
    autoDeletable: false,
    notes: 'Retained; anonymized on deletion.',
  },
  {
    category: 'payments.payouts',
    purpose: 'Payout request records',
    durationDays: 7300,
    lawfulBasis: 'Contract and accounting',
    legallyRetained: true,
    autoDeletable: false,
    notes: 'Retained; anonymized on deletion.',
  },
  {
    category: 'sessions.routing',
    purpose: 'Session routing records (buyer/seller linkage)',
    durationDays: 3650,
    lawfulBasis: 'Contract and accounting',
    legallyRetained: true,
    autoDeletable: false,
    notes: 'Retained for billing disputes; anonymized on deletion.',
  },
  {
    category: 'billing.sessions',
    purpose: 'Session telemetry for billing',
    durationDays: 3650,
    lawfulBasis: 'Contract and accounting',
    legallyRetained: true,
    autoDeletable: false,
    notes: 'Retained for billing disputes.',
  },
  {
    category: 'billing.usage_records',
    purpose: 'Usage metering for billing',
    durationDays: 730,
    lawfulBasis: 'Contract and accounting',
    legallyRetained: true,
    autoDeletable: false,
    notes: 'Aggregate billing basis.',
  },
  {
    category: 'analytics.metrics',
    purpose: 'Aggregated product metrics',
    durationDays: null,
    lawfulBasis: 'Legitimate interest — product',
    legallyRetained: true,
    autoDeletable: false,
    notes: 'Aggregate; no personal identifiers retained.',
  },
  {
    category: 'analytics.session_telemetry',
    purpose: 'Session time-series telemetry',
    durationDays: 730,
    lawfulBasis: 'Contract and network operations',
    legallyRetained: true,
    autoDeletable: false,
    notes: 'Keyed by session id; no direct PII.',
  },
  {
    category: 'device.identifier',
    purpose: 'Client-generated hardware UUID',
    durationDays: 3650,
    lawfulBasis: 'Security and fraud prevention',
    legallyRetained: true,
    autoDeletable: false,
    notes: 'Not MAC/IMEI; client-generated UUID.',
  },
  {
    category: 'audit.audit_log',
    purpose: 'Security and compliance audit trail',
    durationDays: 36500,
    lawfulBasis: 'Legal requirement and security',
    legallyRetained: true,
    autoDeletable: false,
    notes: 'Append-only governance log.',
  },
];

export function retentionFor(category: string): RetentionRule | undefined {
  return RETENTION_REGISTRY.find((r) => r.category === category);
}

export function isLegallyRetained(category: string): boolean {
  const rule = retentionFor(category);
  return rule ? rule.legallyRetained : false;
}

export function retentionCategories(): string[] {
  return RETENTION_REGISTRY.map((r) => r.category);
}