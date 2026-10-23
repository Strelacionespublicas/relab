import { requireUser, setCookie, SESSION_COOKIE } from '../../server/lib.js';

// "Borrar mi cuenta y mis datos": elimina todo lo de la persona y cierra la sesión.
export async function onRequestDelete(context) {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const { DB } = context.env;
  // resource_state puede no existir si la migración 0003 todavía no se aplicó.
  await DB.prepare('DELETE FROM resource_state WHERE user_id = ?').bind(user.id).run().catch(() => {});
  await DB.batch(['drafts', 'tag_sets', 'sessions'].map(t => DB.prepare(`DELETE FROM ${t} WHERE user_id = ?`).bind(user.id))
    .concat(DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id)));
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'set-cookie': setCookie(SESSION_COOKIE, '', 0) },
  });
}
