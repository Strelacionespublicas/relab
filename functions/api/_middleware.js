import { json } from '../../server/lib.js';
import { MissingKeyError } from '../../server/crypto.js';

// Corta pedidos que modifican datos desde otro origen y atrapa errores inesperados.
export async function onRequest(context) {
  const { request } = context;
  if (!['GET', 'HEAD'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return json({ error: 'forbidden' }, 403);
  }
  try {
    return await context.next();
  } catch (err) {
    // Sin TEXT_KEY no se guarda nada: nunca se escribe contenido sin cifrar.
    if (err instanceof MissingKeyError) return json({ error: 'config' }, 503);
    console.error(err);
    return json({ error: 'server_error' }, 500);
  }
}
