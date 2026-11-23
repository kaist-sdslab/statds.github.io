import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../integrations/cloudflare/worker.mjs';

const endpoint = 'https://sds-cms-auth.sdslab486.workers.dev';
const env = {
  GITHUB_CLIENT_ID: 'test-client',
  GITHUB_CLIENT_SECRET: 'test-secret',
  GITHUB_REPO: 'example/cms',
  CMS_ORIGIN: 'https://example.com',
};
const token = { access_token: 'test-token', scope: 'public_repo' };

async function signIn() {
  const response = await worker.fetch(new Request(`${endpoint}/auth`), env);
  assert.equal(response.status, 302);
  const authorize = new URL(response.headers.get('location'));
  assert.equal(authorize.href.split('?')[0], 'https://github.com/login/oauth/authorize');
  assert.equal(authorize.searchParams.get('redirect_uri'), `${endpoint}/callback`);
  assert.equal(authorize.searchParams.get('scope'), 'public_repo');
  assert.equal(authorize.searchParams.get('code_challenge_method'), 'S256');
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly; Secure; SameSite=Lax/);
  const callback = new URL(`${endpoint}/callback`);
  callback.searchParams.set('state', authorize.searchParams.get('state'));
  callback.searchParams.set('code', 'test-code');
  return new Request(callback, { headers: { Cookie: cookie.split(';')[0] } });
}

test('only the configured OAuth host and valid session can reach GitHub', async t => {
  const upstream = t.mock.method(globalThis, 'fetch');
  assert.equal((await worker.fetch(new Request('https://example.com/auth'), env)).status, 404);
  assert.equal((await worker.fetch(new Request(`${endpoint}/`), env)).status, 404);
  assert.equal((await worker.fetch(new Request(`${endpoint}/callback`), env)).status, 400);
  assert.equal(upstream.mock.callCount(), 0);
});

test('OAuth sends a token only for an account with repository write access', async t => {
  const exchanges = [Response.json(token), Response.json({ permissions: { push: true } })];
  const upstream = t.mock.method(globalThis, 'fetch', () => exchanges.shift());
  const response = await worker.fetch(await signIn(), env);
  assert.equal(response.status, 200);
  assert.equal(upstream.mock.callCount(), 2);
  const [[url, exchange], [repoURL, repo]] = upstream.mock.calls.map(call => call.arguments);
  assert.equal(url, 'https://github.com/login/oauth/access_token');
  assert.equal(exchange.redirect, 'manual');
  assert.equal(exchange.body.get('redirect_uri'), `${endpoint}/callback`);
  assert.match(exchange.body.get('code_verifier'), /^[\w-]{43}$/);
  assert.equal(repoURL, 'https://api.github.com/repos/example/cms');
  assert.equal(repo.redirect, 'manual');
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.match(await response.text(), /authorization:github:success:/);
});

test('GitHub redirects are refused at both OAuth steps', async t => {
  const redirect = () => Response.redirect('https://example.com/');
  const exchanges = [redirect(), Response.json(token), redirect()];
  const upstream = t.mock.method(globalThis, 'fetch', () => exchanges.shift());
  assert.equal((await worker.fetch(await signIn(), env)).status, 502);
  assert.equal((await worker.fetch(await signIn(), env)).status, 403);
  assert.equal(upstream.mock.callCount(), 3);
  assert.ok(upstream.mock.calls.every(({ arguments: [, options] }) => options.redirect === 'manual'));
});

test('tokens with extra scopes or without write access are refused', async t => {
  const exchanges = [
    Response.json({ ...token, scope: 'repo' }),
    Response.json(token),
    Response.json({ permissions: { pull: true, push: false } }),
  ];
  const upstream = t.mock.method(globalThis, 'fetch', () => exchanges.shift());
  assert.equal((await worker.fetch(await signIn(), env)).status, 403);
  assert.equal((await worker.fetch(await signIn(), env)).status, 403);
  assert.equal(upstream.mock.callCount(), 3);
});
