import { getUser, json } from '../../server/lib.js';
import { decryptText, encryptText, needsEncryption } from '../../server/crypto.js';

// Usuario logueado + todo lo que tiene guardado. { user: null } si no hay sesión.
export async function onRequestGet({ request, env, waitUntil }) {
  const user = await getUser(request, env);
  if (!user) return json({ user: null });
  const drafts = await env.DB.prepare('SELECT id, title, text, created_at AS at FROM drafts WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').bind(user.id).all();
  // Si la migración 0002 (título de los grupos) todavía no se aplicó, se sigue sin título.
  const tagSets = await env.DB.prepare('SELECT id, title, text FROM tag_sets WHERE user_id = ? ORDER BY created_at DESC').bind(user.id).all()
    .catch(() => env.DB.prepare("SELECT id, '' AS title, text FROM tag_sets WHERE user_id = ? ORDER BY created_at DESC").bind(user.id).all());
  if (env.TEXT_KEY) waitUntil(encryptLegacy(env, user, drafts.results, tagSets.results).catch(err => console.error(err)));
  const dec = s => decryptText(env, s);
  return json({
    user: { name: user.name, email: user.email, picture: user.picture },
    current: await dec(user.current_text),
    drafts: await Promise.all(drafts.results.map(async d => ({ ...d, title: await dec(d.title), text: await dec(d.text) }))),
    tagSets: await Promise.all(tagSets.results.map(async t => ({ ...t, title: await dec(t.title), text: await dec(t.text) }))),
  });
}

// Lo guardado antes de activar el cifrado se cifra la primera vez que la persona vuelve.
async function encryptLegacy(env, user, drafts, tagSets) {
  const { DB } = env;
  const enc = s => (needsEncryption(s) ? encryptText(env, s) : s);
  const stmts = [];
  if (needsEncryption(user.current_text)) {
    stmts.push(DB.prepare('UPDATE users SET current_text = ? WHERE id = ?').bind(await enc(user.current_text), user.id));
  }
  for (const d of drafts) {
    if (needsEncryption(d.title) || needsEncryption(d.text)) {
      stmts.push(DB.prepare('UPDATE drafts SET title = ?, text = ? WHERE user_id = ? AND id = ?').bind(await enc(d.title), await enc(d.text), user.id, d.id));
    }
  }
  for (const t of tagSets) {
    if (needsEncryption(t.text)) {
      stmts.push(DB.prepare('UPDATE tag_sets SET text = ? WHERE user_id = ? AND id = ?').bind(await enc(t.text), user.id, t.id));
    }
    if (needsEncryption(t.title)) {
      stmts.push(DB.prepare('UPDATE tag_sets SET title = ? WHERE user_id = ? AND id = ?').bind(await enc(t.title), user.id, t.id));
    }
  }
  if (stmts.length) await DB.batch(stmts);
}
