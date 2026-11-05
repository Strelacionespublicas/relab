// Pruebas de functions/api/state/[resource].js con su código real: un adaptador mínimo de D1 sobre
// SQLite (node:sqlite) con el esquema de migrations/ y cifrado real con un TEXT_KEY de prueba.
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet, onRequestPut } from '../../functions/api/state/[resource].js';
import { sha256Hex } from '../../server/lib.js';

// Adaptador con la interfaz de D1 que usan las Functions: prepare(sql).bind(...).first()/run()/all().
function d1(db) {
  const wrap = (sql, args = []) => ({
    bind: (...a) => wrap(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    run: async () => db.prepare(sql).run(...args),
    all: async () => ({ results: db.prepare(sql).all(...args) }),
  });
  return { prepare: sql => wrap(sql), batch: async stmts => Promise.all(stmts.map(s => s.run())) };
}

let db;
let env;
const TOKEN = 'token-de-prueba';
beforeEach(async () => {
  db = new DatabaseSync(':memory:');
  for (const f of ['0001_init.sql', '0002_tagset_title.sql', '0003_resource_state.sql']) db.exec(readFileSync(new URL(`../../migrations/${f}`, import.meta.url), 'utf8'));
  db.prepare('INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)').run('u1', 'a@x.com', 'A', 1);
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(await sha256Hex(TOKEN), 'u1', 9_000_000_000_000_000); // vence lejos: algunas pruebas simulan el reloj
  env = { DB: d1(db), TEXT_KEY: 'clave-de-prueba-larga' };
});

const ctx = (method, body) => ({
  request: new Request('https://relab.test/api/state/kit-feriante', {
    method, headers: { cookie: `relab_session=${TOKEN}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }),
  env,
  params: { resource: 'kit-feriante' },
});
const put = async body => { const r = await onRequestPut(ctx('PUT', body)); return { status: r.status, body: await r.json() }; };
const get = async () => (await onRequestGet(ctx('GET'))).json();
const datos = n => ({ ventas: [{ id: 'v' + n, monto: n, ts: n }] });

describe('PUT con versión (baseUpdatedAt)', () => {
  it('cliente anterior, sin baseUpdatedAt: guarda como siempre y devuelve la versión', async () => {
    const a = await put({ data: datos(1) });
    const b = await put({ data: datos(2) });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(b.body.updatedAt).toBeGreaterThan(a.body.updatedAt);
    expect((await get()).data).toEqual(datos(2));
  });

  it('null crea la primera versión; null con datos ya guardados es conflicto', async () => {
    const a = await put({ data: datos(1), baseUpdatedAt: null });
    expect(a.status).toBe(200);
    const b = await put({ data: datos(2), baseUpdatedAt: null });
    expect(b.status).toBe(409);
    expect((await get()).data).toEqual(datos(1));
  });

  it('con la versión actual guarda y devuelve una versión nueva mayor', async () => {
    const a = await put({ data: datos(1) });
    const b = await put({ data: datos(2), baseUpdatedAt: a.body.updatedAt });
    expect(b.status).toBe(200);
    expect(b.body.updatedAt).toBeGreaterThan(a.body.updatedAt);
    expect((await get()).updatedAt).toBe(b.body.updatedAt);
  });

  it('con una versión vieja responde 409 y no cambia nada', async () => {
    const a = await put({ data: datos(1) });
    await put({ data: datos(2), baseUpdatedAt: a.body.updatedAt });
    const c = await put({ data: datos(3), baseUpdatedAt: a.body.updatedAt });
    expect(c.status).toBe(409);
    expect(c.body.error).toBe('conflict');
    expect((await get()).data).toEqual(datos(2));
  });

  it('una versión que no existe (sin datos guardados) es conflicto', async () => {
    expect((await put({ data: datos(1), baseUpdatedAt: 12345 })).status).toBe(409);
    expect((await get()).data).toBeNull();
  });

  it.each([['texto', 'abc'], ['negativa', -1], ['decimal', 1.5], ['objeto', {}], ['lista', [1]], ['booleano', true]])(
    'versión inválida (%s) → 400 sin guardar', async (_, v) => {
      const r = await put({ data: datos(1), baseUpdatedAt: v });
      expect(r.status).toBe(400);
      expect(r.body.error).toBe('invalid_version');
      expect((await get()).data).toBeNull();
    },
  );

  it('dos escrituras en el mismo milisegundo tienen versiones distintas', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    const a = await put({ data: datos(1) });
    const b = await put({ data: datos(2), baseUpdatedAt: a.body.updatedAt });
    const c = await put({ data: datos(3), baseUpdatedAt: a.body.updatedAt }); // versión vieja, mismo ms
    vi.restoreAllMocks();
    expect(b.body.updatedAt).toBe(a.body.updatedAt + 1);
    expect(c.status).toBe(409);
  });

  it('si el reloj va hacia atrás, la versión igual crece', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(2_000_000_000_000);
    const a = await put({ data: datos(1) });
    Date.now.mockReturnValue(1_000_000_000_000);
    const b = await put({ data: datos(2), baseUpdatedAt: a.body.updatedAt });
    vi.restoreAllMocks();
    expect(b.body.updatedAt).toBeGreaterThan(a.body.updatedAt);
  });

  it('20 escrituras simultáneas con la misma versión: se acepta una sola', async () => {
    const a = await put({ data: datos(0) });
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => put({ data: datos(i + 1), baseUpdatedAt: a.body.updatedAt })));
    const ok = results.filter(r => r.status === 200);
    expect(ok.length).toBe(1);
    expect(results.filter(r => r.status === 409).length).toBe(19);
    const final = await get();
    expect(final.updatedAt).toBe(ok[0].body.updatedAt);
    expect(final.data).toEqual(datos(results.indexOf(ok[0]) + 1));
  });

  it('sin sesión: 401', async () => {
    const r = await onRequestPut({ ...ctx('PUT', { data: datos(1) }), request: new Request('https://relab.test/api/state/kit-feriante', { method: 'PUT', body: '{}' }) });
    expect(r.status).toBe(401);
  });
});

describe('GET', () => {
  it('un dato que no se puede descifrar devuelve data null con su versión', async () => {
    const a = await put({ data: datos(1) });
    env.TEXT_KEY = 'otra-clave';
    const g = await get();
    expect(g).toEqual({ data: null, updatedAt: a.body.updatedAt });
    expect((await put({ data: datos(2), baseUpdatedAt: g.updatedAt })).status).toBe(200); // y se puede reemplazar
  });
});
