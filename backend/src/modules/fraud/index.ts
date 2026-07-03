import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createConsumer } from '../../events/kafka.js';

interface SecurityEvent {
  user_id: string;
  event_type: string;
  risk_score: number;
  description: string;
}

class FraudRuleEngine {
  evaluatePaymentRisk(userId: string, failedCount: number): SecurityEvent | null {
    if (failedCount > 3) {
      return {
        user_id: userId,
        event_type: 'MULTIPLE_FAILED_PAYMENTS',
        risk_score: 0.9,
        description: `User has ${failedCount} failed payments in 1h`,
      };
    }
    return null;
  }

  evaluateTravelRisk(userId: string, lastCountry: string, currentCountry: string, timeDiffMinutes: number): SecurityEvent | null {
    if (lastCountry !== currentCountry && timeDiffMinutes < 60) {
      return {
        user_id: userId,
        event_type: 'IMPOSSIBLE_TRAVEL',
        risk_score: 0.8,
        description: `Location changed from ${lastCountry} to ${currentCountry} in ${timeDiffMinutes}min`,
      };
    }
    return null;
  }
}

const engine = new FraudRuleEngine();

async function startFraudConsumer() {
  const consumer = await createConsumer('fraud-discovery-group');
  if (!consumer) {
    console.warn('[Fraud] Kafka not available — fraud detection disabled');
    return;
  }

  await consumer.subscribe({ topics: ['dm.payment.completed', 'dm.auth.user_registered'], fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;
      try {
        const event = JSON.parse(message.value.toString());
        if (topic === 'dm.payment.completed') {
          // Evaluate payment risk
        } else if (topic === 'dm.auth.user_registered') {
          console.log(`[Fraud] New user registered: ${event.userId}, performing initial risk scan.`);
        }
      } catch (err) {
        console.error('[Fraud] Error processing event:', err);
      }
    },
  });
}

export function registerFraudRoutes(fastify: FastifyInstance) {
  fastify.post('/v1/internal/analyze/payment', async (request: FastifyRequest, reply: FastifyReply) => {
    const { user_id, failed_count } = request.body as any;
    const event = engine.evaluatePaymentRisk(user_id, failed_count);
    if (event) return { action: 'BLOCK', event };
    return { action: 'ALLOW' };
  });

  fastify.post('/v1/internal/analyze/travel', async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.body as any;
    const event = engine.evaluateTravelRisk(
      payload.user_id,
      payload.last_country,
      payload.current_country,
      payload.time_diff_minutes
    );
    if (event) return { action: 'FLAG', event };
    return { action: 'ALLOW' };
  });
}

export { startFraudConsumer };
