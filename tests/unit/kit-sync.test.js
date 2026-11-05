// Pruebas de src/kit/sync.js: dueño del estado local, conciliación, sin conexión, reintentos y duplicados.
// Se simula el servidor de Relab (sesiones, /api/me, /api/state, /api/auth/logout) en memoria.
import { beforeEach, describe, expect, it } from 'vitest';
import { containedIn, createKitSync, merge3, mergeFirst } from '../../src/kit/sync.js';
import { emptyState, normalize } from '../../src/kit/state.js';

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
    rows,
    async fetch(path, init = {}) {
      if (srv.down) throw new TypeError('Failed to fetch');
      const method = init.method || 'GET';
      const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
      if (path === '/api/me') return res(200, { user: srv.session ? { name: 'Persona ' + srv.session, email: srv.session } : null });
      if (path === '/api/auth/logout') { srv.session = null; return res(204, null); }
      if (!srv.session) return res(401, { error: 'unauthorized' });
      if (method === 'GET') return res(200, rows.get(srv.session) ? { data: rows.get(srv.session).data, updatedAt: rows.get(srv.session).updatedAt } : { data: null });
      if (srv.failPut > 0) { srv.failPut--; return res(500, { error: 'server_error' }); }
      const body = JSON.parse(init.body);
      rows.set(srv.session, { data: JSON.parse(JSON.stringify(body.data)), updatedAt: ++clock });
      srv.puts++;
      if (srv.loseResponse > 0) { srv.loseResponse--; throw new TypeError('network'); }
      return res(200, { ok: true });
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
  const sync = createKitSync({ storage, session, fetchImpl: (...a) => srv.fetch(...a), isOnline: () => online && !srv.down, autoSync: false });
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
    expect(Object.keys(srv.rows.get('a@x.com').data).sort()).toEqual(['calc', 'checks', 'roi', 'ventas']); // misma forma
  });
});
