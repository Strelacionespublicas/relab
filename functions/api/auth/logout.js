import { getCookie, setCookie, sha256Hex, SESSION_COOKIE } from '../../../server/lib.js';

export async function onRequestPost({ request, env }) {
  const token = getCookie(request, SESSION_COOKIE);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
  return new Response(null, { status: 204, headers: { 'set-cookie': setCookie(SESSION_COOKIE, '', 0) } });
}
