import { getUser, json } from '../../server/lib.js';

// Usuario logueado + todo lo que tiene guardado. { user: null } si no hay sesión.
export async function onRequestGet({ request, env }) {
  const user = await getUser(request, env);
  if (!user) return json({ user: null });
  const drafts = await env.DB.prepare('SELECT id, title, text, created_at AS at FROM drafts WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').bind(user.id).all();
  // Si la migración 0002 (título de los grupos) todavía no se aplicó, se sigue sin título.
  const tagSets = await env.DB.prepare('SELECT id, title, text FROM tag_sets WHERE user_id = ? ORDER BY created_at DESC').bind(user.id).all()
    .catch(() => env.DB.prepare("SELECT id, '' AS title, text FROM tag_sets WHERE user_id = ? ORDER BY created_at DESC").bind(user.id).all());
  return json({
    user: { name: user.name, email: user.email, picture: user.picture },
    current: user.current_text,
    drafts: drafts.results,
    tagSets: tagSets.results,
  });
}
