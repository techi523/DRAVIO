import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { sendSuccess, sendError } from '../payment/utils/response.js';
import {
  POLICY_CATALOG,
  validateAcceptance,
  assertSatisfiesGate,
  requiredPoliciesForGate,
  policyById,
} from './pure/policy-registry.js';
import { quoteForAmount, feeStatementLines } from './pure/fee-disclosure.js';
import { RETENTION_REGISTRY } from './pure/retention.js';
import { configuredRestrictedCountries, evaluateCountry } from './pure/sanctions.js';
import { policyAcceptanceRepository } from './repositories/policy-acceptance.repository.js';
import { emitAudit } from '../audit/producer.js';

export async function registerComplianceRoutes(fastify: FastifyInstance) {
  // Public policy catalog (versions = registry of record).
  fastify.get('/v1/compliance/policies', async (_request: FastifyRequest, reply: FastifyReply) => {
    return sendSuccess(reply, {
      policies: POLICY_CATALOG.map((p) => ({
        id: p.id,
        name: p.name,
        version: p.version,
        effective_at: p.effectiveAt,
        required_gates: p.requiredGates,
        doc: p.docPath,
      })),
    });
  });

  // Authenticated data-subject: record acceptance of the CURRENT version only.
  fastify.post('/v1/compliance/acceptance', { preHandler: [(req, reply) => fastify.authenticate(req, reply)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { policy_id?: string; version?: string } | undefined;
    const userId = (request.user as any).sub;
    const policyId = (body?.policy_id || '').toLowerCase();
    const version = body?.version;

    if (!version || typeof version !== 'string') {
      return sendError(reply, 'VALIDATION_FAILED', 400, { version: 'REQUIRED' });
    }
    const verdict = validateAcceptance(policyId, version, new Date().toISOString());
    if (!verdict.ok) {
      return sendError(reply, 'POLICY_ACCEPTANCE_REJECTED', 409, { code: verdict.code });
    }

    try {
      const policy = policyById(policyId)!;
      const accepted = await policyAcceptanceRepository.record({
        userId,
        policyId,
        version,
        ip: (request.ip === '::1' ? '127.0.0.1' : request.ip),
        userAgent: request.headers['user-agent'] || null,
      });
      if (!accepted) {
        return sendSuccess(reply, { id: null, already_accepted: true, policy_id: policyId, version });
      }
      await emitAudit({
        actor_id: userId,
        action: 'policy.acceptance.record',
        service: 'compliance',
        resource_type: 'policy',
        resource_id: `${policyId}:${version}`,
        metadata: { policy_name: policy.name },
      });
      return sendSuccess(reply, { id: accepted.id, policy_id: policyId, version, accepted_at: accepted.accepted_at }, 201);
    } catch (err: any) {
      fastify.log.error('[compliance/acceptance]', err);
      return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
    }
  });

  // Which gates does this subject still need to satisfy before acting?
  fastify.get('/v1/compliance/acceptance/status', { preHandler: [(req, reply) => fastify.authenticate(req, reply)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request.user as any).sub;
    try {
      const rows = await policyAcceptanceRepository.acceptedVersions(userId);
      const acceptances = rows.map((r) => ({ policyId: r.policy_id, version: r.version, acceptedAt: new Date(r.accepted_at).toISOString() }));
      const gates = ['PURCHASE', 'SELL'] as const;
      const result: Record<string, unknown> = { accepted: acceptances };
      for (const gate of gates) {
        const gateResult = assertSatisfiesGate(gate, acceptances);
        result[gate] = {
          satisfied: gateResult.satisfied,
          required: requiredPoliciesForGate(gate),
          missing: gateResult.missing,
        };
      }
      return sendSuccess(reply, result);
    } catch (err: any) {
      fastify.log.error('[compliance/acceptance/status]', err);
      return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
    }
  });

  // Pricing transparency: exact buyer/seller/fee split for a given amount.
  fastify.get('/v1/compliance/fee-disclosure', { preHandler: [(req, reply) => fastify.authenticate(req, reply)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const amount = Number((request.query as any)?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return sendError(reply, 'VALIDATION_FAILED', 400, { amount: 'REQUIRED_POSITIVE_NUMBER' });
    }
    try {
      const quote = quoteForAmount(amount);
      return sendSuccess(reply, { quote, fee_statement: feeStatementLines(amount) });
    } catch (err: any) {
      fastify.log.error('[compliance/fee-disclosure]', err);
      return sendError(reply, 'VALIDATION_FAILED', 400, { amount: err.message });
    }
  });

  // Retention registry (public, informational — the registry of record).
  fastify.get('/v1/compliance/retention', async (_request: FastifyRequest, reply: FastifyReply) => {
    return sendSuccess(reply, {
      registry: RETENTION_REGISTRY.map((r) => ({
        category: r.category,
        purpose: r.purpose,
        duration_days: r.durationDays,
        lawful_basis: r.lawfulBasis,
        legally_retained: r.legallyRetained,
        auto_deletable: r.autoDeletable,
      })),
    });
  });

  // Informational: which restricted jurisdictions are CONFIGURED (never a
  // fabricated sanctions list; empty until counsel-validated and activated).
  fastify.get('/v1/compliance/country-restrictions', async (_request: FastifyRequest, reply: FastifyReply) => {
    const restricted = configuredRestrictedCountries();
    return sendSuccess(reply, {
      restricted_countries: restricted,
      restriction_active: restricted.length > 0,
      note: 'Configured via SANCTIONED_COUNTRIES env or compliance.sanctions_config seed; activation requires counsel validation.',
    });
  });

  // Reusable evaluation (used by providers and future signup gating).
  fastify.get('/v1/compliance/country-check', async (request: FastifyRequest, reply: FastifyReply) => {
    const code = ((request.query as any)?.country || '').toString();
    if (!/^[A-Za-z]{2}$/.test(code)) {
      return sendError(reply, 'VALIDATION_FAILED', 400, { country: 'REQUIRED_ISO_3166_ALPHA_2' });
    }
    const verdict = evaluateCountry(code);
    return sendSuccess(reply, { country: code.toUpperCase(), ...verdict });
  });
}