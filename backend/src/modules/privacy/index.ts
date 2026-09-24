import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { sendSuccess, sendError } from '../payment/utils/response.js';
import {
  PRIVACY_RIGHTS,
  canCreateRequest,
  correctionEditableFields,
  assertRequestTransition,
} from '../compliance/pure/privacy-rights.js';
import { privacyRequestRepository } from '../compliance/repositories/privacy.repository.js';
import { privacyService, auditPrivacyEvent } from './services/privacy.service.js';

export async function registerPrivacyRoutes(fastify: FastifyInstance) {
  // Data subject (self) — create a rights request (ACCESS/CORRECTION/
  // OBJECTION/DELETION/PORTABILITY). Only the authenticated subject's own
  // records are ever touched.
  fastify.post('/v1/privacy/requests', { preHandler: [(req, reply) => fastify.authenticate(req, reply)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { right_type?: string; payload?: Record<string, unknown> };
    const rightType = (body?.right_type || '').toUpperCase();
    const userId = (request.user as any).sub;
    const roles: string[] = (request.user as any).roles || [];

    if (!PRIVACY_RIGHTS.includes(rightType as any)) {
      return sendError(reply, 'VALIDATION_FAILED', 400, { right_type: 'UNSUPPORTED_RIGHT' });
    }
    if (!canCreateRequest(rightType as any, roles)) {
      return sendError(reply, 'FORBIDDEN', 403);
    }

    let payload = body?.payload || {};
    if (rightType === 'CORRECTION') {
      const { normalized, rejected } = correctionEditableFields(payload);
      if (Object.keys(normalized).length === 0) {
        return sendError(reply, 'VALIDATION_FAILED', 400, { fields: rejected });
      }
      payload = normalized;
    }

    try {
      const created = await privacyRequestRepository.create(userId, rightType, payload);
      if (!created) return sendError(reply, 'REQUEST_CREATE_FAILED', 500);
      await auditPrivacyEvent({
        actor_id: userId,
        action: 'privacy.request.create',
        resourceId: created.id,
        metadata: { right_type: rightType, payload },
      });
      return sendSuccess(reply, { id: created.id, status: created.status, right_type: created.right_type }, 201);
    } catch (err: any) {
      fastify.log.error('[privacy/requests]', err);
      return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
    }
  });

  // Own requests only (never a global listing).
  fastify.get('/v1/privacy/requests', { preHandler: [(req, reply) => fastify.authenticate(req, reply)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request.user as any).sub;
    try {
      const requests = await privacyRequestRepository.listOwn(userId);
      return sendSuccess(reply, {
        requests: requests.map((r) => ({
          id: r.id,
          right_type: r.right_type,
          status: r.status,
          created_at: r.created_at,
        })),
      });
    } catch (err: any) {
      fastify.log.error('[privacy/requests]', err);
      return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
    }
  });

  fastify.get('/v1/privacy/requests/:id', { preHandler: [(req, reply) => fastify.authenticate(req, reply)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const userId = (request.user as any).sub;
    try {
      const found = await privacyRequestRepository.findOwnedById(id, userId);
      if (!found) return sendError(reply, 'REQUEST_NOT_FOUND', 404);
      return sendSuccess(reply, found);
    } catch (err: any) {
      fastify.log.error('[privacy/requests/:id]', err);
      return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
    }
  });

  // Owner withdraws their own pending/in-review request.
  fastify.post('/v1/privacy/requests/:id/withdraw', { preHandler: [(req, reply) => fastify.authenticate(req, reply)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const userId = (request.user as any).sub;
    try {
      const found = await privacyRequestRepository.findOwnedById(id, userId);
      if (!found) return sendError(reply, 'REQUEST_NOT_FOUND', 404);

      const gate = assertRequestTransition(found.status as any, 'WITHDRAWN', {
        requesterIsOwner: true,
        requesterIsReviewer: false,
      });
      if (!gate.ok) return sendError(reply, gate.code || 'TRANSITION_NOT_ALLOWED', 409);

      const updated = await privacyRequestRepository.transition(id, found.status, 'WITHDRAWN', null, { withdrawn_by: userId });
      if (!updated) return sendError(reply, 'TRANSITION_CONFLICT', 409);
      await auditPrivacyEvent({ actor_id: userId, action: 'privacy.request.transition', resourceId: id, metadata: { from: found.status, to: 'WITHDRAWN' } });
      return sendSuccess(reply, updated);
    } catch (err: any) {
      fastify.log.error('[privacy/withdraw]', err);
      return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
    }
  });

  // Reviewer/DPO workflow: IN_REVIEW / COMPLETED / REJECTED.
  // DELETION fulfillment (COMPLETED) triggers the REAL erasure plan.
  fastify.post('/v1/privacy/requests/:id/review', { preHandler: [fastify.authorize(['ADMIN', 'BILLING_ADMIN'])] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const reviewerId = (request.user as any).sub;
    const body = request.body as { action?: 'IN_REVIEW' | 'COMPLETED' | 'REJECTED'; reason?: string };
    const toState = (body?.action || '').toUpperCase() as 'IN_REVIEW' | 'COMPLETED' | 'REJECTED';

    try {
      const target = await privacyRequestRepository.findById(id);
      if (!target) return sendError(reply, 'REQUEST_NOT_FOUND', 404);

      const gate = assertRequestTransition(target.status as any, toState, {
        requesterIsOwner: false,
        requesterIsReviewer: true,
      });
      if (!gate.ok) return sendError(reply, gate.code || 'TRANSITION_NOT_ALLOWED', 409);

      let outcome: Record<string, unknown> | null = null;
      if (toState === 'COMPLETED') {
        if (target.right_type === 'DELETION') {
          const deletion = await privacyService.applyDeletion(target.requester_id);
          outcome = { deletion };
        } else if (target.right_type === 'ACCESS' || target.right_type === 'PORTABILITY') {
          const envelope = await privacyService.collectAccessEnvelope(target.requester_id);
          outcome = { access_envelope: envelope };
        }
      } else if (toState === 'REJECTED') {
        outcome = { reason: body?.reason || 'NO_REASON_PROVIDED', review: 'manual' };
      }

      const updated = await privacyRequestRepository.transition(id, target.status, toState, reviewerId, outcome);
      if (!updated) return sendError(reply, 'TRANSITION_CONFLICT', 409);
      await auditPrivacyEvent({ actor_id: reviewerId, action: 'privacy.request.transition', resourceId: id, metadata: { from: target.status, to: toState, right_type: target.right_type } });
      return sendSuccess(reply, updated);
    } catch (err: any) {
      fastify.log.error('[privacy/review]', err);
      return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
    }
  });
}