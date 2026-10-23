import { getCookie, setCookie, redirect, randomToken, sha256Hex, SESSION_COOKIE, SESSION_DAYS } from '../../../server/lib.js';

const clearOauth = [setCookie('tr_oauth_state', '', 0), setCookie('tr_oauth_verifier', '', 0)];
const fail = reason => redirect(`/?login=${reason}`, clearOauth);

const isAllowed = (email, list) => {
  const rules = (list || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!rules.length) return true;
  const e = email.toLowerCase();
  return rules.some(r => (r.startsWith('@') ? e.endsWith(r) : e === r));
};

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const verifier = getCookie(request, 'tr_oauth_verifier');
  if (!code || !state || state !== getCookie(request, 'tr_oauth_state') || !verifier) return fail('error');

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${url.origin}/api/auth/callback`,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  });
  if (!tokenRes.ok) return fail('error');
  const { id_token } = await tokenRes.json();

  // El id_token llega directo de Google por HTTPS, así que alcanza con validar sus claims.
  let claims;
  try {
    const payload = id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(payload), c => c.charCodeAt(0))));
  } catch {
    return fail('error');
  }
  const validIss = ['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss);
  if (!validIss || claims.aud !== env.GOOGLE_CLIENT_ID || !claims.email_verified || claims.exp * 1000 < Date.now()) return fail('error');
  if (!isAllowed(claims.email, env.ALLOWED_EMAILS)) return fail('denied');

  const now = Date.now();
  const name = claims.given_name || claims.name || claims.email.split('@')[0];
  const token = randomToken();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO users (id, email, name, picture, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET email = excluded.email, name = excluded.name, picture = excluded.picture`
    ).bind(claims.sub, claims.email, name, claims.picture || null, now),
    env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
      .bind(await sha256Hex(token), claims.sub, now + SESSION_DAYS * 86400_000),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at < ?').bind(claims.sub, now),
  ]);

  return redirect('/?login=ok', [...clearOauth, setCookie(SESSION_COOKIE, token, SESSION_DAYS * 86400)]);
}
