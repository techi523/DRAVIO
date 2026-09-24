import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { sendSuccess, sendError } from '../payment/utils/response.js';
import { validateIntake } from '../compliance/pure/provider-intake.js';
import { assertCountryAllowed } from '../compliance/pure/sanctions.js';
import { providerIntakeRepository } from '../compliance/repositories/provider-intake.repository.js';
import { emitAudit } from '../audit/producer.js';

export async function registerProviderRoutes(fastify: FastifyInstance) {
  // SELLER-gated onboarding intake. Verification field requirements are
  // config-driven (provider-intake pure module); no fabricated statutory claims.
  fastify.post('/v1/provider/intake', { preHandler: [fastify.authorize(['SELLER'])] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { provider_type?: string; verification?: Record<string, unknown> } | undefined;
    const providerType = (body?.provider_type || '').toUpperCase();
    const payload = body?.verification || {};
    const userId = (request.user as any).sub;

    const verdict = validateIntake(providerType, payload);
    if (!verdict.ok) {
      return sendError(reply, 'VALIDATION_FAILED', 400, {
        errors: verdict.errors,
      });
    }

    if (payload.country_code) {
      try {
        assertCountryAllowed(payload.country_code as string);
      } catch {
        return sendError(reply, 'COUNTRY_RESTRICTED', 403);
      }
    }

    try {
      const created = await providerIntakeRepository.create(userId, providerType, verdict.normalized);
      if (!created) return sendError(reply, 'INTAKE_CREATE_FAILED', 500);
      await emitAudit({
        actor_id: userId,
        action: 'provider.intake.submit',
        service: 'provider',
        resource_type: 'provider_intake',
        resource_id: created.id,
        metadata: { provider_type: providerType },
      });
      return sendSuccess(reply, {
        id: created.id,
        provider_type: created.provider_type,
        status: created.status,
        created_at: created.created_at,
      }, 201);
    } catch (err: any) {
      fastify.log.error('[provider/intake]', err);
      return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
    }
  });

  // Own intake submissions only.
  fastify.get('/v1/provider/intake', { preHandler: [(req, reply) => fastify.authenticate(req, reply)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request.user as any).sub;
    try {
      const submissions = await providerIntakeRepository.listOwn(userId);
      return sendSuccess(reply, {
        submissions: submissions.map((s) => ({
          id: s.id,
          provider_type: s.provider_type,
          status: s.status,
          rejection_reason: s.rejection_reason,
          created_at: s.created_at,
        })),
      });
    } catch (err: any) {
      fastify.log.error('[provider/intake]', err);
      return sendError(reply, 'INTERNAL_SERVER_ERROR', 500);
    }
  });
}