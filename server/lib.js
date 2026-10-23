// Utilidades compartidas por las Pages Functions.

export const SESSION_COOKIE = 'relab_session';
export const SESSION_DAYS = 30;
export const MAX_TEXT = 100_000;

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export const getCookie = (request, name) => {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(/;\s*/)) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
};

export const setCookie = (name, value, maxAge) =>
  `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

const b64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const randomToken = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));

export const sha256 = async str => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return new Uint8Array(buf);
};
export const sha256Hex = async str => [...(await sha256(str))].map(b => b.toString(16).padStart(2, '0')).join('');
export const pkceChallenge = async verifier => b64url(await sha256(verifier));

export const redirect = (location, cookies = []) => {
  const headers = new Headers({ location, 'cache-control': 'no-store' });
  cookies.forEach(c => headers.append('set-cookie', c));
  return new Response(null, { status: 302, headers });
};

export async function getUser(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const hash = await sha256Hex(token);
  return env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.picture, u.current_text FROM sessions s
     JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`
  ).bind(hash, Date.now()).first();
}

// Devuelve el usuario o una Response 401 para cortar el handler.
export async function requireUser(context) {
  const user = await getUser(context.request, context.env);
  return user || json({ error: 'unauthorized' }, 401);
}

export const readJson = async request => {
  try { return await request.json(); } catch { return null; }
};

// Solo rutas internas ("/textoenredes/"), nunca "//otro-sitio" ni URLs absolutas.
export const safeReturn = p => (typeof p === 'string' && /^\/(?![\/\\])[\w\-\/]*$/.test(p) ? p : '/');

export const validId = id => typeof id === 'string' && /^[\w-]{1,64}$/.test(id);
export const validText = (t, max = MAX_TEXT) => typeof t === 'string' && t.length <= max;
