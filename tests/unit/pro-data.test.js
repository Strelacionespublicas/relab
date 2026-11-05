// Pruebas de los datos PRO (functions/api/pro/data.js y ops.js) con su código real sobre SQLite.
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { onRequestGet as getData } from '../../functions/api/pro/data.js';
import { onRequestPost as postOps } from '../../functions/api/pro/ops.js';
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
  return {
    prepare: sql => wrap(sql),
    batch: async stmts => { db.exec('BEGIN'); try { const r = stmts.map(s => s.runSync()); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } },
  };
}

const MIG = ['0001_init.sql', '0002_tagset_title.sql', '0003_resource_state.sql', '0004_pro_acceso.sql', '0005_pro_datos.sql'];
let db;
let env;
const token = id => `token-${id}`;
async function addUser(id, pro = true) {
  db.prepare('INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)').run(id, `${id}@x.com`, id, 1);
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(await sha256Hex(token(id)), id, 9e15);
  if (pro) db.prepare("INSERT INTO entitlements (user_id, id, product, source, starts_at, ends_at, created_at) VALUES (?, 'e1', 'kit-feriante-pro', 'code', 0, 9e15, 0)").run(id);
}
beforeEach(async () => {
  db = new DatabaseSync(':memory:');
  for (const f of MIG) db.exec(readFileSync(new URL(`../../migrations/${f}`, import.meta.url), 'utf8'));
  await addUser('u1');
  await addUser('u2');
  await addUser('sinpro', false);
  env = { DB: d1(db), TEXT_KEY: 'clave-de-prueba-larga' };
});

const ctx = (user, method, path, body) => ({
  request: new Request(`https://relab.test${path}`, { method, headers: { cookie: `relab_session=${token(user)}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }),
  env,
});
let n = 0;
const op = (o) => ({ opId: `op${++n}`, base: null, ...o });
const send = async (user, ops) => { const r = await postOps(ctx(user, 'POST', '/api/pro/ops', { ops })); return { status: r.status, body: await r.json() }; };
const read = async (user, q = '') => (await getData(ctx(user, 'GET', '/api/pro/data' + q))).json();

describe('crear, editar, borrar', () => {
  it('crea con versión 1, guarda cifrado y lo devuelve descifrado', async () => {
    const r = await send('u1', [op({ kind: 'producto', id: 'p1', data: { nombre: 'Poncho', precio: '95000' } })]);
    expect(r.body.results[0]).toMatchObject({ ok: true, version: 1 });
    const raw = db.prepare('SELECT data FROM pro_rows').get().data;
    expect(raw).not.toContain('Poncho');
    const d = await read('u1');
    expect(d.rows).toEqual([expect.objectContaining({ kind: 'producto', id: 'p1', version: 1, deletedAt: null, data: { nombre: 'Poncho', precio: '95000' } })]);
  });

  it('editar con la versión actual sube la versión; con una vieja es conflicto y no cambia nada', async () => {
    await send('u1', [op({ kind: 'feria', id: 'f1', data: { nombre: 'A' } })]);
    const e = await send('u1', [op({ kind: 'feria', id: 'f1', base: 1, data: { nombre: 'B' } })]);
    expect(e.body.results[0]).toMatchObject({ ok: true, version: 2 });
    const c = await send('u1', [op({ kind: 'feria', id: 'f1', base: 1, data: { nombre: 'C' } })]);
    expect(c.body.results[0]).toMatchObject({ error: 'conflict', version: 2 });
    expect((await read('u1')).rows[0].data.nombre).toBe('B');
  });

  it('crear un id que ya existe es conflicto (no se pisa)', async () => {
    await send('u1', [op({ kind: 'venta', id: 'v1', data: { total: 1 } })]);
    const r = await send('u1', [op({ kind: 'venta', id: 'v1', data: { total: 2 } })]);
    expect(r.body.results[0].error).toBe('conflict');
    expect((await read('u1')).rows[0].data.total).toBe(1);
  });

  it('borrar va a la papelera: se sigue leyendo con deletedAt y editar lo recupera', async () => {
    await send('u1', [op({ kind: 'venta', id: 'v1', data: { total: 1 } })]);
    const b = await send('u1', [op({ kind: 'venta', id: 'v1', base: 1, delete: true })]);
    expect(b.body.results[0]).toMatchObject({ ok: true, version: 2 });
    const row = (await read('u1')).rows[0];
    expect(row.deletedAt).toBeGreaterThan(0);
    await send('u1', [op({ kind: 'venta', id: 'v1', base: 2, data: { total: 1 } })]);
    expect((await read('u1')).rows[0].deletedAt).toBeNull();
  });

  it('lo borrado hace más de 30 días ya no se lista', async () => {
    await send('u1', [op({ kind: 'venta', id: 'v1', data: { total: 1 } })]);
    await send('u1', [op({ kind: 'venta', id: 'v1', base: 1, delete: true })]);
    db.prepare('UPDATE pro_rows SET deleted_at = ?').run(Date.now() - 31 * 86_400_000);
    expect((await read('u1')).rows).toEqual([]);
  });
});

describe('reintentos y duplicados', () => {
  it('reenviar la misma operación (mismo opId) no duplica ni da conflicto', async () => {
    const o = op({ kind: 'venta', id: 'v1', data: { total: 5 } });
    await send('u1', [o]);
    const again = await send('u1', [o]);
    expect(again.body.results[0]).toMatchObject({ ok: true, version: 1, repeated: true });
    const e = op({ kind: 'venta', id: 'v1', base: 1, data: { total: 6 } });
    await send('u1', [e]);
    expect((await send('u1', [e])).body.results[0]).toMatchObject({ ok: true, version: 2, repeated: true });
    expect(db.prepare('SELECT COUNT(*) n FROM pro_rows').get().n).toBe(1);
  });

  it('dos dispositivos vendiendo a la vez: cada venta es una fila, no se pisan', async () => {
    const a = Array.from({ length: 30 }, (_, i) => op({ kind: 'venta', id: `a${i}`, data: { items: [{ producto: 'p1', cant: 1 }] } }));
    const b = Array.from({ length: 30 }, (_, i) => op({ kind: 'venta', id: `b${i}`, data: { items: [{ producto: 'p1', cant: 2 }] } }));
    await Promise.all([send('u1', a), send('u1', b)]);
    const rows = (await read('u1')).rows.filter(r => r.kind === 'venta');
    expect(rows).toHaveLength(60);
    expect(rows.reduce((s, r) => s + r.data.items[0].cant, 0)).toBe(90);
  });
});

describe('permisos y aislamiento', () => {
  it('sin PRO no se escribe nada (403), pero se puede leer', async () => {
    await send('sinpro', []).then(r => expect(r.status).toBe(403));
    const r = await send('sinpro', [op({ kind: 'feria', id: 'f1', data: { nombre: 'X' } })]);
    expect(r.status).toBe(403);
    expect(r.body.error).toBe('pro_required');
    expect(db.prepare('SELECT COUNT(*) n FROM pro_rows').get().n).toBe(0);
    expect((await read('sinpro')).rows).toEqual([]);
  });

  it('con PRO vencido: lee lo suyo, no escribe', async () => {
    await send('u1', [op({ kind: 'feria', id: 'f1', data: { nombre: 'X' } })]);
    db.prepare("UPDATE entitlements SET ends_at = 1 WHERE user_id = 'u1'").run();
    expect((await send('u1', [op({ kind: 'feria', id: 'f1', base: 1, data: { nombre: 'Y' } })])).status).toBe(403);
    expect((await read('u1')).rows[0].data.nombre).toBe('X');
  });

  it('otra cuenta no ve ni toca datos ajenos, aunque use los mismos ids', async () => {
    await send('u1', [op({ kind: 'producto', id: 'p1', data: { nombre: 'De u1' } })]);
    expect((await read('u2')).rows).toEqual([]);
    const r = await send('u2', [op({ kind: 'producto', id: 'p1', base: 1, data: { nombre: 'Pisado' } })]);
    expect(r.body.results[0].error).toBe('conflict');
    await send('u2', [op({ kind: 'producto', id: 'p1', data: { nombre: 'De u2' } })]);
    expect((await read('u1')).rows[0].data.nombre).toBe('De u1');
    expect((await read('u2')).rows[0].data.nombre).toBe('De u2');
  });

  it('valida las operaciones', async () => {
    const bad = [{ opId: 'x', kind: 'otro', id: 'a', base: null, data: {} }, { opId: 'y', kind: 'feria', id: 'a b', base: null, data: {} },
      { opId: 'z', kind: 'feria', id: 'a', base: null, delete: true }, { opId: 'w', kind: 'feria', id: 'a', base: 0, data: {} },
      { opId: 'v', kind: 'feria', id: 'a', base: null, data: [1] }];
    const r = await send('u1', bad);
    expect(r.body.results.map(x => x.error)).toEqual(['invalid', 'invalid', 'invalid', 'invalid', 'invalid']);
    expect((await send('u1', [op({ kind: 'feria', id: 'f', data: { t: 'x'.repeat(20_001) } })])).body.results[0].error).toBe('too_large');
    expect((await send('u1', [])).status).toBe(400);
  });

  it('?since trae solo lo cambiado (con margen)', async () => {
    await send('u1', [op({ kind: 'feria', id: 'f1', data: { nombre: 'X' } })]);
    db.prepare('UPDATE pro_rows SET updated_at = 1000').run();
    await send('u1', [op({ kind: 'feria', id: 'f2', data: { nombre: 'Y' } })]);
    const d = await read('u1', `?since=${Date.now() - 1000}`);
    expect(d.rows.map(r => r.id)).toEqual(['f2']);
  });

  it('borrar la cuenta borra los datos PRO', async () => {
    await send('u1', [op({ kind: 'feria', id: 'f1', data: { nombre: 'X' } })]);
    await send('u2', [op({ kind: 'feria', id: 'f1', data: { nombre: 'X' } })]);
    await deleteAccount(ctx('u1', 'DELETE', '/api/account'));
    expect(db.prepare('SELECT user_id FROM pro_rows').all().map(r => r.user_id)).toEqual(['u2']);
  });
});
