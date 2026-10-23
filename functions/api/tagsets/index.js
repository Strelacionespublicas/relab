import { requireUser, readJson, validId, validText, json } from '../../../server/lib.js';

export async function onRequestPost(context) {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const b = await readJson(context.request);
  if (!b || !validId(b.id) || !validText(b.text, 5000)) return json({ error: 'invalid' }, 400);
  await context.env.DB.prepare('INSERT OR REPLACE INTO tag_sets (id, user_id, text, created_at) VALUES (?, ?, ?, ?)')
    .bind(b.id, user.id, b.text, Date.now()).run();
  return json({ ok: true });
}
