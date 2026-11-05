import { json, readJson, requireUser } from '../../../server/lib.js';
import { codeHash, daysToMs, getEntitlement, normalizeCode } from '../../../server/pro.js';

// Canje de un código de campaña: { code } → permiso PRO por los días del código.
//
// El canje, la suma del uso y el permiso van en un solo DB.batch (una transacción). Cada sentencia
// vuelve a comprobar las condiciones (activo, cupo, fecha, sin PRO vigente) y las dos últimas solo
// actúan si existe el canje de ESTE pedido (entitlement_id es nuevo y al azar). Así, aunque lleguen
// muchos canjes juntos, no se pasa del cupo, nadie usa el mismo código dos veces y no hay usos
// sumados sin permiso.
export async function onRequestPost(context) {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const { env } = context;
  const body = await readJson(context.request);
  const code = normalizeCode(body?.code);
  if (!code) return json({ error: 'invalid_code' }, 400);

  const now = Date.now();
  const row = await env.DB.prepare('SELECT * FROM access_codes WHERE code_hash = ?').bind(await codeHash(code)).first();
  if (!row || !row.active) return json({ error: 'invalid_code' }, 404);
  const current = await getEntitlement(env, user.id, row.product, now);
  if (current) return json({ error: 'already_pro', endsAt: current.ends_at }, 409);
  const prev = await env.DB.prepare('SELECT 1 FROM redemptions WHERE user_id = ? AND code_id = ?').bind(user.id, row.id).first();
  if (prev) return json({ error: 'already_redeemed' }, 409);
  if (row.redeem_until != null && row.redeem_until <= now) return json({ error: 'expired' }, 410);
  if (row.uses >= row.max_uses) return json({ error: 'no_uses_left' }, 410);

  const entId = crypto.randomUUID();
  const mine = 'SELECT 1 FROM redemptions WHERE user_id = ?1 AND code_id = ?3 AND entitlement_id = ?4';
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO redemptions (user_id, code_id, entitlement_id, at)
       SELECT ?1, c.id, ?4, ?2 FROM access_codes c
       WHERE c.id = ?3 AND c.active = 1 AND c.uses < c.max_uses AND (c.redeem_until IS NULL OR c.redeem_until > ?2)
         AND NOT EXISTS (SELECT 1 FROM entitlements e WHERE e.user_id = ?1 AND e.product = c.product
                         AND e.status = 'active' AND e.starts_at <= ?2 AND e.ends_at > ?2)
       ON CONFLICT DO NOTHING`
    ).bind(user.id, now, row.id, entId),
    env.DB.prepare(`UPDATE access_codes SET uses = uses + 1 WHERE id = ?3 AND EXISTS (${mine})`).bind(user.id, now, row.id, entId),
    env.DB.prepare(
      `INSERT INTO entitlements (user_id, id, product, source, ref, starts_at, ends_at, status, created_at)
       SELECT ?1, ?4, c.product, 'code', c.id, ?2, ?2 + c.days * ?5, 'active', ?2 FROM access_codes c
       WHERE c.id = ?3 AND EXISTS (${mine})`
    ).bind(user.id, now, row.id, entId, daysToMs(1)),
  ]);

  const ent = await env.DB.prepare('SELECT ends_at FROM entitlements WHERE user_id = ? AND id = ?').bind(user.id, entId).first();
  if (ent) return json({ ok: true, endsAt: ent.ends_at, label: row.label });

  // Otro pedido ganó la carrera: se explica por qué no se pudo.
  const again = await getEntitlement(env, user.id, row.product);
  if (again) return json({ error: 'already_pro', endsAt: again.ends_at }, 409);
  const dup = await env.DB.prepare('SELECT 1 FROM redemptions WHERE user_id = ? AND code_id = ?').bind(user.id, row.id).first();
  if (dup) return json({ error: 'already_redeemed' }, 409);
  return json({ error: 'no_uses_left' }, 410);
}
