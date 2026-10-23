import { requireUser, json } from '../../../server/lib.js';

export async function onRequestDelete(context) {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  await context.env.DB.prepare('DELETE FROM tag_sets WHERE user_id = ? AND id = ?').bind(user.id, String(context.params.id)).run();
  return json({ ok: true });
}
