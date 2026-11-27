// Pruebas de src/kit/sync.js: dueño del estado local, conciliación, sin conexión, reintentos y duplicados.
// Se simula el servidor de Relab (sesiones, /api/me, /api/state, /api/auth/logout) en memoria.
import { beforeEach, describe, expect, it } from 'vitest';
import { containedIn, createKitSync, merge3, mergeFirst } from '../../src/kit/sync.js';
import { emptyState, hasData, normalize } from '../../src/kit/state.js';

const venta = (id, monto = 1000, ts = 1) => ({ id, prod: 'P' + id, monto, medio: 'efect', ts });
const S = data => normalize(data);

// ---- Servidor y navegador simulados ----
function makeServer() {
  const rows = new Map(); // email → { data, updatedAt }
  let clock = 1000;
  const srv = {
    session: null, // email de la sesión de la cookie, o null
    down: false, // sin red
    failPut: 0, // cuántos PUT fallan con 500
    loseResponse: 0, // PUT que se guarda pero la respuesta no llega (red cortada)
    puts: 0,
    conflicts: 0, // 409 respondidos
    legacy: false, // servidor anterior: ignora baseUpdatedAt y no devuelve versión
    forceConflict: 0, // cuántos PUT con versión se rechazan con 409 aunque coincida
    gate: null, // si hay una promesa, los PUT esperan a que se resuelva (para soltarlos juntos)
    rows,
    hold() { let open; srv.gate = new Promise(r => { open = r; }); return () => { srv.gate = null; open(); }; },
    async fetch(path, init = {}) {
      if (srv.down) throw new TypeError('Failed to fetch');
      if ((init.method || 'GET') === 'PUT' && srv.gate) await srv.gate;
      const method = init.method || 'GET';
      const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
      if (path === '/api/me') return res(200, { user: srv.session ? { name: 'Persona ' + srv.session, email: srv.session } : null });
      if (path === '/api/auth/logout') { srv.session = null; return res(204, null); }
      if (!srv.session) return res(401, { error: 'unauthorized' });
      if (method === 'GET') return res(200, rows.get(srv.session) ? { data: rows.get(srv.session).data, updatedAt: rows.get(srv.session).updatedAt } : { data: null });
      if (srv.failPut > 0) { srv.failPut--; return res(500, { error: 'server_error' }); }
      const body = JSON.parse(init.body);
      // Misma regla que functions/api/state/[resource].js: con baseUpdatedAt solo se guarda si es la versión actual.
      if (!srv.legacy && 'baseUpdatedAt' in body) {
        const current = rows.get(srv.session)?.updatedAt ?? null;
        if (srv.forceConflict > 0 || body.baseUpdatedAt !== current) { if (srv.forceConflict > 0) srv.forceConflict--; srv.conflicts++; return res(409, { error: 'conflict' }); }
      }
      rows.set(srv.session, { data: JSON.parse(JSON.stringify(body.data)), updatedAt: ++clock });
      srv.puts++;
      if (srv.loseResponse > 0) { srv.loseResponse--; throw new TypeError('network'); }
      return res(200, srv.legacy ? { ok: true } : { ok: true, updatedAt: clock });
    },
    remote: email => normalize(rows.get(email)?.data),
  };
  return srv;
}
const memStorage = () => {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), keys: () => [...m.keys()], m };
};
function device(srv, storage = memStorage(), session = memStorage()) {
  let online = true;
  const sync = createKitSync({ storage, session, fetchImpl: (...a) => srv.fetch(...a), isOnline: () => online && !srv.down, autoSync: false, conflictDelay: () => 0 });
  return { sync, storage, session, setOnline: v => { online = v; }, data: () => sync.snapshot().data, status: () => sync.snapshot().status };
}
const addVenta = (d, v) => d.sync.update(s => ({ ...s, ventas: [...s.ventas, v] }));
const logoutFn = srv => () => srv.fetch('/api/auth/logout', { method: 'POST' });

let srv;
beforeEach(() => { srv = makeServer(); });

describe('merge3 (política de conflictos)', () => {
  const base = { data: S({ ventas: [venta('a'), venta('b')], checks: { 'pre-1': true }, calc: { fijos: { alquiler: '100' } } }), confirmed: ['a', 'b'] };
  it('conserva ventas nuevas de los dos lados', () => {
    const local = S({ ...base.data, ventas: [...base.data.ventas, venta('c', 1, 3)] });
    const remote = S({ ...base.data, ventas: [...base.data.ventas, venta('d', 1, 4)] });
    expect(merge3(base, local, remote).ventas.map(v => v.id)).toEqual(['a', 'b', 'c', 'd']);
  });
  it('un borrado en cualquiera de los dos lados se respeta', () => {
    const local = S({ ...base.data, ventas: [venta('b')] }); // borré 'a'
    const remote = S({ ...base.data, ventas: [venta('a')] }); // en otro borraron 'b'
    expect(merge3(base, local, remote).ventas).toEqual([]);
  });
  it('una venta que el servidor nunca confirmó no se pierde si otro la pisó', () => {
    const b = { data: S({ ventas: [venta('a'), venta('n', 1, 2)] }), confirmed: ['a'] }; // 'n' se subió pero otro dispositivo la pisó
    const remote = S({ ventas: [venta('a')] });
    expect(merge3(b, b.data, remote).ventas.map(v => v.id)).toEqual(['a', 'n']);
  });
  it('checklist por ítem: gana el cambio, no un estado viejo', () => {
    const local = S({ ...base.data, checks: {} }); // desmarqué pre-1
    const remote = S({ ...base.data, checks: { 'pre-1': true, 'pre-2': true } }); // marcaron pre-2
    expect(merge3(base, local, remote).checks).toEqual({ 'pre-2': true });
  });
  it('calculadora y ROI por campo: lo que no cambié acá no pisa lo nuevo de la cuenta', () => {
    const local = S({ ...base.data, calc: { fijos: { alquiler: '100', deco: '50' } } });
    const remote = S({ ...base.data, calc: { fijos: { alquiler: '300' } }, roi: { ef: '9000' } });
    const m = merge3(base, local, remote);
    expect(m.calc.fijos).toEqual({ alquiler: '300', deco: '50' });
    expect(m.roi.ef).toBe('9000');
  });
  it('si los dos cambiaron el mismo campo, gana el dispositivo que sincroniza', () => {
    const local = S({ ...base.data, calc: { fijos: { alquiler: '200' } } });
    const remote = S({ ...base.data, calc: { fijos: { alquiler: '300' } } });
    expect(merge3(base, local, remote).calc.fijos.alquiler).toBe('200');
  });
});

describe('mergeFirst y containedIn', () => {
  it('primera vez: suma ventas y marcas, respeta lo que la cuenta ya tiene', () => {
    const local = S({ ventas: [venta('x')], checks: { 'pre-1': true }, calc: { fijos: { alquiler: '1', deco: '2' } } });
    const remote = S({ ventas: [venta('y')], checks: { 'pre-2': true }, calc: { fijos: { alquiler: '9' } } });
    const m = mergeFirst(local, remote);
    expect(m.ventas.map(v => v.id).sort()).toEqual(['x', 'y']);
    expect(m.checks).toEqual({ 'pre-1': true, 'pre-2': true });
    expect(m.calc.fijos).toEqual({ alquiler: '9', deco: '2' });
  });
  it('containedIn detecta datos que ya están en la cuenta', () => {
    const remote = S({ ventas: [venta('a'), venta('b')], checks: { 'pre-1': true } });
    expect(containedIn(S({ ventas: [venta('a')] }), remote)).toBe(true);
    expect(containedIn(S({ ventas: [venta('z')] }), remote)).toBe(false);
    expect(containedIn(emptyState(), remote)).toBe(true);
  });
});

describe('Usuario A y usuario B en el mismo navegador', () => {
  it('A cierra sesión, B ingresa: no ve ni recibe los datos de A', async () => {
    const d = device(srv);
    srv.session = 'a@x.com';
    await d.sync.start();
    addVenta(d, venta('a1', 5000));
    await d.sync.syncNow();
    expect(d.status()).toBe('guardado');
    await d.sync.logout(logoutFn(srv));
    expect(d.data().ventas).toEqual([]); // se limpió la vista
    expect(JSON.stringify([...d.storage.m.values()])).not.toContain('a1'); // no quedó nada de A en el navegador
    srv.session = 'b@x.com';
    await d.sync.start();
    expect(d.data().ventas).toEqual([]);
    expect(srv.remote('b@x.com').ventas).toEqual([]);
    expect(srv.remote('a@x.com').ventas.map(v => v.id)).toEqual(['a1']);
  });

  it('A no cerró sesión (venció) y B ingresa: los datos de A no se asignan a B', async () => {
    const d = device(srv);
    srv.session = 'a@x.com';
    await d.sync.start();
    srv.down = true;
    addVenta(d, venta('a2', 7000)); // quedó pendiente
    srv.down = false;
    srv.session = 'b@x.com'; // otra persona, mismo navegador
    const d2 = device(srv, d.storage, d.session);
    await d2.sync.start();
    expect(d2.data().ventas).toEqual([]);
    expect(srv.remote('b@x.com').ventas).toEqual([]);
    // Cuando A vuelve a ingresar, recupera su venta pendiente y se sube a su cuenta.
    srv.session = 'a@x.com';
    const d3 = device(srv, d.storage, d.session);
    await d3.sync.start();
    expect(d3.data().ventas.map(v => v.id)).toEqual(['a2']);
    expect(srv.remote('a@x.com').ventas.map(v => v.id)).toEqual(['a2']);
    expect(d3.storage.keys().some(k => k.includes('resguardo'))).toBe(false); // el resguardo se limpia al confirmarse
  });

  it('sin sesión, el navegador no muestra datos de una cuenta', async () => {
    const d = device(srv);
    srv.session = 'a@x.com';
    await d.sync.start();
    addVenta(d, venta('a3'));
    await d.sync.syncNow();
    srv.session = null; // la sesión venció
    const d2 = device(srv, d.storage, d.session);
    expect(d2.sync.snapshot().data.ventas).toEqual([]); // ni siquiera antes de comprobar la sesión
    await d2.sync.start();
    expect(d2.data().ventas).toEqual([]);
    expect(d2.status()).toBe('local');
  });

  it('cerrar sesión con cambios sin subir los guarda aparte y avisa', async () => {
    const d = device(srv);
    srv.session = 'a@x.com';
    await d.sync.start();
    srv.down = true;
    addVenta(d, venta('p1'));
    await d.sync.logout(logoutFn(srv));
    expect(d.sync.snapshot().notice).toBe('resguardo');
    expect(d.data().ventas).toEqual([]);
    srv.down = false;
    srv.session = 'a@x.com';
    const d2 = device(srv, d.storage, d.session);
    await d2.sync.start();
    expect(srv.remote('a@x.com').ventas.map(v => v.id)).toEqual(['p1']);
  });
});

describe('Datos sin cuenta al ingresar', () => {
  it('si se ingresa desde el kit, se suman a la cuenta sin preguntar', async () => {
    const d = device(srv);
    await d.sync.start(); // sin sesión
    addVenta(d, venta('s1'));
    d.sync.markLoginIntent();
    srv.session = 'a@x.com';
    srv.rows.set('a@x.com', { data: S({ ventas: [venta('old', 1, 0)] }), updatedAt: 5 });
    const d2 = device(srv, d.storage, d.session);
    await d2.sync.start();
    expect(srv.remote('a@x.com').ventas.map(v => v.id)).toEqual(['old', 's1']);
    expect(d2.status()).toBe('guardado');
  });

  it('si no, pregunta; "sumar" los agrega y "no" los deja en el dispositivo', async () => {
    const d = device(srv);
    await d.sync.start();
    addVenta(d, venta('s2'));
    srv.session = 'a@x.com';
    const d2 = device(srv, d.storage, d.session);
    await d2.sync.start();
    expect(d2.sync.snapshot().anonPending).toEqual({ ventas: 1, items: 0 });
    expect(srv.remote('a@x.com').ventas).toEqual([]); // no se subió nada sin permiso
    await d2.sync.acceptAnon();
    expect(srv.remote('a@x.com').ventas.map(v => v.id)).toEqual(['s2']);

    const e = device(srv);
    srv.session = null;
    await e.sync.start();
    addVenta(e, venta('s3'));
    srv.session = 'b@x.com';
    const e2 = device(srv, e.storage, e.session);
    await e2.sync.start();
    e2.sync.dismissAnon();
    expect(srv.remote('b@x.com').ventas).toEqual([]);
    await e2.sync.logout(logoutFn(srv));
    expect(e2.data().ventas.map(v => v.id)).toEqual(['s3']); // vuelven a verse sin cuenta
  });
});

describe('Sin conexión y reconexión', () => {
  it('registra ventas sin red, avisa y sincroniza al volver', async () => {
    const d = device(srv);
    srv.session = 'a@x.com';
    await d.sync.start();
    srv.down = true;
    addVenta(d, venta('o1'));
    addVenta(d, venta('o2'));
    expect(d.status()).toBe('sin-conexion');
    await d.sync.syncNow();
    expect(d.status()).toBe('sin-conexion');
    expect(d.sync.snapshot().dirty).toBe(true);
    srv.down = false;
    await d.sync.resume();
    expect(d.status()).toBe('guardado');
    expect(srv.remote('a@x.com').ventas.map(v => v.id)).toEqual(['o1', 'o2']);
  });

  it('abrir el kit sin red con datos de la cuenta: se puede seguir y luego se comprueba la sesión', async () => {
    const d = device(srv);
    srv.session = 'a@x.com';
    await d.sync.start();
    addVenta(d, venta('k1'));
    await d.sync.syncNow();
    srv.down = true;
    const d2 = device(srv, d.storage, d.session);
    await d2.sync.start();
    expect(d2.status()).toBe('sin-conexion');
    expect(d2.data().ventas.map(v => v.id)).toEqual(['k1']);
    addVenta(d2, venta('k2'));
    srv.down = false;
    await d2.sync.resume();
    expect(srv.remote('a@x.com').ventas.map(v => v.id)).toEqual(['k1', 'k2']);
  });

  it('un estado viejo de la cuenta no pisa las ventas nuevas del dispositivo', async () => {
    const d = device(srv);
    srv.session = 'a@x.com';
    await d.sync.start();
    addVenta(d, venta('v1'));
    await d.sync.syncNow();
    srv.down = true;
    addVenta(d, venta('v2', 1, 2));
    srv.down = false;
    const d2 = device(srv, d.storage, d.session); // recarga con red: la cuenta todavía tiene solo v1
    await d2.sync.start();
    expect(d2.data().ventas.map(v => v.id)).toEqual(['v1', 'v2']);
    expect(srv.remote('a@x.com').ventas.map(v => v.id)).toEqual(['v1', 'v2']);
  });
});

describe('Reintentos, recargas y duplicados', () => {
  it('un error del servidor muestra "error" y el reintento no duplica', async () => {
    const d = device(srv);
    srv.session = 'a@x.com';
    await d.sync.start();
    srv.failPut = 2;
    addVenta(d, venta('r1'));
    await d.sync.syncNow();
    expect(d.status()).toBe('error');
    await d.sync.syncNow();
    expect(d.status()).toBe('error');
    await d.sync.syncNow();
    expect(d.status()).toBe('guardado');
    expect(srv.remote('a@x.com').ventas.map(v => v.id)).toEqual(['r1']);
  });

  it('si la respuesta del guardado se pierde, el reintento no crea duplicados', async () => {
    const d = device(srv);
    srv.session = 'a@x.com';
    await d.sync.start();
    srv.loseResponse = 1;
    addVenta(d, venta('l1'));
    await d.sync.syncNow();
    expect(d.status()).toBe('sin-conexion');
    await d.sync.syncNow();
    expect(d.status()).toBe('guardado');
    expect(srv.remote('a@x.com').ventas.map(v => v.id)).toEqual(['l1']);
  });

  it('recargar la página durante un guardado no pierde ni duplica', async () => {
    const d = device(srv);
    srv.session = 'a@x.com';
    await d.sync.start();
    addVenta(d, venta('g1'));
    // La página se cierra antes de sincronizar: el cambio quedó marcado como pendiente.
    const d2 = device(srv, d.storage, d.session);
    await d2.sync.start();
    expect(srv.remote('a@x.com').ventas.map(v => v.id)).toEqual(['g1']);
    const d3 = device(srv, d.storage, d.session);
    await d3.sync.start();
    expect(srv.remote('a@x.com').ventas.map(v => v.id)).toEqual(['g1']);
  });

  it('dos dispositivos de la misma cuenta suman sus ventas', async () => {
    const a = device(srv);
    const b = device(srv);
    srv.session = 'a@x.com';
    await a.sync.start();
    await b.sync.start();
    addVenta(a, venta('d1'));
    addVenta(b, venta('d2', 1, 2));
    await a.sync.syncNow();
    await b.sync.syncNow();
    await a.sync.syncNow();
    expect(srv.remote('a@x.com').ventas.map(v => v.id)).toEqual(['d1', 'd2']);
    expect(a.data().ventas.map(v => v.id)).toEqual(['d1', 'd2']);
  });

  it('"Guardado" recién cuando el servidor confirma', async () => {
    const d = device(srv);
    srv.session = 'a@x.com';
    await d.sync.start();
    addVenta(d, venta('c1'));
    expect(d.status()).toBe('guardando');
    const p = d.sync.syncNow();
    expect(d.status()).toBe('guardando');
    await p;
    expect(d.status()).toBe('guardado');
  });

  it('sesión vencida mientras se usa: queda guardado en el dispositivo', async () => {
    const d = device(srv);
    srv.session = 'a@x.com';
    await d.sync.start();
    srv.session = null;
    addVenta(d, venta('x1'));
    await d.sync.syncNow();
    expect(d.status()).toBe('sesion');
    expect(d.sync.snapshot().dirty).toBe(true);
  });
});

describe('Compatibilidad con los datos existentes', () => {
  it('migra el formato anterior del navegador sin perder nada', async () => {
    const storage = memStorage();
    const legacy = { checks: { 'pre-1': true }, ventas: [venta('L1', 12000)], calc: { fijos: { alquiler: '120.000' } }, roi: { ef: '5000' } };
    storage.setItem('relab-kit-feriante', JSON.stringify(legacy));
    const d = device(srv, storage);
    await d.sync.start(); // sin sesión
    expect(d.data().ventas.map(v => v.id)).toEqual(['L1']);
    expect(d.data().calc.fijos.alquiler).toBe('120.000');
    expect(storage.getItem('relab-kit-feriante')).toBeNull(); // se migró a la clave nueva
    expect(JSON.parse(storage.getItem('relab-kit-feriante:v2')).data.ventas[0].id).toBe('L1');
  });

  it('formato anterior de alguien con cuenta: si ya está en la cuenta se adopta sin preguntar', async () => {
    const legacy = { ventas: [venta('L2')], checks: {}, calc: {}, roi: {} };
    srv.rows.set('a@x.com', { data: S({ ventas: [venta('L2'), venta('L3', 1, 2)] }), updatedAt: 7 });
    const storage = memStorage();
    storage.setItem('relab-kit-feriante', JSON.stringify(legacy));
    srv.session = 'a@x.com';
    const d = device(srv, storage);
    await d.sync.start();
    expect(d.sync.snapshot().anonPending).toBeNull();
    expect(d.data().ventas.map(v => v.id)).toEqual(['L2', 'L3']);
  });

  it('si una pestaña vieja escribe después de migrar, sus datos no se pierden (sin cuenta)', async () => {
    const d = device(srv);
    await d.sync.start(); // ya migrado, sin cuenta
    addVenta(d, venta('n1'));
    d.storage.setItem('relab-kit-feriante', JSON.stringify({ ventas: [venta('vieja', 1, 0)] })); // pestaña vieja
    const d2 = device(srv, d.storage, d.session);
    await d2.sync.start();
    expect(d2.data().ventas.map(v => v.id)).toEqual(['vieja', 'n1']);
    expect(d2.storage.getItem('relab-kit-feriante')).toBeNull();
  });

  it('si una pestaña vieja escribe con una cuenta en uso, se pregunta antes de sumar (salvo que ya esté)', async () => {
    const d = device(srv);
    srv.session = 'a@x.com';
    await d.sync.start();
    addVenta(d, venta('c1'));
    await d.sync.syncNow();
    d.storage.setItem('relab-kit-feriante', JSON.stringify({ ventas: [venta('c1'), venta('c2', 1, 2)] }));
    const d2 = device(srv, d.storage, d.session);
    await d2.sync.start();
    expect(d2.sync.snapshot().anonPending).toEqual({ ventas: 2, items: 0 });
    await d2.sync.acceptAnon();
    expect(srv.remote('a@x.com').ventas.map(v => v.id)).toEqual(['c1', 'c2']);

    d2.storage.setItem('relab-kit-feriante', JSON.stringify({ ventas: [venta('c1')] })); // ya está en la cuenta
    const d3 = device(srv, d.storage, d.session);
    await d3.sync.start();
    expect(d3.sync.snapshot().anonPending).toBeNull();
  });

  it('lee estados guardados en la cuenta con la forma de siempre', async () => {
    srv.rows.set('a@x.com', { data: { checks: { 'pre-2': true }, ventas: [venta('R1')], calc: { fijos: {}, productos: [], comision: '3', pctDigital: '70' }, roi: { dias: '1' } }, updatedAt: 3 });
    srv.session = 'a@x.com';
    const d = device(srv);
    await d.sync.start();
    expect(d.data().checks).toEqual({ 'pre-2': true });
    expect(d.data().ventas.map(v => v.id)).toEqual(['R1']);
    expect(srv.puts).toBe(1); // solo se normaliza una vez (agrega un producto vacío), sin cambiar datos
    expect(Object.keys(srv.rows.get('a@x.com').data).sort()).toEqual(['calc', 'checks', 'costos', 'propios', 'roi', 'sueldo', 'ventas']); // misma forma, más "sueldo", "propios" y "costos" (vacíos)
  });
});

describe('Concurrencia con versión en el servidor (409)', () => {
  // Dos dispositivos de la misma cuenta, sincronizados y con la misma versión.
  async function dos() {
    srv.session = 'a@x.com';
    const a = device(srv);
    const b = device(srv);
    await a.sync.start();
    addVenta(a, venta('base', 1, 0));
    await a.sync.syncNow();
    await b.sync.start();
    return { a, b };
  }
  // Los dos guardan "a la vez": los PUT quedan retenidos y se sueltan juntos.
  async function juntos(a, b) {
    const soltar = srv.hold();
    const pa = a.sync.syncNow();
    const pb = b.sync.syncNow();
    await new Promise(r => setTimeout(r, 0));
    soltar();
    await Promise.all([pa, pb]);
  }

  it('A y B leen la misma versión, registran una venta cada uno y guardan juntos: quedan las dos', async () => {
    const { a, b } = await dos();
    addVenta(a, venta('A', 100, 1));
    addVenta(b, venta('B', 200, 2));
    await juntos(a, b);
    expect(srv.conflicts).toBe(1); // el servidor aceptó una escritura y rechazó la otra
    expect(srv.remote('a@x.com').ventas.map(v => v.id)).toEqual(['base', 'A', 'B']);
    expect(a.status()).toBe('guardado');
    expect(b.status()).toBe('guardado');
    await a.sync.syncNow();
    expect(a.data().ventas.map(v => v.id)).toEqual(['base', 'A', 'B']);
    expect(b.data().ventas.map(v => v.id)).toEqual(['base', 'A', 'B']);
  });

  it('borrado simultáneo: una venta borrada en A no reaparece aunque B guarde a la vez', async () => {
    const { a, b } = await dos();
    a.sync.update(s => ({ ...s, ventas: s.ventas.filter(v => v.id !== 'base') }));
    addVenta(b, venta('B', 1, 2));
    await juntos(a, b);
    expect(srv.remote('a@x.com').ventas.map(v => v.id)).toEqual(['B']);
    await a.sync.syncNow();
    expect(a.data().ventas.map(v => v.id)).toEqual(['B']);
    expect(b.data().ventas.map(v => v.id)).toEqual(['B']);
  });

  it('borrado simultáneo de ventas distintas: se respetan los dos borrados', async () => {
    srv.session = 'a@x.com';
    const a = device(srv);
    const b = device(srv);
    await a.sync.start();
    addVenta(a, venta('x', 1, 1));
    addVenta(a, venta('y', 1, 2));
    addVenta(a, venta('z', 1, 3));
    await a.sync.syncNow();
    await b.sync.start();
    a.sync.update(s => ({ ...s, ventas: s.ventas.filter(v => v.id !== 'x') }));
    b.sync.update(s => ({ ...s, ventas: s.ventas.filter(v => v.id !== 'y') }));
    await juntos(a, b);
    expect(srv.remote('a@x.com').ventas.map(v => v.id)).toEqual(['z']);
  });

  it('checklist concurrente: ítems distintos se suman; el mismo ítem queda como lo dejó el último en guardar', async () => {
    const { a, b } = await dos();
    a.sync.update(s => ({ ...s, checks: { ...s.checks, 'pre-1': true } }));
    b.sync.update(s => ({ ...s, checks: { ...s.checks, 'pre-2': true } }));
    await juntos(a, b);
    expect(srv.remote('a@x.com').checks).toEqual({ 'pre-1': true, 'pre-2': true });
    a.sync.update(s => ({ ...s, checks: { ...s.checks, 'pre-3': true } }));
    await a.sync.syncNow();
    await b.sync.syncNow();
    b.sync.update(s => ({ ...s, checks: { ...s.checks, 'pre-3': false } })); // B lo desmarca después
    await b.sync.syncNow();
    expect(srv.remote('a@x.com').checks['pre-3']).toBeFalsy();
  });

  it('calculadora y ROI concurrentes: campos distintos se combinan', async () => {
    const { a, b } = await dos();
    a.sync.update(s => ({ ...s, calc: { ...s.calc, fijos: { ...s.calc.fijos, alquiler: '120.000' } }, roi: { ...s.roi, stand: '120.000' } }));
    b.sync.update(s => ({ ...s, calc: { ...s.calc, comision: '4' }, roi: { ...s.roi, ef: '50.000' } }));
    await juntos(a, b);
    const r = srv.remote('a@x.com');
    expect(r.calc.fijos.alquiler).toBe('120.000');
    expect(r.calc.comision).toBe('4');
    expect(r.roi).toMatchObject({ stand: '120.000', ef: '50.000' });
  });

  it('mismo campo cambiado en los dos a la vez: gana el que concilia último y nadie queda con un valor distinto', async () => {
    const { a, b } = await dos();
    a.sync.update(s => ({ ...s, calc: { ...s.calc, fijos: { alquiler: '100' } } }));
    b.sync.update(s => ({ ...s, calc: { ...s.calc, fijos: { alquiler: '200' } } }));
    await juntos(a, b);
    await a.sync.syncNow();
    const final = srv.remote('a@x.com').calc.fijos.alquiler;
    expect(['100', '200']).toContain(final);
    expect(a.data().calc.fijos.alquiler).toBe(final);
    expect(b.data().calc.fijos.alquiler).toBe(final);
  });

  it('reconexión después de trabajar sin señal mientras el otro guardaba', async () => {
    const { a, b } = await dos();
    b.setOnline(false);
    addVenta(b, venta('sinSenal1', 1, 5));
    addVenta(b, venta('sinSenal2', 1, 6));
    addVenta(a, venta('conSenal', 1, 7));
    await a.sync.syncNow();
    a.sync.update(s => ({ ...s, ventas: s.ventas.filter(v => v.id !== 'base') })); // A borra una mientras B no tiene señal
    await a.sync.syncNow();
    b.setOnline(true);
    await b.sync.resume();
    expect(srv.remote('a@x.com').ventas.map(v => v.id)).toEqual(['sinSenal1', 'sinSenal2', 'conSenal']);
    expect(b.status()).toBe('guardado');
  });

  it('un cliente anterior sin baseUpdatedAt guarda en el medio: el nuevo lo detecta y no pierde nada', async () => {
    const { a } = await dos();
    addVenta(a, venta('nueva', 1, 3));
    // Cliente anterior: escribe todo sin versión (sumó una venta propia sobre lo que leyó).
    await srv.fetch('/api/state/kit-feriante', { method: 'PUT', body: JSON.stringify({ data: { ...srv.remote('a@x.com'), ventas: [venta('base', 1, 0), venta('vieja', 1, 2)] } }) });
    await a.sync.syncNow();
    expect(srv.remote('a@x.com').ventas.map(v => v.id)).toEqual(['base', 'vieja', 'nueva']);
  });

  it('contra un servidor anterior (sin versión) sigue funcionando como en la Corrección 2', async () => {
    srv.legacy = true;
    const { a, b } = await dos();
    addVenta(a, venta('A', 1, 1));
    await a.sync.syncNow();
    addVenta(b, venta('B', 1, 2));
    await b.sync.syncNow();
    await a.sync.syncNow();
    expect(srv.remote('a@x.com').ventas.map(v => v.id)).toEqual(['base', 'A', 'B']);
    expect(srv.conflicts).toBe(0);
  });

  it('reintentos repetidos: con 409 permanente corta a los 5 intentos, avisa y luego se resuelve sin duplicar', async () => {
    const { a } = await dos();
    srv.forceConflict = 1000;
    addVenta(a, venta('R', 1, 4));
    await a.sync.syncNow();
    expect(srv.conflicts).toBe(5); // no hay bucle infinito
    expect(a.status()).toBe('conflicto');
    expect(a.sync.snapshot().dirty).toBe(true);
    await a.sync.syncNow();
    expect(srv.conflicts).toBe(10);
    srv.forceConflict = 0;
    await a.sync.syncNow();
    expect(a.status()).toBe('guardado');
    expect(srv.remote('a@x.com').ventas.map(v => v.id)).toEqual(['base', 'R']);
  });

  it('un 409 aislado se resuelve solo en el mismo guardado', async () => {
    const { a } = await dos();
    srv.forceConflict = 2;
    addVenta(a, venta('S', 1, 4));
    await a.sync.syncNow();
    expect(a.status()).toBe('guardado');
    expect(srv.remote('a@x.com').ventas.map(v => v.id)).toEqual(['base', 'S']);
  });

  it('tres dispositivos guardando juntos: no se pierde ninguna venta', async () => {
    srv.session = 'a@x.com';
    const ds = [device(srv), device(srv), device(srv)];
    for (const d of ds) await d.sync.start();
    ds.forEach((d, i) => addVenta(d, venta('t' + i, 1, i + 1)));
    const soltar = srv.hold();
    const ps = ds.map(d => d.sync.syncNow());
    await new Promise(r => setTimeout(r, 0));
    soltar();
    await Promise.all(ps);
    expect(srv.remote('a@x.com').ventas.map(v => v.id)).toEqual(['t0', 't1', 't2']);
    expect(ds.every(d => d.status() === 'guardado')).toBe(true);
  });
});

// ---- Mi sueldo y rentabilidad: campos y jornadas guardadas ----
describe('Mi sueldo en la conciliación', () => {
  const j = (id, nombre, fecha = '2026-11-01') => ({ id, nombre, fecha, ts: 1, f: { bVentas: '1000' }, r: { ventas: 1000 } });
  it('una versión anterior sin "sueldo" se normaliza vacía', () => {
    expect(S({ ventas: [] }).sueldo).toEqual({ f: {}, hist: [] });
    const m = merge3({ data: { checks: {}, ventas: [], calc: {}, roi: {} } }, S({ sueldo: { f: { hSueldo: '5' } } }), S(null));
    expect(m.sueldo.f.hSueldo).toBe('5');
  });
  it('campos por hoja y jornadas por id, con borrados de cada lado', () => {
    const base = S({ sueldo: { f: { hSueldo: '1', hDias: '20' }, hist: [j('a', 'A'), j('b', 'B')] } });
    const local = S({ sueldo: { f: { hSueldo: '2', hDias: '20' }, hist: [j('a', 'A editada'), j('c', 'C')] } }); // borró b acá
    const remote = S({ sueldo: { f: { hSueldo: '1', hDias: '22' }, hist: [j('b', 'B'), j('d', 'D')] } }); // borró a allá
    const m = merge3({ data: base }, local, remote).sueldo;
    expect(m.f).toEqual({ hSueldo: '2', hDias: '22' });
    expect(m.hist.map(h => h.id).sort()).toEqual(['c', 'd']);
  });
  it('edición de la misma jornada en un solo lado se conserva', () => {
    const base = S({ sueldo: { hist: [j('a', 'A')] } });
    const remote = S({ sueldo: { hist: [j('a', 'A en el celu')] } });
    expect(merge3({ data: base }, base, remote).sueldo.hist[0].nombre).toBe('A en el celu');
  });
  it('primera conciliación suma jornadas y completa campos', () => {
    const m = mergeFirst(S({ sueldo: { f: { hSueldo: '9', hDias: '20' }, hist: [j('a', 'A')] } }), S({ sueldo: { f: { hSueldo: '5' }, hist: [j('b', 'B')] } }));
    expect(m.sueldo.f).toEqual({ hSueldo: '5', hDias: '20' });
    expect(m.sueldo.hist.length).toBe(2);
  });
  it('containedIn mira las jornadas', () => {
    const remote = S({ sueldo: { hist: [j('a', 'A')] } });
    expect(containedIn(S({ sueldo: { hist: [j('a', 'A')] } }), remote)).toBe(true);
    expect(containedIn(S({ sueldo: { hist: [j('z', 'Z')] } }), remote)).toBe(false);
  });
});

describe('Tareas propias del checklist en la conciliación', () => {
  const t = (id, txt, grp = 'pre') => ({ id, grp, txt });
  it('se normalizan y descartan las inválidas', () => {
    expect(S({ propios: [t('a', 'Llevar alargue'), { id: 'b', grp: 'pre', txt: '  ' }, null] }).propios.map(p => p.id)).toEqual(['a']);
    expect(S({}).propios).toEqual([]);
  });
  it('por id, con altas y bajas de cada lado', () => {
    const base = S({ propios: [t('a', 'A'), t('b', 'B')] });
    const local = S({ propios: [t('a', 'A'), t('c', 'C')] });
    const remote = S({ propios: [t('b', 'B'), t('d', 'D')] });
    expect(merge3({ data: base }, local, remote).propios.map(p => p.id).sort()).toEqual(['c', 'd']);
  });
  it('primera conciliación suma las de los dos lados', () => {
    expect(mergeFirst(S({ propios: [t('a', 'A')] }), S({ propios: [t('b', 'B')] })).propios.length).toBe(2);
    expect(containedIn(S({ propios: [t('a', 'A')] }), S({ propios: [] }))).toBe(false);
  });
});

describe('Costo y precio en la conciliación', () => {
  const rc = (id, nombre, extra = {}) => ({ id, nombre, insumos: [{ id: `${id}-1`, nombre: 'Cera', pagado: '1000' }], ...extra });
  it('se normalizan: descarta las inválidas y limita los insumos', () => {
    const muchos = Array.from({ length: 30 }, (_, i) => ({ id: `i${i}` }));
    const s = S({ costos: { recetas: [rc('a', 'Vela'), null, { nombre: 'sin id' }, { id: 'b', insumos: muchos }], activa: 'a' } });
    expect(s.costos.recetas.map(r => r.id)).toEqual(['a', 'b']);
    expect(s.costos.recetas[1].insumos.length).toBe(20);
    expect(s.costos.activa).toBe('a');
    expect(S({}).costos).toEqual({ recetas: [], activa: null });
  });
  it('por id, con altas, bajas y la edición de acá', () => {
    const base = S({ costos: { recetas: [rc('a', 'A'), rc('b', 'B')], activa: 'a' } });
    const local = S({ costos: { recetas: [rc('a', 'A editada'), rc('c', 'C')], activa: 'c' } });
    const remote = S({ costos: { recetas: [rc('a', 'A'), rc('b', 'B'), rc('d', 'D')], activa: 'a' } });
    const m = merge3({ data: base }, local, remote).costos;
    expect(m.recetas.map(r => r.id).sort()).toEqual(['a', 'c', 'd']);
    expect(m.recetas.find(r => r.id === 'a').nombre).toBe('A editada');
    expect(m.activa).toBe('c');
  });
  it('una versión guardada antes de Costo y precio no rompe la conciliación', () => {
    const local = S({ costos: { recetas: [rc('a', 'A')], activa: 'a' } });
    expect(merge3({ data: { checks: {} } }, local, S({})).costos.recetas.length).toBe(1);
  });
  it('primera conciliación suma y containedIn las mira', () => {
    expect(mergeFirst(S({ costos: { recetas: [rc('a', 'A')] } }), S({ costos: { recetas: [rc('b', 'B')] } })).costos.recetas.length).toBe(2);
    expect(containedIn(S({ costos: { recetas: [rc('a', 'A')] } }), S({}))).toBe(false);
    expect(containedIn(S({ costos: { recetas: [rc('a', 'A')] } }), S({ costos: { recetas: [rc('a', 'A')] } }))).toBe(true);
  });
  it('hasData cuenta las recetas', () => {
    expect(hasData(S({ costos: { recetas: [rc('a', 'A')] } }))).toBe(true);
  });
});
