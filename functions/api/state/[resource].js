import { requireUser, readJson, validId, json } from '../../../server/lib.js';
import { encryptText, decryptText } from '../../../server/crypto.js';

// Avance guardado de un recurso (por ejemplo el checklist): un JSON por persona y recurso, cifrado.
const MAX_STATE = 100_000;

export async function onRequestGet(context) {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const resource = String(context.params.resource);
  if (!validId(resource)) return json({ error: 'invalid' }, 400);
  const row = await context.env.DB.prepare('SELECT data, updated_at FROM resource_state WHERE user_id = ? AND resource = ?')
    .bind(user.id, resource).first();
  if (!row) return json({ data: null });
  try {
    return json({ data: JSON.parse(await decryptText(context.env, row.data)), updatedAt: row.updated_at });
  } catch {
    return json({ data: null }); // cifrado con una clave anterior: se empieza de cero
  }
}

export async function onRequestPut(context) {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const resource = String(context.params.resource);
  const body = await readJson(context.request);
  const str = body && JSON.stringify(body.data ?? null);
  if (!validId(resource) || !str || str.length > MAX_STATE) return json({ error: 'invalid' }, 400);
  await context.env.DB.prepare(
    `INSERT INTO resource_state (user_id, resource, data, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, resource) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
  ).bind(user.id, resource, await encryptText(context.env, str), Date.now()).run();
  return json({ ok: true });
}
