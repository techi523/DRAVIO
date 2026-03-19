import Fastify from 'fastify';
import { PaymentIntent } from '@dravio/shared-ts';

const fastify = Fastify({ logger: true });

fastify.post('/payment/intent', async (request, reply) => {
  const { amount, userId } = request.body as any;
  // Mock Stripe Payment Intent creation
  const intent: PaymentIntent = {
    id: `pi_${Math.random().toString(36).substring(7)}`,
    userId,
    amount,
    currency: 'USD',
    status: 'pending'
  };
  return intent;
});

fastify.listen({ port: 3005, host: '0.0.0.0' });
