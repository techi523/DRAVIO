import { paymentRepository } from '../repositories/payment.repository.js';
import { transactionStateRepository } from '../repositories/transaction-state.repository.js';
import { assertTransitionAllowed, SYSTEM_ROLE } from '../core/transaction-machine.js';
import { emitAudit } from '../../audit/producer.js';

export type TransitionKind = 'DISPUTED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'CANCELLED' | 'REVERSED';

interface TransitionInput {
  transactionId: string;
  kind: TransitionKind;
  actorId: string;
  actorRoles: string[];
  reason?: string;
}

/**
 * Authorized, auditable, CAS-guarded transition orchestration.
 * Authorization rules live in the pure state machine; persistence in
 * transaction-state.repository. Every applied transition is emitted to
 * dm.audit.log (REDACTED) and appended to compliance.transaction_events.
 */
export class TransactionService {
  private effectiveRole(actorRoles: string[]): string {
    if (actorRoles.includes('BILLING_ADMIN') || actorRoles.includes('ADMIN')) return 'BILLING_ADMIN';
    if (actorRoles.includes('BUYER')) return 'BUYER';
    if (actorRoles.includes('SELLER')) return 'SELLER';
    return SYSTEM_ROLE;
  }

  async transition(input: TransitionInput): Promise<{ id: string; status: string } | null> {
    const transaction = await paymentRepository.findById(input.transactionId);
    if (!transaction) {
      throw new Error('TRANSACTION_NOT_FOUND');
    }

    const actorRole = this.effectiveRole(input.actorRoles);
    const requesterIsOwner = transaction.user_id === input.actorId;

    assertTransitionAllowed(transaction.status, input.kind, {
      requesterRole: actorRole,
      requesterIsOwner,
    });

    const applied = await transactionStateRepository.applyTransition({
      transactionId: input.transactionId,
      fromStatus: transaction.status,
      toStatus: input.kind,
      actorId: input.actorId,
      actorRole,
      reason: input.reason || null,
      metadata: { transition_kind: input.kind },
    });

    if (applied) {
      await emitAudit({
        actor_id: input.actorId,
        action: 'payment.transition',
        service: 'payment',
        resource_type: 'transaction',
        resource_id: input.transactionId,
        metadata: {
          from: transaction.status,
          to: input.kind,
          reason: input.reason || null,
          amount_usd: transaction.amount_usd,
        },
      });
    }

    return applied;
  }

  async history(transactionId: string): Promise<Array<Record<string, unknown>>> {
    return transactionStateRepository.eventHistory(transactionId);
  }
}

export const transactionService = new TransactionService();