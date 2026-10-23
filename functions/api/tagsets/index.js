import { requireUser, readJson, validId, validText, json } from '../../../server/lib.js';

export async function onRequestPost(context) {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const b = await readJson(context.request);
  const title = b?.title ?? '';
  if (!b || !validId(b.id) || !validText(b.text, 5000) || !validText(title, 60)) return json({ error: 'invalid' }, 400);
  const { DB } = context.env;
  // Sin la migración 0002 la columna title no existe: se guarda igual, sin título.
  await DB.prepare('INSERT OR REPLACE INTO tag_sets (id, user_id, title, text, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(b.id, user.id, title, b.text, Date.now()).run()
    .catch(() => DB.prepare('INSERT OR REPLACE INTO tag_sets (id, user_id, text, created_at) VALUES (?, ?, ?, ?)')
      .bind(b.id, user.id, b.text, Date.now()).run());
  return json({ ok: true });
}
