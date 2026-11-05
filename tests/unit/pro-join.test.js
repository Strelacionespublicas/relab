// Pruebas del registro a PRO desde /pro (functions/api/pro/join.js) y de la lista de contactos del panel.
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { onRequestPost as join } from '../../functions/api/pro/join.js';
import { onRequestGet as me } from '../../functions/api/pro/me.js';
import { onRequestGet as registros } from '../../functions/api/admin/registros.js';
import { onRequestDelete as deleteAccount } from '../../functions/api/account.js';
import { sha256Hex } from '../../server/lib.js';

function d1(db) {
  const wrap = (sql, args = []) => ({
    bind: (...a) => wrap(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    run: async () => db.prepare(sql).run(...args),
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    runSync: () => db.prepare(sql).run(...args),
  });
  return { prepare: sql => wrap(sql), batch: async s => { db.exec('BEGIN'); try { const r = s.map(x => x.runSync()); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } } };
}
const MIG = ['0001_init.sql', '0002_tagset_title.sql', '0003_resource_state.sql', '0004_pro_acceso.sql', '0005_pro_datos.sql', '0006_pro_registro.sql'];
let db;
let env;
beforeEach(async () => {
  db = new DatabaseSync(':memory:');
  for (const f of MIG) db.exec(readFileSync(new URL(`../../migrations/${f}`, import.meta.url), 'utf8'));
  for (const [id, name] of [['admin', 'Stella'], ['u1', 'Rosa Pérez'], ['u2', 'Ana']]) {
    db.prepare('INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, 1)').run(id, `${id}@x.com`, name);
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(await sha256Hex(`t-${id}`), id, 9e15);
  }
  env = { DB: d1(db), TEXT_KEY: 'clave-de-prueba-larga', ADMIN_EMAILS: 'admin@x.com' };
});
const ctx = (user, method, path, body) => ({
  request: new Request('https://relab.test' + path, { method, headers: { ...(user ? { cookie: `relab_session=t-${user}` } : {}), 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }),
  env,
});
const call = async (fn, ...a) => { const r = await fn(ctx(...a)); return { status: r.status, body: r.headers.get('content-type')?.includes('csv') ? await r.text() : await r.json() }; };
const ok = { whatsapp: '+54 9 383 412-3456', localidad: 'Belén, Catamarca', rubro: 'Textiles', feriasMes: '2-3', acepta: true, campana: 'charla-nov' };

describe('registro desde /pro', () => {
  it('activa PRO por 365 días y guarda el WhatsApp cifrado', async () => {
    const t0 = Date.now();
    const r = await call(join, 'u1', 'POST', '/api/pro/join', ok);
    expect(r.status).toBe(200);
    expect(r.body.pro).toBe(true);
    expect(r.body.endsAt).toBeGreaterThanOrEqual(t0 + 365 * 86_400_000);
    expect((await call(me, 'u1', 'GET', '/api/pro/me')).body).toMatchObject({ pro: true, source: 'launch' });
    const row = db.prepare('SELECT * FROM pro_registros').get();
    expect(row.whatsapp).not.toContain('383');
    expect(row).toMatchObject({ localidad: 'Belén, Catamarca', rubro: 'Textiles', ferias_mes: '2-3', acepta_novedades: 1, campana: 'charla-nov' });
  });

  it('una sola vez: repetir actualiza los datos pero no extiende PRO ni cambia la campaña', async () => {
    const a = await call(join, 'u1', 'POST', '/api/pro/join', ok);
    const b = await call(join, 'u1', 'POST', '/api/pro/join', { ...ok, rubro: 'Tejidos', campana: 'otra' });
    expect(b.body.endsAt).toBe(a.body.endsAt);
    expect(db.prepare('SELECT COUNT(*) n FROM entitlements').get().n).toBe(1);
    expect(db.prepare('SELECT rubro, campana FROM pro_registros').get()).toEqual({ rubro: 'Tejidos', campana: 'charla-nov' });
  });

  it('valida: sesión, localidad y rubro obligatorios, WhatsApp opcional pero con formato', async () => {
    expect((await call(join, null, 'POST', '/api/pro/join', ok)).status).toBe(401);
    expect((await call(join, 'u1', 'POST', '/api/pro/join', { ...ok, localidad: ' ' })).body.field).toBe('localidad');
    expect((await call(join, 'u1', 'POST', '/api/pro/join', { ...ok, rubro: '' })).body.field).toBe('rubro');
    expect((await call(join, 'u1', 'POST', '/api/pro/join', { ...ok, whatsapp: 'llamame' })).body.field).toBe('whatsapp');
    expect((await call(join, 'u1', 'POST', '/api/pro/join', { ...ok, whatsapp: '' })).status).toBe(200);
  });

  it('campaña rara se ignora; sin aceptar, no entra en la exportación', async () => {
    await call(join, 'u1', 'POST', '/api/pro/join', { ...ok, campana: '<script>' });
    expect(db.prepare('SELECT campana FROM pro_registros').get().campana).toBeNull();
    await call(join, 'u2', 'POST', '/api/pro/join', { ...ok, acepta: false });
    const csv = (await call(registros, 'admin', 'GET', '/api/admin/registros?formato=csv')).body;
    expect(csv).toContain('Rosa Pérez');
    expect(csv).toContain('+54 9 383 412-3456');
    expect(csv).not.toContain('u2@x.com');
  });

  it('PRO_LAUNCH=0 cierra el lanzamiento', async () => {
    env.PRO_LAUNCH = '0';
    expect((await call(join, 'u1', 'POST', '/api/pro/join', ok)).body.error).toBe('launch_closed');
    expect(db.prepare('SELECT COUNT(*) n FROM entitlements').get().n).toBe(0);
  });
});

describe('panel: registros', () => {
  it('solo admin; muestra cantidades por campaña y uso', async () => {
    await call(join, 'u1', 'POST', '/api/pro/join', ok);
    await call(join, 'u2', 'POST', '/api/pro/join', { ...ok, campana: null, acepta: false });
    expect((await call(registros, 'u1', 'GET', '/api/admin/registros')).status).toBe(403);
    const r = await call(registros, 'admin', 'GET', '/api/admin/registros');
    expect(r.body).toMatchObject({ total: 2, acepta: 1, conProductos: 0 });
    expect(r.body.campanas).toEqual(expect.arrayContaining([{ campana: 'charla-nov', n: 1 }, { campana: '(directo)', n: 1 }]));
    expect(JSON.stringify(r.body)).not.toContain('@');
  });

  it('exportar queda registrado y borrar la cuenta borra el registro', async () => {
    await call(join, 'u1', 'POST', '/api/pro/join', ok);
    await call(registros, 'admin', 'GET', '/api/admin/registros?formato=csv');
    expect(db.prepare('SELECT action FROM admin_audit').get().action).toBe('leads_export');
    await deleteAccount(ctx('u1', 'DELETE', '/api/account'));
    expect(db.prepare('SELECT COUNT(*) n FROM pro_registros').get().n).toBe(0);
  });
});
