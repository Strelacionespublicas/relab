import { requireUser, readJson, validId, validText, json } from '../../../server/lib.js';
import { encryptText } from '../../../server/crypto.js';

const MAX_DRAFTS = 50;

export async function onRequestPost(context) {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const b = await readJson(context.request);
  if (!b || !validId(b.id) || !validText(b.text) || !validText(b.title, 200)) return json({ error: 'invalid' }, 400);
  const { DB } = context.env;
  const [title, text] = await Promise.all([encryptText(context.env, b.title), encryptText(context.env, b.text)]);
  await DB.batch([
    DB.prepare('INSERT OR REPLACE INTO drafts (id, user_id, title, text, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(b.id, user.id, title, text, Date.now()),
    DB.prepare(
      `DELETE FROM drafts WHERE user_id = ?1 AND id NOT IN
       (SELECT id FROM drafts WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ${MAX_DRAFTS})`
    ).bind(user.id),
  ]);
  return json({ ok: true });
}
