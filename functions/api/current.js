import { requireUser, readJson, validText, json } from '../../server/lib.js';
import { encryptText } from '../../server/crypto.js';

// Autoguardado del texto en curso.
export async function onRequestPut(context) {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const body = await readJson(context.request);
  if (!body || !validText(body.text)) return json({ error: 'invalid' }, 400);
  await context.env.DB.prepare('UPDATE users SET current_text = ? WHERE id = ?').bind(await encryptText(context.env, body.text), user.id).run();
  return json({ ok: true });
}
