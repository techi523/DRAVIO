// Audit event construction + PII/token sanitization for the dm.audit.log topic.
// Pure module: NO DB/IO imports. Producers build events here; the Kafka consumer
// (backend/src/modules/audit) persists them into audit.audit_log (with metadata).

export const AUDIT_ACTIONS = [
  'auth.login.success',
  'auth.login.failure',
  'auth.register',
  'payment.initiate',
  'payment.completed',
  'payment.transition',
  'payment.payout.request',
  'privacy.request.create',
  'privacy.request.transition',
  'provider.intake.submit',
  'policy.acceptance.record',
  'policy.gate.enforce',
  'session.start',
  'session.end',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditEvent {
  actor_id: string | null;
  action: AuditAction;
  service: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
}

const SENSITIVE_KEY_PATTERN = /(password|token|secret|api[_-]?key|authorization|cookie|session_token)/i;

/** Strip sensitive keys before persisting anything to the audit trail. */
export function sanitizeMetadata(
  metadata: Record<string, unknown>,
  depth = 0
): Record<string, unknown> {
  if (depth > 6) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata || {})) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      out[key] = '[REDACTED]';
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = sanitizeMetadata(value as Record<string, unknown>, depth + 1);
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function buildAuditEvent(input: {
  actor_id?: string | null;
  action: AuditAction;
  service: string;
  resource_type: string;
  resource_id?: string | null;
  metadata?: Record<string, unknown>;
}): AuditEvent {
  if (!AUDIT_ACTIONS.includes(input.action)) {
    throw new Error(`UNKNOWN_AUDIT_ACTION: ${input.action}`);
  }
  if (!input.service || !input.resource_type) {
    throw new Error('AUDIT_EVENT_INVALID: service and resource_type are required');
  }
  return {
    actor_id: input.actor_id ?? null,
    action: input.action,
    service: input.service,
    resource_type: input.resource_type,
    resource_id: input.resource_id ?? null,
    metadata: sanitizeMetadata(input.metadata || {}),
  };
}