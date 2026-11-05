import { getUser, json } from '../../../server/lib.js';
import { getEntitlement, isAdmin } from '../../../server/pro.js';

// Estado de PRO de la persona logueada. Sin sesión: { pro: false }.
export async function onRequestGet({ request, env }) {
  const user = await getUser(request, env);
  if (!user) return json({ pro: false, user: false });
  const ent = await getEntitlement(env, user.id);
  return json({
    user: true,
    pro: !!ent,
    endsAt: ent?.ends_at ?? null,
    source: ent?.source ?? null,
    label: ent?.label ?? null,
    admin: isAdmin(user, env),
  });
}
