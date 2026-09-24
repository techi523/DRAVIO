// Audit event PRODUCER for the dm.audit.log topic (consumed by
// backend/src/modules/audit which persists into audit.audit_log).
// Events are constructed by the pure module so sensitive field REDACTION is
// enforced before anything reaches the wire or the audit_store.

import { sendEvent } from '../../events/kafka.js';
import { buildAuditEvent, AuditAction } from '../compliance/pure/audit-events.js';

export const AUDIT_TOPIC = 'dm.audit.log';

export interface EmitAuditInput {
  actor_id?: string | null;
  action: AuditAction;
  service: string;
  resource_type: string;
  resource_id?: string | null;
  metadata?: Record<string, unknown>;
}

/** Build a sanitized audit event and publish it (non-fatal on Kafka absence). */
export async function emitAudit(input: EmitAuditInput): Promise<void> {
  try {
    const event = buildAuditEvent({
      actor_id: input.actor_id ?? null,
      action: input.action,
      service: input.service,
      resource_type: input.resource_type,
      resource_id: input.resource_id ?? null,
      metadata: input.metadata || {},
    });
    await sendEvent(AUDIT_TOPIC, `${event.resource_type}:${event.resource_id ?? ''}`, event);
  } catch (err) {
    console.warn('[Audit] Failed to emit audit event (non-fatal):', err);
  }
}