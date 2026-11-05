import { requireUser, readJson, validId, json } from '../../../server/lib.js';
import { encryptText, decryptText } from '../../../server/crypto.js';

// Avance guardado de un recurso (por ejemplo el checklist): un JSON por persona y recurso, cifrado.
//
// Versión: `updated_at` hace de número de versión. Cada escritura lo deja en MAX(ahora, anterior + 1),
// así que crece siempre y no se repite aunque haya dos escrituras en el mismo milisegundo o el reloj
// del Worker vaya atrás. El PUT acepta `baseUpdatedAt` (la versión que leyó el cliente) y solo guarda si
// sigue siendo la actual; si no, responde 409. La comprobación y la escritura son una sola sentencia.
// Sin `baseUpdatedAt` (clientes anteriores, otros recursos) se guarda como siempre.
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
    // Cifrado con una clave anterior: se empieza de cero, pero con la versión, para poder reemplazarlo.
    return json({ data: null, updatedAt: row.updated_at });
  }
}

// null = "no tenía nada guardado"; un entero no negativo = la versión leída.
const validVersion = v => v === null || (Number.isSafeInteger(v) && v >= 0);

export async function onRequestPut(context) {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const resource = String(context.params.resource);
  const body = await readJson(context.request);
  const str = body && JSON.stringify(body.data ?? null);
  if (!validId(resource) || !str || str.length > MAX_STATE) return json({ error: 'invalid' }, 400);
  const checked = body && Object.prototype.hasOwnProperty.call(body, 'baseUpdatedAt');
  if (checked && !validVersion(body.baseUpdatedAt)) return json({ error: 'invalid_version' }, 400);

  const { DB } = context.env;
  const data = await encryptText(context.env, str);
  const now = Date.now();
  let stmt;
  if (!checked) {
    stmt = DB.prepare(
      `INSERT INTO resource_state (user_id, resource, data, updated_at) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(user_id, resource) DO UPDATE SET data = excluded.data, updated_at = MAX(excluded.updated_at, resource_state.updated_at + 1)
       RETURNING updated_at`
    ).bind(user.id, resource, data, now);
  } else if (body.baseUpdatedAt === null) {
    stmt = DB.prepare(
      `INSERT INTO resource_state (user_id, resource, data, updated_at) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(user_id, resource) DO NOTHING
       RETURNING updated_at`
    ).bind(user.id, resource, data, now);
  } else {
    stmt = DB.prepare(
      `UPDATE resource_state SET data = ?1, updated_at = MAX(?2, updated_at + 1)
       WHERE user_id = ?3 AND resource = ?4 AND updated_at = ?5
       RETURNING updated_at`
    ).bind(data, now, user.id, resource, body.baseUpdatedAt);
  }
  const row = await stmt.first();
  if (!row) return json({ error: 'conflict' }, 409);
  return json({ ok: true, updatedAt: row.updated_at });
}
