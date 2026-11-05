import { json, readJson, validId } from '../../../server/lib.js';
import { encryptText } from '../../../server/crypto.js';
import { requirePro } from '../../../server/pro.js';

// Cambios en los datos PRO. Requiere PRO vigente (sin PRO: 403 pro_required y no se escribe nada).
//
// Cada operación es { opId, kind, id, base, data } (crear o editar) o { opId, kind, id, base, delete: true }.
//  - base null = crear. Si el id ya existe, no se pisa nada: es conflicto (salvo que sea el reintento
//    de la misma operación, que se reconoce por opId y se da por aplicada).
//  - base N = editar o borrar la versión N. Si la fila cambió, conflicto con la versión actual.
// Cada operación es una sola sentencia: la comprobación y la escritura no se pueden separar.
export const KINDS = ['feria', 'producto', 'venta', 'stock', 'config'];
const MAX_OPS = 200;
const MAX_DATA = 20_000;
const MAX_ROWS = 50_000;

const validOp = o => o && validId(o.opId) && KINDS.includes(o.kind) && validId(o.id)
  && (o.base === null || (Number.isSafeInteger(o.base) && o.base >= 1))
  && (o.delete === true ? o.base !== null : (o.data && typeof o.data === 'object' && !Array.isArray(o.data)));

export async function onRequestPost(context) {
  const pro = await requirePro(context);
  if (pro instanceof Response) return pro;
  const { user } = pro;
  const { env } = context;
  const body = await readJson(context.request);
  const ops = body?.ops;
  if (!Array.isArray(ops) || !ops.length || ops.length > MAX_OPS) return json({ error: 'invalid' }, 400);

  const results = [];
  let count = null;
  for (const o of ops) {
    if (!validOp(o)) { results.push({ opId: o?.opId ?? null, error: 'invalid' }); continue; }
    const text = o.delete ? null : JSON.stringify(o.data);
    if (text && text.length > MAX_DATA) { results.push({ opId: o.opId, error: 'too_large' }); continue; }
    const now = Date.now();
    let row;
    if (o.base === null) {
      if (count === null) count = (await env.DB.prepare('SELECT COUNT(*) AS n FROM pro_rows WHERE user_id = ?').bind(user.id).first()).n;
      if (count >= MAX_ROWS) { results.push({ opId: o.opId, error: 'limit' }); continue; }
      row = await env.DB.prepare(
        `INSERT INTO pro_rows (user_id, kind, id, version, data, last_op, created_at, updated_at)
         VALUES (?1, ?2, ?3, 1, ?4, ?5, ?6, ?6) ON CONFLICT DO NOTHING RETURNING version, updated_at`
      ).bind(user.id, o.kind, o.id, await encryptText(env, text), o.opId, now).first();
      if (row) count++;
    } else if (o.delete) {
      row = await env.DB.prepare(
        `UPDATE pro_rows SET version = version + 1, last_op = ?1, deleted_at = ?2, updated_at = MAX(?2, updated_at + 1)
         WHERE user_id = ?3 AND kind = ?4 AND id = ?5 AND version = ?6 RETURNING version, updated_at`
      ).bind(o.opId, now, user.id, o.kind, o.id, o.base).first();
    } else {
      // Editar también saca de la papelera (deleted_at = NULL): la última acción de la persona manda.
      row = await env.DB.prepare(
        `UPDATE pro_rows SET data = ?1, version = version + 1, last_op = ?2, deleted_at = NULL, updated_at = MAX(?3, updated_at + 1)
         WHERE user_id = ?4 AND kind = ?5 AND id = ?6 AND version = ?7 RETURNING version, updated_at`
      ).bind(await encryptText(env, text), o.opId, now, user.id, o.kind, o.id, o.base).first();
    }
    if (row) { results.push({ opId: o.opId, ok: true, version: row.version, updatedAt: row.updated_at }); continue; }
    const cur = await env.DB.prepare('SELECT version, updated_at, last_op FROM pro_rows WHERE user_id = ? AND kind = ? AND id = ?')
      .bind(user.id, o.kind, o.id).first();
    if (cur && cur.last_op === o.opId) results.push({ opId: o.opId, ok: true, version: cur.version, updatedAt: cur.updated_at, repeated: true });
    else results.push({ opId: o.opId, error: 'conflict', version: cur?.version ?? null });
  }
  return json({ results });
}
