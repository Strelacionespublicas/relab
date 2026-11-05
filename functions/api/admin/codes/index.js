import { json, readJson } from '../../../../server/lib.js';
import { PRODUCT, audit, codeHash, newCode, requireAdmin } from '../../../../server/pro.js';

// Panel de administración: códigos de campaña. Solo cantidades, nunca datos de personas.
export async function onRequestGet(context) {
  const user = await requireAdmin(context);
  if (user instanceof Response) return user;
  const { results } = await context.env.DB.prepare(
    'SELECT id, label, product, days, redeem_until AS redeemUntil, max_uses AS maxUses, uses, active, created_at AS createdAt FROM access_codes ORDER BY created_at DESC'
  ).all();
  return json({ codes: results.map(c => ({ ...c, active: !!c.active })) });
}

const int = (v, min, max) => (Number.isSafeInteger(v) && v >= min && v <= max ? v : null);

// Crea un código. Devuelve el código en texto UNA sola vez: después solo queda su hash.
export async function onRequestPost(context) {
  const user = await requireAdmin(context);
  if (user instanceof Response) return user;
  const { env } = context;
  const b = (await readJson(context.request)) || {};
  const label = typeof b.label === 'string' ? b.label.trim() : '';
  const maxUses = int(b.maxUses, 1, 100_000);
  const days = b.days === undefined ? 365 : int(b.days, 1, 1095);
  const redeemUntil = b.redeemUntil == null ? null : int(b.redeemUntil, Date.now(), 8_640_000_000_000_000);
  if (!label || label.length > 80 || !maxUses || !days || (b.redeemUntil != null && !redeemUntil)) {
    return json({ error: 'invalid' }, 400);
  }
  const id = crypto.randomUUID();
  for (let i = 0; i < 3; i++) {
    const code = newCode();
    try {
      await env.DB.batch([
        env.DB.prepare('INSERT INTO access_codes (id, code_hash, label, product, days, redeem_until, max_uses, uses, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?)')
          .bind(id, await codeHash(code), label, PRODUCT, days, redeemUntil, maxUses, Date.now()),
        audit(env, user, 'code_create', id),
      ]);
      return json({ id, code, label, days, maxUses, redeemUntil });
    } catch (err) {
      if (!/UNIQUE/i.test(String(err?.message))) throw err; // choque de hash (casi imposible): otro código
    }
  }
  return json({ error: 'server_error' }, 500);
}
