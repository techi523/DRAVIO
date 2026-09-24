import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';

const { buildTestApp } = await import('./helpers/test-app.js');
const { requireRoles } = await import('../src/modules/admin/middleware/rbac.js');

test('unauthenticated request is rejected with 401 (no fabricated admin)', async () => {
  const app = await buildTestApp(requireRoles(['SUPER_ADMIN']));
  const res = await app.inject({ method: 'GET', url: '/admin/x' });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test('a normal buyer cannot access admin endpoints (403)', async () => {
  const app = await buildTestApp(requireRoles(['SUPER_ADMIN']));
  const token = app.jwt.sign({ sub: 'user-1', roles: ['BUYER'] });
  const res = await app.inject({ method: 'GET', url: '/admin/x', headers: { authorization: `Bearer ${token}` } });
  assert.equal(res.statusCode, 403);
  await app.close();
});

test('a token holding SUPER_ADMIN role is allowed', async () => {
  const app = await buildTestApp(requireRoles(['SUPER_ADMIN']));
  const token = app.jwt.sign({ sub: 'admin-1', roles: ['SUPER_ADMIN'] });
  const res = await app.inject({ method: 'GET', url: '/admin/x', headers: { authorization: `Bearer ${token}` } });
  assert.equal(res.statusCode, 200);
  await app.close();
});

test('a token holding the generic ADMIN role is allowed on any admin function', async () => {
  const app = await buildTestApp(requireRoles(['SECURITY_ADMIN', 'SUPPORT_AGENT']));
  const token = app.jwt.sign({ sub: 'admin-2', roles: ['ADMIN'] });
  const res = await app.inject({ method: 'GET', url: '/admin/x', headers: { authorization: `Bearer ${token}` } });
  assert.equal(res.statusCode, 200);
  await app.close();
});

test('a tampered token is rejected (401)', async () => {
  const app = await buildTestApp(requireRoles(['SUPER_ADMIN']));
  const token = app.jwt.sign({ sub: 'admin-3', roles: ['SUPER_ADMIN'] });
  // Corrupt the signature so verification must fail.
  const tampered = token.slice(0, -3) + 'abc';
  const res = await app.inject({ method: 'GET', url: '/admin/x', headers: { authorization: `Bearer ${tampered}` } });
  assert.equal(res.statusCode, 401);
  await app.close();
});