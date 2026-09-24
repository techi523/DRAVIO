import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import axios from 'axios';
import { verifySignature, resolveSecret } from './security.js';

interface ISPPackage {
  external_package_id: string;
  name: string;
  data_amount_mb: number;
  validity_hours: number;
  price_amount: number;
  price_currency: string;
  available: boolean;
}

interface ActivationResponse {
  success: boolean;
  activation_id?: string;
  activated_at?: string;
  current_ip?: string;
  error?: string;
}

interface UsageResponse {
  activation_id: string;
  bytes_used: number;
  bytes_remaining: number;
  session_active: boolean;
}

class ProductionAdapter {
  private baseUrl: string;
  private apiKey: string;
  private headers: Record<string, string>;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.headers = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async listPackages(): Promise<ISPPackage[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/v1/packages`, {
        headers: this.headers,
        timeout: 10000,
      });
      return (response.data.packages || []).map((p: any) => ({
        external_package_id: p.id,
        name: p.name,
        data_amount_mb: p.data_amount_mb || 1000,
        validity_hours: p.validity_hours || 24,
        price_amount: p.price_amount || 5.0,
        price_currency: p.price_currency || 'USD',
        available: p.available !== false,
      }));
    } catch (err) {
      console.error('[ISP Adapter] listPackages failed:', err);
      return [];
    }
  }

  async activateData(customerId: string, packageId: string, reference: string): Promise<ActivationResponse> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/v1/provisioning/activate`,
        { customer_id: customerId, package_id: packageId, reference },
        { headers: this.headers, timeout: 15000 }
      );
      const data = response.data;
      return {
        success: true,
        activation_id: data.activation_id || crypto.randomUUID(),
        activated_at: new Date().toISOString(),
        current_ip: data.current_ip || '0.0.0.0',
      };
    } catch (err: any) {
      console.error('[ISP Adapter] activateData failed:', err);
      return { success: false, error: `Activation failed: ${err.message}` };
    }
  }

  async checkUsage(activationId: string): Promise<UsageResponse> {
    try {
      const response = await axios.get(`${this.baseUrl}/v1/usage/${activationId}`, {
        headers: this.headers,
        timeout: 10000,
      });
      const data = response.data;
      return {
        activation_id: activationId,
        bytes_used: data.bytes_used || 0,
        bytes_remaining: data.bytes_remaining || 0,
        session_active: data.session_active || false,
      };
    } catch (err: any) {
      console.error('[ISP Adapter] checkUsage failed:', err);
      return { activation_id: activationId, bytes_used: 0, bytes_remaining: 0, session_active: false };
    }
  }
}

const adapters: Record<string, ProductionAdapter> = {};

function getAdapter(ispId: string): ProductionAdapter | undefined {
  if (!adapters[ispId]) {
    const baseUrl = process.env[`ISP_${ispId.toUpperCase()}_BASE_URL`] || 'https://api.upstream-isp.com';
    const apiKey = process.env[`ISP_${ispId.toUpperCase()}_API_KEY`] || '';
    if (baseUrl && apiKey) {
      adapters[ispId] = new ProductionAdapter(baseUrl, apiKey);
    }
  }
  return adapters[ispId];
}

export function registerISPRoutes(fastify: FastifyInstance) {
  fastify.get('/v1/isp/:ispId/packages', async (request: FastifyRequest, reply: FastifyReply) => {
    const { ispId } = request.params as any;
    const adapter = getAdapter(ispId);
    if (!adapter) return reply.status(404).send({ error: 'ISP_NOT_FOUND' });
    const packages = await adapter.listPackages();
    return { packages };
  });

  fastify.post(
    '/v1/isp/:ispId/activate',
    { preHandler: [(req, reply) => fastify.authenticate(req, reply)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { ispId } = request.params as any;
      const adapter = getAdapter(ispId);
      if (!adapter) return reply.status(404).send({ error: 'ISP_NOT_FOUND' });
      const { customer_id, package_id, reference } = request.body as any;
      return await adapter.activateData(customer_id, package_id, reference);
    }
  );

  fastify.get(
    '/v1/isp/:ispId/usage/:activationId',
    { preHandler: [(req, reply) => fastify.authenticate(req, reply)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { ispId, activationId } = request.params as any;
      const adapter = getAdapter(ispId);
      if (!adapter) return reply.status(404).send({ error: 'ISP_NOT_FOUND' });
      return await adapter.checkUsage(activationId);
    }
  );

  fastify.post('/v1/isp/webhook/:ispId/usage', async (request: FastifyRequest, reply: FastifyReply) => {
    const { ispId } = request.params as any;
    const body = request.body;
    const secret = process.env[`ISP_${ispId.toUpperCase()}_SECRET`];
    const signature = request.headers['x-isp-signature'] as string;

    // Fail CLOSED: a caller that can't prove knowledge of the webhook secret
    // must NOT be trusted with usage data. There is intentionally NO default
    // secret fallback in this handler — if the secret is not provisioned we
    // answer 503 so an operator provisions it rather than silently accepting
    // unsigned usage callbacks.
    if (!secret) {
      fastify.log.warn(`[ISP] Webhook secret for ${ispId} is not configured; rejecting callback.`);
      return reply.status(503).send({ error: 'ISP_WEBHOOK_SECRET_NOT_CONFIGURED' });
    }

    if (!signature) {
      return reply.status(401).send({ error: 'MISSING_SIGNATURE' });
    }

    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    if (!verifySignature(payload, signature, secret)) {
      fastify.log.warn(`[ISP] Webhook signature mismatch from ${ispId}; rejecting.`);
      return reply.status(403).send({ error: 'INVALID_SIGNATURE' });
    }

    fastify.log.info(`[ISP] Received usage webhook from ${ispId} (signature verified).`);
    return { status: 'received' };
  });
}

export { ProductionAdapter, ISPPackage, ActivationResponse, UsageResponse };
