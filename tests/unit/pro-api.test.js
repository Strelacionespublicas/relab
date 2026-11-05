// Pruebas del acceso PRO por códigos (functions/api/pro, functions/api/admin) con su código real,
// sobre SQLite (node:sqlite) con el esquema de migrations/. El batch es transaccional, como en D1.
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { onRequestGet as proMe } from '../../functions/api/pro/me.js';
import { onRequestPost as redeem } from '../../functions/api/pro/redeem.js';
import { onRequestGet as listCodes, onRequestPost as createCode } from '../../functions/api/admin/codes/index.js';
import { onRequestPost as setActive } from '../../functions/api/admin/codes/[id].js';
import { onRequestDelete as deleteAccount } from '../../functions/api/account.js';
import { sha256Hex } from '../../server/lib.js';
import { getEntitlement, newCode, normalizeCode, requirePro } from '../../server/pro.js';

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
    batch: async stmts => {
      db.exec('BEGIN');
      try { const r = stmts.map(s => s.runSync()); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}

const MIG = ['0001_init.sql', '0002_tagset_title.sql', '0003_resource_state.sql', '0004_pro_acceso.sql'];
const DAY = 86_400_000;
let db;
let env;
const token = id => `token-${id}`;

async function addUser(id, email) {
  db.prepare('INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)').run(id, email, id, 1);
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(await sha256Hex(token(id)), id, 9_000_000_000_000_000);
}

beforeEach(async () => {
  db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of MIG) db.exec(readFileSync(new URL(`../../migrations/${f}`, import.meta.url), 'utf8'));
  await addUser('admin', 'Stella@Example.com');
  await addUser('u1', 'u1@x.com');
  await addUser('u2', 'u2@x.com');
  env = { DB: d1(db), TEXT_KEY: 'clave-de-prueba-larga', ADMIN_EMAILS: 'otra@x.com, stella@example.com' };
});

const ctx = (user, method, path, body, params = {}) => ({
  request: new Request(`https://relab.test${path}`, {
    method,
    headers: { ...(user ? { cookie: `relab_session=${token(user)}` } : {}), 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }),
  env,
  params,
});
const call = async (fn, ...a) => { const r = await fn(ctx(...a)); return { status: r.status, body: await r.json() }; };
const create = (body, user = 'admin') => call(createCode, user, 'POST', '/api/admin/codes', body);
const canjear = (user, code) => call(redeem, user, 'POST', '/api/pro/redeem', { code });
const me = user => call(proMe, user, 'GET', '/api/pro/me');

describe('formato de códigos', () => {
  it('newCode genera FERIA-XXXX-XXXX y normalizeCode lo reconoce escrito de cualquier forma', () => {
    const c = newCode();
    expect(c).toMatch(/^FERIA-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
    const body = c.slice(6).replace('-', '');
    expect(normalizeCode(c.toLowerCase())).toBe(c);
    expect(normalizeCode(` ${body.slice(0, 4)} ${body.slice(4)} `)).toBe(c);
    expect(normalizeCode('feria' + body)).toBe(c);
  });
  it('rechaza lo que no puede ser un código', () => {
    for (const x of ['', 'FERIA', 'FERIA-ABCD', 'FERIA-ABCD-EFG0', 'FERIA-ABCD-EFGI', 'OTRA-ABCD-EFGH', 123, null]) expect(normalizeCode(x)).toBeNull();
  });
});

describe('panel de administración', () => {
  it('solo entra un email de ADMIN_EMAILS (sin importar mayúsculas)', async () => {
    expect((await create({ label: 'X', maxUses: 5 }, 'u1')).status).toBe(403);
    expect((await call(listCodes, 'u1', 'GET', '/api/admin/codes')).status).toBe(403);
    expect((await call(listCodes, null, 'GET', '/api/admin/codes')).status).toBe(401);
    expect((await create({ label: 'Charla', maxUses: 5 })).status).toBe(200);
  });

  it('crea un código: lo devuelve una vez, guarda solo el hash y deja registro', async () => {
    const r = await create({ label: 'Charla nov', maxUses: 50 });
    expect(r.body.code).toMatch(/^FERIA-/);
    expect(r.body.days).toBe(365);
    const row = db.prepare('SELECT * FROM access_codes').get();
    expect(row.code_hash).toBe(await sha256Hex(r.body.code));
    expect(JSON.stringify(row)).not.toContain(r.body.code);
    const list = await call(listCodes, 'admin', 'GET', '/api/admin/codes');
    expect(list.body.codes).toEqual([expect.objectContaining({ label: 'Charla nov', maxUses: 50, uses: 0, active: true, days: 365 })]);
    expect(JSON.stringify(list.body)).not.toContain(r.body.code);
    expect(db.prepare('SELECT action FROM admin_audit').all().map(a => a.action)).toEqual(['code_create']);
  });

  it('valida los datos', async () => {
    for (const b of [{ maxUses: 5 }, { label: 'X' }, { label: 'X', maxUses: 0 }, { label: 'X', maxUses: 5, days: 0 },
      { label: 'X'.repeat(81), maxUses: 5 }, { label: 'X', maxUses: 5, redeemUntil: Date.now() - 1000 }]) {
      expect((await create(b)).status).toBe(400);
    }
  });

  it('desactivar impide canjes nuevos pero no quita PRO a quien ya lo tenía', async () => {
    const { body } = await create({ label: 'X', maxUses: 5 });
    expect((await canjear('u1', body.code)).status).toBe(200);
    expect((await call(setActive, 'admin', 'POST', `/api/admin/codes/${body.id}`, { active: false }, { id: body.id })).status).toBe(200);
    expect((await canjear('u2', body.code)).body.error).toBe('invalid_code');
    expect((await me('u1')).body.pro).toBe(true);
    expect((await call(setActive, 'admin', 'POST', '/api/admin/codes/nada', { active: false }, { id: 'nada' })).status).toBe(404);
    expect((await call(setActive, 'u1', 'POST', `/api/admin/codes/${body.id}`, { active: true }, { id: body.id })).status).toBe(403);
  });
});

describe('canje', () => {
  it('da PRO por los días del código y /me lo muestra', async () => {
    const { body } = await create({ label: 'Lanzamiento', maxUses: 10 });
    expect((await me('u1')).body).toMatchObject({ user: true, pro: false, admin: false });
    const t0 = Date.now();
    const r = await canjear('u1', body.code.toLowerCase());
    expect(r.status).toBe(200);
    expect(r.body.endsAt).toBeGreaterThanOrEqual(t0 + 365 * DAY);
    expect(r.body.endsAt).toBeLessThanOrEqual(Date.now() + 365 * DAY);
    expect((await me('u1')).body).toMatchObject({ pro: true, source: 'code', label: 'Lanzamiento', endsAt: r.body.endsAt });
    expect((await me('u2')).body.pro).toBe(false);
    expect(db.prepare('SELECT uses FROM access_codes').get().uses).toBe(1);
  });

  it('sin sesión: /me responde pro false y el canje 401', async () => {
    expect((await me(null)).body).toEqual({ pro: false, user: false });
    expect((await canjear(null, 'FERIA-AAAA-AAAA')).status).toBe(401);
  });

  it('código inexistente o mal escrito', async () => {
    expect((await canjear('u1', 'FERIA-2222-2222')).body.error).toBe('invalid_code');
    expect((await canjear('u1', 'cualquier cosa')).body.error).toBe('invalid_code');
  });

  it('código vencido', async () => {
    const { body } = await create({ label: 'X', maxUses: 5, redeemUntil: Date.now() + 60_000 });
    db.prepare('UPDATE access_codes SET redeem_until = ?').run(Date.now() - 1);
    expect((await canjear('u1', body.code)).body.error).toBe('expired');
    expect((await me('u1')).body.pro).toBe(false);
  });

  it('sin cupo', async () => {
    const { body } = await create({ label: 'X', maxUses: 1 });
    expect((await canjear('u1', body.code)).status).toBe(200);
    expect((await canjear('u2', body.code)).body.error).toBe('no_uses_left');
  });

  it('con PRO vigente no consume otro código; con PRO vencido sí', async () => {
    const a = (await create({ label: 'A', maxUses: 5 })).body;
    const b = (await create({ label: 'B', maxUses: 5 })).body;
    await canjear('u1', a.code);
    const r = await canjear('u1', b.code);
    expect(r.body.error).toBe('already_pro');
    expect(db.prepare('SELECT uses FROM access_codes WHERE id = ?').get(b.id).uses).toBe(0);
    db.prepare('UPDATE entitlements SET ends_at = ?').run(Date.now() - 1);
    expect((await me('u1')).body.pro).toBe(false);
    expect((await canjear('u1', b.code)).status).toBe(200);
    expect((await me('u1')).body.label).toBe('B');
  });

  it('el mismo código dos veces (con el permiso ya vencido) no se acepta', async () => {
    const { body } = await create({ label: 'A', maxUses: 5 });
    await canjear('u1', body.code);
    db.prepare('UPDATE entitlements SET ends_at = ?').run(Date.now() - 1);
    expect((await canjear('u1', body.code)).body.error).toBe('already_redeemed');
  });

  it('20 canjes simultáneos con cupo 5: exactamente 5 permisos y 5 usos', async () => {
    const { body } = await create({ label: 'X', maxUses: 5 });
    const ids = Array.from({ length: 20 }, (_, i) => `c${i}`);
    for (const id of ids) await addUser(id, `${id}@x.com`);
    const res = await Promise.all(ids.map(id => canjear(id, body.code)));
    expect(res.filter(r => r.status === 200)).toHaveLength(5);
    expect(res.filter(r => r.status !== 200).every(r => r.body.error === 'no_uses_left')).toBe(true);
    expect(db.prepare('SELECT uses FROM access_codes').get().uses).toBe(5);
    expect(db.prepare('SELECT COUNT(*) n FROM entitlements').get().n).toBe(5);
    expect(db.prepare('SELECT COUNT(*) n FROM redemptions').get().n).toBe(5);
  });

  it('si el cupo se llena entre la comprobación y el guardado, la transacción no crea nada', async () => {
    const { body } = await create({ label: 'X', maxUses: 5 });
    const real = env.DB;
    // Simula otro pedido que termina justo antes que este: el cupo se llena en ese instante.
    env = { ...env, DB: { ...real, batch: async s => { db.prepare('UPDATE access_codes SET uses = max_uses').run(); return real.batch(s); } } };
    const r = await canjear('u1', body.code);
    expect(r.body.error).toBe('no_uses_left');
    expect(db.prepare('SELECT COUNT(*) n FROM entitlements').get().n).toBe(0);
    expect(db.prepare('SELECT COUNT(*) n FROM redemptions').get().n).toBe(0);
    expect(db.prepare('SELECT uses FROM access_codes').get().uses).toBe(5);
  });

  it('la misma persona canjeando dos veces a la vez: un solo permiso y un solo uso', async () => {
    const { body } = await create({ label: 'X', maxUses: 5 });
    const res = await Promise.all([canjear('u1', body.code), canjear('u1', body.code), canjear('u1', body.code)]);
    expect(res.filter(r => r.status === 200)).toHaveLength(1);
    expect(db.prepare('SELECT uses FROM access_codes').get().uses).toBe(1);
    expect(db.prepare('SELECT COUNT(*) n FROM entitlements').get().n).toBe(1);
  });
});

describe('permisos en el servidor', () => {
  it('requirePro: 401 sin sesión, 403 sin PRO, usuario con PRO', async () => {
    expect((await requirePro(ctx(null, 'POST', '/api/pro/ops'))).status).toBe(401);
    const sin = await requirePro(ctx('u1', 'POST', '/api/pro/ops'));
    expect(sin.status).toBe(403);
    expect((await sin.json()).error).toBe('pro_required');
    const { body } = await create({ label: 'X', maxUses: 5 });
    await canjear('u1', body.code);
    const con = await requirePro(ctx('u1', 'POST', '/api/pro/ops'));
    expect(con.user.id).toBe('u1');
  });

  it('sin la migración 0004 nadie tiene PRO y nada se rompe', async () => {
    const viejo = new DatabaseSync(':memory:');
    for (const f of MIG.slice(0, 3)) viejo.exec(readFileSync(new URL(`../../migrations/${f}`, import.meta.url), 'utf8'));
    expect(await getEntitlement({ DB: d1(viejo) }, 'u1')).toBeNull();
  });

  it('borrar la cuenta borra permisos y canjes, y no descuenta usos', async () => {
    const { body } = await create({ label: 'X', maxUses: 5 });
    await canjear('u1', body.code);
    expect((await deleteAccount(ctx('u1', 'DELETE', '/api/account'))).status).toBe(200);
    expect(db.prepare("SELECT COUNT(*) n FROM entitlements WHERE user_id = 'u1'").get().n).toBe(0);
    expect(db.prepare("SELECT COUNT(*) n FROM redemptions WHERE user_id = 'u1'").get().n).toBe(0);
    expect(db.prepare('SELECT uses FROM access_codes').get().uses).toBe(1);
  });
});
