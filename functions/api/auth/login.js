import { randomToken, pkceChallenge, redirect, setCookie, safeReturn } from '../../../server/lib.js';

// Arranca el login con Google (OAuth 2.0 + PKCE). ?return= es el recurso al que se vuelve.
export async function onRequestGet({ request, env }) {
  const origin = new URL(request.url).origin;
  const back = safeReturn(new URL(request.url).searchParams.get('return'));
  // Sin credenciales, Google respondería "invalid_client": mejor avisar en el sitio.
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return redirect(`${back}?login=config`);
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
    setCookie('relab_oauth_state', state, 600),
    setCookie('relab_oauth_verifier', verifier, 600),
    setCookie('relab_oauth_return', back, 600),
  ]);
}
