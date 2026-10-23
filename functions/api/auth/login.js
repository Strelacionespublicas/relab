import { randomToken, pkceChallenge, redirect, setCookie } from '../../../server/lib.js';

// Arranca el login con Google (OAuth 2.0 + PKCE).
export async function onRequestGet({ request, env }) {
  const origin = new URL(request.url).origin;
  const state = randomToken(16);
  const verifier = randomToken(48);
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${origin}/api/auth/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, [
    setCookie('tr_oauth_state', state, 600),
    setCookie('tr_oauth_verifier', verifier, 600),
  ]);
}
