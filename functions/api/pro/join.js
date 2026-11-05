import { json, readJson, requireUser } from '../../../server/lib.js';
import { encryptText } from '../../../server/crypto.js';
import { PRODUCT, daysToMs, getEntitlement } from '../../../server/pro.js';

// Registro a Kit Feriante PRO desde /pro (lanzamiento gratis): guarda los datos de contacto y
// activa PRO por 365 días, una sola vez por persona (el permiso tiene id fijo 'lanzamiento').
// PRO_LAUNCH = "0" en Cloudflare cierra el lanzamiento (el registro responde launch_closed).
export const FERIAS_MES = ['ocasional', '1', '2-3', '4+'];
const LAUNCH_DAYS = 365;
const clean = (v, max) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');

export async function onRequestPost(context) {
  const user = await requireUser(context);
  if (user instanceof Response) return user;
  const { env } = context;
  if (env.PRO_LAUNCH === '0') return json({ error: 'launch_closed' }, 403);
  const b = (await readJson(context.request)) || {};
  const whatsapp = clean(b.whatsapp, 30);
  const localidad = clean(b.localidad, 80);
  const rubro = clean(b.rubro, 60);
  const feriasMes = FERIAS_MES.includes(b.feriasMes) ? b.feriasMes : null;
  const campana = typeof b.campana === 'string' && /^[\w-]{1,40}$/.test(b.campana) ? b.campana.toLowerCase() : null;
  const acepta = b.acepta === true;
  if (whatsapp && !/^\+?[\d\s()-]{6,30}$/.test(whatsapp)) return json({ error: 'invalid', field: 'whatsapp' }, 400);
  if (!localidad) return json({ error: 'invalid', field: 'localidad' }, 400);
  if (!rubro) return json({ error: 'invalid', field: 'rubro' }, 400);

  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO pro_registros (user_id, whatsapp, localidad, rubro, ferias_mes, acepta_novedades, campana, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
       ON CONFLICT (user_id) DO UPDATE SET whatsapp = excluded.whatsapp, localidad = excluded.localidad, rubro = excluded.rubro,
         ferias_mes = excluded.ferias_mes, acepta_novedades = excluded.acepta_novedades,
         campana = COALESCE(pro_registros.campana, excluded.campana), updated_at = excluded.updated_at`
    ).bind(user.id, whatsapp ? await encryptText(env, whatsapp) : null, localidad, rubro, feriasMes, acepta ? 1 : 0, campana, now),
    // Una sola vez por persona: el id fijo hace que repetir no extienda el plazo.
    env.DB.prepare(
      `INSERT INTO entitlements (user_id, id, product, source, ref, starts_at, ends_at, status, created_at)
       VALUES (?, 'lanzamiento', ?, 'launch', ?, ?, ?, 'active', ?) ON CONFLICT DO NOTHING`
    ).bind(user.id, PRODUCT, campana, now, now + daysToMs(LAUNCH_DAYS), now),
  ]);
  const ent = await getEntitlement(env, user.id);
  return json({ ok: true, pro: !!ent, endsAt: ent?.ends_at ?? null });
}
