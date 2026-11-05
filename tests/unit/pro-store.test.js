// Pruebas de src/kit/pro-store.js contra los endpoints reales (functions/api/pro/data.js y ops.js)
// sobre SQLite: sin conexión, reintentos, dos dispositivos, sin PRO y cuentas separadas.
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { onRequestGet as getData } from '../../functions/api/pro/data.js';
import { onRequestPost as postOps } from '../../functions/api/pro/ops.js';
import { sha256Hex } from '../../server/lib.js';
import { createProStore } from '../../src/kit/pro-store.js';

function d1(db) {
  const wrap = (sql, args = []) => ({
    bind: (...a) => wrap(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    run: async () => db.prepare(sql).run(...args),
    all: async () => ({ results: db.prepare(sql).all(...args) }),
  });
  return { prepare: sql => wrap(sql) };
}
const MIG = ['0001_init.sql', '0002_tagset_title.sql', '0003_resource_state.sql', '0004_pro_acceso.sql', '0005_pro_datos.sql'];
let db;
let env;
beforeEach(async () => {
  db = new DatabaseSync(':memory:');
  for (const f of MIG) db.exec(readFileSync(new URL(`../../migrations/${f}`, import.meta.url), 'utf8'));
  for (const id of ['u1', 'u2']) {
    db.prepare('INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, 1)').run(id, `${id}@x.com`, id);
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(await sha256Hex(`t-${id}`), id, 9e15);
    db.prepare("INSERT INTO entitlements (user_id, id, product, source, starts_at, ends_at, created_at) VALUES (?, 'e', 'kit-feriante-pro', 'code', 0, 9e15, 0)").run(id);
  }
  env = { DB: d1(db), TEXT_KEY: 'clave-de-prueba-larga' };
});

const memStorage = () => { const m = new Map(); return { getItem: x => (m.has(x) ? m.get(x) : null), setItem: (x, v) => m.set(x, String(v)), removeItem: x => m.delete(x), m }; };
// Un "dispositivo": su almacenamiento, su red (que se puede cortar) y la cookie de una cuenta.
function device(user, storage = memStorage()) {
  const net = { online: true, lose: 0, calls: 0 };
  const fetchImpl = async (path, init = {}) => {
    if (!net.online) throw new TypeError('Failed to fetch');
    net.calls++;
    const request = new Request('https://relab.test' + path, { method: init.method || 'GET', headers: { cookie: `relab_session=t-${user}`, ...(init.headers || {}) }, body: init.body });
    const handler = path.startsWith('/api/pro/ops') ? postOps : getData;
    const res = await handler({ request, env });
    if (net.lose > 0) { net.lose--; throw new TypeError('network'); } // se guardó, pero la respuesta no llegó
    return res;
  };
  const timers = { setTimeout: () => 0, clearTimeout: () => {} };
  const store = createProStore({ owner: user, storage, fetchImpl, isOnline: () => net.online, timers });
  return { store, net, storage };
}
const idle = async s => { for (let i = 0; i < 20; i++) { await new Promise(r => setTimeout(r, 0)); if (!['guardando'].includes(s.snapshot().status)) break; } };
const serverRows = (user, kind) => db.prepare('SELECT id, version, deleted_at FROM pro_rows WHERE user_id = ? AND kind = ? ORDER BY id').all(user, kind);

describe('pro-store', () => {
  it('guarda en el servidor y otro dispositivo lo ve', async () => {
    const a = device('u1');
    await a.store.start();
    a.store.save('producto', 'p1', { nombre: 'Poncho', precio: 95000 });
    await idle(a.store);
    expect(a.store.snapshot()).toMatchObject({ status: 'listo', pending: 0 });
    const b = device('u1');
    await b.store.start();
    expect(b.store.list('producto')).toEqual([{ id: 'p1', nombre: 'Poncho', precio: 95000, deletedAt: null }]);
  });

  it('sin conexión: queda en el dispositivo y se sube sola al volver, sin duplicar', async () => {
    const a = device('u1');
    await a.store.start();
    a.net.online = false;
    for (let i = 0; i < 5; i++) a.store.save('venta', `v${i}`, { items: [{ productoId: 'p1', cant: 1, precio: 100 }] });
    await idle(a.store);
    expect(a.store.snapshot()).toMatchObject({ status: 'sin-conexion', pending: 5 });
    expect(serverRows('u1', 'venta')).toHaveLength(0);
    // Se cierra la app y se vuelve a abrir, todavía sin red: la cola sigue ahí.
    const again = device('u1', a.storage);
    again.net.online = false;
    await again.store.start();
    expect(again.store.list('venta')).toHaveLength(5);
    again.net.online = true;
    await again.store.pull();
    await again.store.flush();
    await idle(again.store);
    expect(serverRows('u1', 'venta')).toHaveLength(5);
    expect(again.store.snapshot().pending).toBe(0);
  });

  it('respuesta perdida (se guardó pero no llegó la confirmación): el reintento no duplica', async () => {
    const a = device('u1');
    await a.store.start();
    a.net.lose = 1;
    a.store.save('venta', 'v1', { total: 1 });
    await idle(a.store);
    expect(a.store.snapshot().pending).toBe(1);
    await a.store.flush();
    expect(serverRows('u1', 'venta')).toEqual([{ id: 'v1', version: 1, deleted_at: null }]);
    expect(a.store.snapshot().pending).toBe(0);
  });

  it('dos dispositivos editan el mismo producto: gana el último cambio, sin errores', async () => {
    const a = device('u1'); const b = device('u1');
    await a.store.start();
    a.store.save('producto', 'p1', { nombre: 'A' });
    await idle(a.store);
    await b.store.start();
    a.store.save('producto', 'p1', { nombre: 'Desde A' });
    await idle(a.store);
    b.store.save('producto', 'p1', { nombre: 'Desde B' }); // b tenía la versión 1: conflicto y reenvío
    await idle(b.store);
    expect(b.store.snapshot().status).toBe('listo');
    const c = device('u1');
    await c.store.start();
    expect(c.store.get('producto', 'p1').nombre).toBe('Desde B');
  });

  it('dos dispositivos venden a la vez sin conexión: al volver están todas las ventas', async () => {
    const a = device('u1'); const b = device('u1');
    await a.store.start(); await b.store.start();
    a.net.online = false; b.net.online = false;
    for (let i = 0; i < 10; i++) { a.store.save('venta', a.store.newId(), { items: [{ productoId: 'p1', cant: 1 }] }); b.store.save('venta', b.store.newId(), { items: [{ productoId: 'p1', cant: 2 }] }); }
    a.net.online = true; b.net.online = true;
    await Promise.all([a.store.flush(), b.store.flush()]);
    await idle(a.store); await idle(b.store);
    expect(serverRows('u1', 'venta')).toHaveLength(20);
    await a.store.pull();
    expect(a.store.list('venta').reduce((s, v) => s + v.items[0].cant, 0)).toBe(30);
  });

  it('borrar: lo que nunca llegó al servidor se descarta; lo guardado va a la papelera', async () => {
    const a = device('u1');
    await a.store.start();
    a.net.online = false;
    a.store.save('venta', 'x', { total: 1 });
    a.store.remove('venta', 'x');
    expect(a.store.snapshot().pending).toBe(0);
    a.net.online = true;
    a.store.save('venta', 'y', { total: 2 });
    await idle(a.store);
    a.store.remove('venta', 'y');
    await idle(a.store);
    expect(serverRows('u1', 'venta')).toEqual([{ id: 'y', version: 2, deleted_at: expect.any(Number) }]);
    expect(a.store.list('venta')).toEqual([]);
    expect(a.store.list('venta', { trash: true }).map(v => v.id)).toEqual(['y']);
    a.store.save('venta', 'y', { total: 2 }); // recuperar
    await idle(a.store);
    expect(serverRows('u1', 'venta')[0].deleted_at).toBeNull();
  });

  it('sin PRO vigente: pasa a solo lectura y la cola no se pierde', async () => {
    const a = device('u1');
    await a.store.start();
    db.prepare("UPDATE entitlements SET ends_at = 1 WHERE user_id = 'u1'").run();
    a.store.save('feria', 'f1', { nombre: 'X' });
    await idle(a.store);
    expect(a.store.snapshot()).toMatchObject({ status: 'solo-lectura', pending: 1 });
    db.prepare("UPDATE entitlements SET ends_at = 9e15 WHERE user_id = 'u1'").run();
    await a.store.flush();
    expect(serverRows('u1', 'feria')).toHaveLength(1);
  });

  it('cada cuenta tiene su copia local: no se mezclan en el mismo navegador', async () => {
    const storage = memStorage();
    const a = device('u1', storage);
    await a.store.start();
    a.net.online = false;
    a.store.save('producto', 'p1', { nombre: 'De u1' });
    const b = device('u2', storage);
    await b.store.start();
    expect(b.store.list('producto')).toEqual([]);
    expect(serverRows('u2', 'producto')).toEqual([]);
  });
});
