import { json, requireUser } from '../../../server/lib.js';
import { decryptText, MissingKeyError } from '../../../server/crypto.js';

// Datos PRO de la persona (ferias, productos, ventas, stock, configuración), descifrados.
// Leer no requiere PRO vigente: al vencer, todo queda visible y exportable.
// ?since=<ms> trae solo lo cambiado desde ese momento (con margen: el cliente concilia por versión).
const TRASH_MS = 30 * 86_400_000;
const MARGIN_MS = 120_000;

export async function onRequestGet(context) {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const { env, request } = context;
  const since = Number(new URL(request.url).searchParams.get('since')) || 0;
  const now = Date.now();
  const { results } = await env.DB.prepare(
    `SELECT kind, id, version, data, updated_at, deleted_at FROM pro_rows
     WHERE user_id = ? AND updated_at > ? AND (deleted_at IS NULL OR deleted_at > ?)`
  ).bind(user.id, since ? since - MARGIN_MS : 0, now - TRASH_MS).all().catch(() => ({ results: [] }));
  const rows = [];
  let unreadable = 0;
  for (const r of results) {
    try {
      rows.push({ kind: r.kind, id: r.id, version: r.version, updatedAt: r.updated_at, deletedAt: r.deleted_at, data: JSON.parse(await decryptText(env, r.data)) });
    } catch (err) {
      if (err instanceof MissingKeyError) throw err;
      unreadable++; // cifrado con otra clave: no se muestra, pero no rompe el resto
    }
  }
  return json({ rows, now, unreadable });
}
