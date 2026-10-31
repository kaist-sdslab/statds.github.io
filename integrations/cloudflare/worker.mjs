// Decap CMS GitHub OAuth handler for Cloudflare Workers.
// Configure GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, CMS_ORIGIN and GITHUB_REPO.
// Originals and CMS content remain in GitHub; this Worker only handles login.
const COOKIE = '__Host-sds_cms_oauth';
const cookie = value => `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${value ? 600 : 0}`;
const headers = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};
const text = (message, status = 200, extra = {}) => new Response(message, {
  status, headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8', ...extra },
});
const base64url = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const random = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
const equal = (a, b) => {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
};
const scriptValue = value => JSON.stringify(value).replaceAll('<', '\\u003c');
function configuration(env) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.CMS_ORIGIN || !env.GITHUB_REPO) throw new Error('Missing configuration');
  const origin = new URL(env.CMS_ORIGIN);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Invalid CMS origin');
  if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(env.GITHUB_REPO)) throw new Error('Invalid repository');
  const scope = env.GITHUB_SCOPE || 'public_repo';
  if (!['public_repo', 'repo'].includes(scope)) throw new Error('Invalid scope');
  return { origin: origin.origin, scope };
}
function finish(token, origin) {
  const nonce = random();
  const payload = `authorization:github:success:${JSON.stringify({ token, provider: 'github' })}`;
  return new Response(`<!doctype html><meta charset="utf-8"><title>SDS Lab CMS sign-in</title>
<p id="status">Completing sign-in…</p>
<script nonce="${nonce}">
(() => {
  const origin = ${scriptValue(origin)};
  if (!window.opener) {
    document.getElementById('status').textContent = 'Open the CMS and choose Login with GitHub.';
    return;
  }
  const receive = event => {
    if (event.origin !== origin || event.source !== window.opener || event.data !== 'authorizing:github') return;
    window.removeEventListener('message', receive);
    window.opener.postMessage(${scriptValue(payload)}, origin);
    document.getElementById('status').textContent = 'Signed in. You may close this window.';
    window.close();
  };
  window.addEventListener('message', receive);
  window.opener.postMessage('authorizing:github', origin);
})();
</script>`, {
    headers: {
      ...headers,
      'Content-Type': 'text/html; charset=utf-8',
      'Set-Cookie': cookie(''),
      'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`,
    },
  });
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'GET') return text('Method not allowed.', 405, { Allow: 'GET' });
    if (url.pathname === '/') return text('SDS Lab CMS authentication service. Start sign-in from your CMS.');
    if (!['/auth', '/callback'].includes(url.pathname)) return text('Not found.', 404);
    let config;
    try { config = configuration(env); } catch { return text('Complete the Worker Variables and Secrets settings first.', 503); }
    const callback = `${url.origin}/callback`;
    if (url.pathname === '/auth') {
      if ((url.searchParams.get('provider') || 'github') !== 'github') return text('Unsupported provider.', 400);
      const state = random(), verifier = random();
      const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
      const authorize = new URL('https://github.com/login/oauth/authorize');
      authorize.search = new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID, redirect_uri: callback, scope: config.scope,
        state, code_challenge: challenge, code_challenge_method: 'S256',
      }).toString();
      return new Response(null, { status: 302, headers: { ...headers, Location: authorize.href, 'Set-Cookie': cookie(`${state}.${verifier}`) } });
    }
    const clearCookie = { 'Set-Cookie': cookie('') };
    const session = (request.headers.get('Cookie') || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) || '';
    const [expected, verifier] = session.split('.');
    const state = url.searchParams.get('state') || '';
    if (!/^[a-zA-Z0-9_-]{43}$/.test(expected || '') || !/^[a-zA-Z0-9_-]{43}$/.test(verifier || '') || !equal(expected, state)) {
      return text('Sign-in expired or could not be verified. Start again from the CMS.', 400, clearCookie);
    }
    if (url.searchParams.has('error')) return text('GitHub sign-in was not approved. Start again from the CMS.', 401, clearCookie);
    const code = url.searchParams.get('code');
    if (!code || code.length > 512) return text('Missing or invalid authorization code.', 400, clearCookie);
    try {
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000),
        body: new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, redirect_uri: callback, code_verifier: verifier }),
      });
      const result = await response.json();
      if (!response.ok || result.error || typeof result.access_token !== 'string' || !result.access_token) {
        return text('GitHub could not complete sign-in. Check the OAuth App settings and start again.', 502, clearCookie);
      }
      const access = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}`, {
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${result.access_token}`, 'User-Agent': 'SDS-Lab-CMS-Auth', 'X-GitHub-Api-Version': '2022-11-28' },
        signal: AbortSignal.timeout(15000),
      });
      if (!access.ok) return text('This GitHub account cannot access the configured repository.', 403, clearCookie);
      const repository = await access.json();
      if (!repository.permissions?.push && !repository.permissions?.admin) return text('CMS editing requires write access to the GitHub repository.', 403, clearCookie);
      // Expiring access tokens work until expiration; the editor signs in again.
      // Refresh tokens and client secrets are never delivered to the CMS browser.
      return finish(result.access_token, config.origin);
    } catch {
      return text('The sign-in service could not reach GitHub. Start again from the CMS.', 502, clearCookie);
    }
  },
};
