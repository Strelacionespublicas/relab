import { json, readJson, validId } from '../../../../server/lib.js';
import { audit, requireAdmin } from '../../../../server/pro.js';

// Activar o desactivar un código: { active: false | true }. Desactivar no quita PRO a quien ya lo canjeó.
export async function onRequestPost(context) {
  const user = await requireAdmin(context);
  if (user instanceof Response) return user;
  const id = String(context.params.id);
  const b = await readJson(context.request);
  if (!validId(id) || typeof b?.active !== 'boolean') return json({ error: 'invalid' }, 400);
  const { env } = context;
  const res = await env.DB.prepare('UPDATE access_codes SET active = ? WHERE id = ?').bind(b.active ? 1 : 0, id).run();
  if (!(res?.meta?.changes ?? res?.changes)) return json({ error: 'not_found' }, 404);
  await audit(env, user, b.active ? 'code_activate' : 'code_deactivate', id).run();
  return json({ ok: true });
}
