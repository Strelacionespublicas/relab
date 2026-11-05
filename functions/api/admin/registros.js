import { json } from '../../../server/lib.js';
import { decryptText } from '../../../server/crypto.js';
import { audit, requireAdmin } from '../../../server/pro.js';

// Registros a Kit Feriante PRO (/pro). GET: cantidades. GET ?formato=csv: contactos de quienes
// aceptaron recibir novedades (nombre, email, WhatsApp, localidad, rubro, ferias, campaña, fecha).
// Nunca incluye nada de lo que cargan en el Kit.
export async function onRequestGet(context) {
  const user = await requireAdmin(context);
  if (user instanceof Response) return user;
  const { env, request } = context;
  const formato = new URL(request.url).searchParams.get('formato');
  if (formato !== 'csv') {
    const tot = await env.DB.prepare('SELECT COUNT(*) AS total, COALESCE(SUM(acepta_novedades), 0) AS acepta FROM pro_registros').first();
    const { results: campanas } = await env.DB.prepare("SELECT COALESCE(campana, '(directo)') AS campana, COUNT(*) AS n FROM pro_registros GROUP BY 1 ORDER BY n DESC").all();
    const { results: rubros } = await env.DB.prepare('SELECT rubro, COUNT(*) AS n FROM pro_registros GROUP BY rubro ORDER BY n DESC LIMIT 10').all();
    const uso = await env.DB.prepare(
      `SELECT COUNT(DISTINCT CASE WHEN kind = 'producto' THEN user_id END) AS con_productos,
              COUNT(DISTINCT CASE WHEN kind = 'venta' THEN user_id END) AS con_ventas FROM pro_rows WHERE deleted_at IS NULL`
    ).first().catch(() => ({ con_productos: 0, con_ventas: 0 }));
    return json({ total: tot.total, acepta: tot.acepta, campanas, rubros, conProductos: uso.con_productos, conVentas: uso.con_ventas });
  }
  const { results } = await env.DB.prepare(
    `SELECT u.name, u.email, r.whatsapp, r.localidad, r.rubro, r.ferias_mes, r.campana, r.created_at
     FROM pro_registros r JOIN users u ON u.id = r.user_id WHERE r.acepta_novedades = 1 ORDER BY r.created_at`
  ).all();
  const rows = [['Nombre', 'Email', 'WhatsApp', 'Localidad', 'Rubro', 'Ferias por mes', 'Campaña', 'Fecha de registro']];
  for (const r of results) {
    const wa = r.whatsapp ? await decryptText(env, r.whatsapp).catch(() => '') : '';
    rows.push([r.name || '', r.email, wa, r.localidad || '', r.rubro || '', r.ferias_mes || '', r.campana || '', new Date(r.created_at).toISOString().slice(0, 10)]);
  }
  await audit(env, user, 'leads_export', String(results.length)).run();
  const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="contactos-kit-feriante-pro.csv"', 'cache-control': 'no-store' } });
}
