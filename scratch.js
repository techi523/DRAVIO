import Fastify from 'fastify';
import proxy from '@fastify/http-proxy';

const backend = Fastify();
backend.post('/v1/auth/login', async (request, reply) => {
  return { success: true, message: 'reached backend: ' + request.url };
});
backend.post('*', async (request, reply) => {
  return { success: false, message: 'hit wildcard backend: ' + request.url };
});

const gateway = Fastify();
gateway.register(proxy, {
  upstream: 'http://localhost:3001',
  prefix: '/v1/auth',
  rewritePrefix: '/v1/auth',
});

async function run() {
  await backend.listen({ port: 3001 });
  await gateway.listen({ port: 3000 });
  
  try {
    const res = await fetch('http://localhost:3000/v1/auth/login', { method: 'POST' });
    console.log('Status:', res.status);
    console.log('Body:', await res.json());
  } catch (err) {
    console.error(err);
  }
  
  await backend.close();
  await gateway.close();
}

run();
