import { requireUser, readJson, validId, validText, json } from '../../../server/lib.js';
import { encryptText } from '../../../server/crypto.js';

export async function onRequestPost(context) {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const b = await readJson(context.request);
  const title = b?.title ?? '';
  if (!b || !validId(b.id) || !validText(b.text, 5000) || !validText(title, 60)) return json({ error: 'invalid' }, 400);
  const { DB } = context.env;
  const [encTitle, encText] = await Promise.all([encryptText(context.env, title), encryptText(context.env, b.text)]);
  // Sin la migración 0002 la columna title no existe: se guarda igual, sin título.
  await DB.prepare('INSERT OR REPLACE INTO tag_sets (id, user_id, title, text, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(b.id, user.id, encTitle, encText, Date.now()).run()
    .catch(() => DB.prepare('INSERT OR REPLACE INTO tag_sets (id, user_id, text, created_at) VALUES (?, ?, ?, ?)')
      .bind(b.id, user.id, encText, Date.now()).run());
  return json({ ok: true });
}
