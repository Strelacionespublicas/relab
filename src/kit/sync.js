// Guardado y sincronización del Kit feriante: dueño del estado local, conciliación con la cuenta,
// funcionamiento sin conexión y estado visible. No depende de React (se prueba en
// tests/unit/kit-sync.test.js). La API y la forma del estado guardado no cambian: se usa
// GET/PUT /api/state/kit-feriante y el `updatedAt` que pone el servidor como versión.
//
// En el navegador (localStorage):
//   relab-kit-feriante:v2           { owner, data, dirty, base }  owner = huella de la cuenta | null (sin cuenta) | 'legacy'
//   relab-kit-feriante:sin-cuenta   datos cargados sin cuenta que la persona no quiso sumar a una cuenta
//   relab-kit-feriante:resguardo:<owner>  cambios sin sincronizar de una cuenta que cerró sesión o cambió
//   relab-kit-feriante               formato anterior (solo se lee una vez para migrar)
// `base` = última versión conciliada con la cuenta: { data, updatedAt, confirmed } donde `confirmed`
// son los ids de ventas que se vieron en el servidor. Con eso se distingue "la borraron en otro
// dispositivo" de "todavía no llegó", sin depender del reloj de ningún dispositivo.

import { emptyState, hasData, normalize } from './state.js';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const filled = v => v !== undefined && v !== null && v !== '';
const leafKeys = (...objs) => [...new Set(objs.flatMap(o => Object.keys(o || {})))];
const productosFilled = ps => (ps || []).some(p => p.nombre || p.costo || p.precio || p.unid);

// Valor de una hoja en una conciliación de tres vías: si cambió acá, gana lo de acá; si no, lo de la cuenta.
const leaf3 = (b, l, r) => (!same(l, b) ? l : r);

/**
 * Conciliación de tres vías entre la última versión conocida (`base`), lo de este dispositivo
 * (`local`) y lo de la cuenta (`remote`). Política:
 *  - Ventas: se conservan todas las de ambos lados por id. Una venta desaparece solo si se borró
 *    acá (estaba en base y ya no está) o si se borró en otro dispositivo (el servidor la tuvo y ya no).
 *  - Checklist: por ítem; si cambió acá gana lo de acá, si no lo de la cuenta.
 *  - Calculadora y ROI: por campo (cada costo fijo, comisión, % digital, la lista de productos y cada
 *    campo del ROI); si cambió acá gana lo de acá, si no lo de la cuenta.
 */
export function merge3(base, local, remote) {
  const B = new Map((base.data?.ventas || []).map(v => [v.id, v]));
  const confirmed = new Set(base.confirmed || []);
  const L = new Map(local.ventas.map(v => [v.id, v]));
  const R = new Map(remote.ventas.map(v => [v.id, v]));
  const ventas = [];
  for (const id of new Set([...L.keys(), ...R.keys()])) {
    if (L.has(id) && R.has(id)) ventas.push(L.get(id));
    else if (L.has(id)) { if (!confirmed.has(id)) ventas.push(L.get(id)); } // si el servidor la tuvo y ya no, se borró allá
    else if (!B.has(id)) ventas.push(R.get(id)); // nueva de otro dispositivo; si estaba en base, se borró acá
  }
  ventas.sort((a, b) => a.ts - b.ts);

  const bd = base.data || emptyState();
  const checks = {};
  for (const k of leafKeys(bd.checks, local.checks, remote.checks)) {
    if (leaf3(!!bd.checks[k], !!local.checks[k], !!remote.checks[k])) checks[k] = true;
  }
  const fijos = {};
  for (const k of leafKeys(bd.calc.fijos, local.calc.fijos, remote.calc.fijos)) {
    const v = leaf3(bd.calc.fijos[k] ?? '', local.calc.fijos[k] ?? '', remote.calc.fijos[k] ?? '');
    if (v !== '') fijos[k] = v;
  }
  const calc = {
    ...remote.calc,
    fijos,
    comision: leaf3(bd.calc.comision, local.calc.comision, remote.calc.comision),
    pctDigital: leaf3(bd.calc.pctDigital, local.calc.pctDigital, remote.calc.pctDigital),
    productos: leaf3(bd.calc.productos, local.calc.productos, remote.calc.productos),
  };
  const roi = {};
  for (const k of leafKeys(bd.roi, local.roi, remote.roi)) {
    const v = leaf3(bd.roi[k] ?? '', local.roi[k] ?? '', remote.roi[k] ?? '');
    if (v !== '') roi[k] = v;
  }
  return normalize({ checks, ventas, calc, roi });
}

/**
 * Primera conciliación de este dispositivo con una cuenta (sin versión anterior): se suman las
 * ventas de los dos lados, se suman los ítems marcados y, en calculadora y ROI, se respeta lo que
 * la cuenta ya tiene cargado y se completa con lo de acá lo que la cuenta tiene vacío.
 */
export function mergeFirst(local, remote) {
  const byId = new Map(remote.ventas.map(v => [v.id, v]));
  for (const v of local.ventas) if (!byId.has(v.id)) byId.set(v.id, v);
  const checks = { ...remote.checks };
  for (const [k, on] of Object.entries(local.checks)) if (on) checks[k] = true;
  const fijos = { ...local.calc.fijos };
  for (const [k, v] of Object.entries(remote.calc.fijos)) if (filled(v)) fijos[k] = v;
  const roi = { ...local.roi };
  for (const [k, v] of Object.entries(remote.roi)) if (filled(v) && !(k === 'dias' && v === '1' && filled(local.roi.dias))) roi[k] = v;
  const calc = {
    ...remote.calc,
    fijos,
    productos: productosFilled(remote.calc.productos) ? remote.calc.productos : local.calc.productos,
    comision: hasData(remote) ? remote.calc.comision : local.calc.comision,
    pctDigital: hasData(remote) ? remote.calc.pctDigital : local.calc.pctDigital,
  };
  return normalize({ checks, ventas: [...byId.values()].sort((a, b) => a.ts - b.ts), calc, roi });
}

/** true si todo lo de `local` ya está en `remote` (se puede adoptar la cuenta sin preguntar). */
export function containedIn(local, remote) {
  const ids = new Set(remote.ventas.map(v => v.id));
  if (!local.ventas.every(v => ids.has(v.id))) return false;
  if (!Object.entries(local.checks).every(([k, on]) => !on || remote.checks[k])) return false;
  const blank = normalize(null);
  const leafOk = (l, r, d) => same(l, r) || same(l, d) || !filled(l);
  if (!leafKeys(local.calc.fijos).every(k => leafOk(local.calc.fijos[k], remote.calc.fijos[k], undefined))) return false;
  if (!leafOk(local.calc.comision, remote.calc.comision, blank.calc.comision)) return false;
  if (!leafOk(local.calc.pctDigital, remote.calc.pctDigital, blank.calc.pctDigital)) return false;
  if (productosFilled(local.calc.productos) && !same(local.calc.productos, remote.calc.productos)) return false;
  return leafKeys(local.roi).every(k => leafOk(local.roi[k], remote.roi[k], blank.roi[k]));
}

/** Huella de la cuenta para marcar de quién es el estado local (no se guarda el email). */
export async function ownerOf(email) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('relab-kit:' + String(email).trim().toLowerCase()));
  return [...new Uint8Array(buf)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
}

class SyncError extends Error {
  constructor(kind, status) { super(kind); this.kind = kind; this.status = status; }
}

/**
 * Motor de guardado. Estados (`status`):
 *  'cargando'  todavía no se sabe de quién son los datos
 *  'local'     sin cuenta: guardado en este dispositivo
 *  'guardando' hay cambios yendo a la cuenta
 *  'guardado'  el servidor confirmó el último cambio
 *  'sin-conexion' sin red: guardado en este dispositivo, se sube cuando vuelva
 *  'sesion'    la sesión venció: guardado en este dispositivo hasta volver a ingresar
 *  'error'     no se pudo sincronizar (se reintenta solo; también a mano)
 */
export function createKitSync({
  storage = globalThis.localStorage,
  session = globalThis.sessionStorage,
  fetchImpl = (...a) => globalThis.fetch(...a),
  isOnline = () => globalThis.navigator?.onLine !== false,
  timers = { setTimeout: (...a) => globalThis.setTimeout(...a), clearTimeout: id => globalThis.clearTimeout(id) },
  resource = 'kit-feriante',
  key = 'relab-kit-feriante',
  debounce = 800,
  retryDelays = [3000, 10000, 30000, 60000],
  autoSync = true,
} = {}) {
  const K = { v2: `${key}:v2`, anon: `${key}:sin-cuenta`, stash: o => `${key}:resguardo:${o}`, legacy: key, intent: `${key}:ingreso` };
  const read = k => { try { return JSON.parse(storage.getItem(k)); } catch { return null; } };
  const write = (k, v) => { try { storage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
  const remove = k => { try { storage.removeItem(k); } catch { /* */ } };

  let local = { owner: null, data: emptyState(), dirty: false, base: null };
  let verified = false; // ya se sabe si la sesión es de este dueño
  let user = null;
  let status = 'cargando';
  let detail = null;
  let notice = null; // 'resguardo' (cambios guardados al cerrar sesión) | 'recuperado'
  let anonPending = null; // { ventas, items } datos sin cuenta esperando que la persona decida
  let rev = 0;
  let syncing = null;
  let again = false;
  let debounceT = null;
  let retryT = null;
  let retryN = 0;
  const listeners = new Set();

  const persist = () => write(K.v2, local);
  const snapshot = () => ({
    data: !verified && local.owner && local.owner !== 'legacy' ? emptyState() : local.data,
    ready: verified, user, status, detail, notice, anonPending, dirty: local.dirty,
  });
  let snap = snapshot();
  const emit = () => { snap = snapshot(); listeners.forEach(fn => fn(snap)); };
  const setStatus = (s, d = null) => { status = s; detail = d; emit(); };

  let legacyPending = false; // datos del formato anterior que llegaron cuando ya había una cuenta en uso
  function load() {
    const v2 = read(K.v2);
    const legacy = read(K.legacy);
    if (v2 && typeof v2 === 'object' && 'owner' in v2) {
      local = { owner: v2.owner ?? null, data: normalize(v2.data), dirty: !!v2.dirty, base: v2.base ? { ...v2.base, data: normalize(v2.base.data) } : null };
      if (legacy && typeof legacy === 'object') {
        // Una pestaña con la versión anterior escribió después de migrar: no se pierde.
        const old = normalize(legacy);
        let saved;
        if (!local.owner || local.owner === 'legacy') {
          local.data = mergeFirst(old, local.data);
          saved = persist();
        } else {
          saved = write(K.anon, mergeFirst(old, anonData() || emptyState()));
          legacyPending = true;
        }
        if (saved) remove(K.legacy);
      }
      return;
    }
    if (legacy && typeof legacy === 'object') {
      // Formato anterior: no se sabe de quién es. Se migra y se borra la copia vieja solo si la nueva quedó escrita.
      local = { owner: 'legacy', data: normalize(legacy), dirty: false, base: null };
      if (persist()) remove(K.legacy);
    }
  }

  const fresh = owner => ({ owner, data: emptyState(), dirty: false, base: null });
  function stashCurrent() {
    if (local.owner && local.owner !== 'legacy' && local.dirty) write(K.stash(local.owner), local);
  }
  function restoreStash(owner) {
    const s = read(K.stash(owner));
    if (!s?.data) return false;
    local = { owner, data: normalize(s.data), dirty: true, base: s.base ? { ...s.base, data: normalize(s.base.data) } : null };
    notice = 'recuperado';
    return true;
  }
  const anonData = () => { const a = read(K.anon); return a ? normalize(a) : null; };
  const toAnonymous = () => {
    local = { owner: null, data: anonData() || emptyState(), dirty: false, base: null };
    remove(K.anon);
  };

  async function call(path, init) {
    let res;
    try { res = await fetchImpl(path, { credentials: 'same-origin', ...init }); } catch { throw new SyncError('offline'); }
    if (res.status === 401) throw new SyncError('session', 401);
    if (!res.ok) throw new SyncError('http', res.status);
    return res.status === 204 ? null : res.json();
  }
  const getRemote = () => call(`/api/state/${resource}`);
  const putRemote = data => call(`/api/state/${resource}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data }) });

  async function whoAmI() {
    try {
      const me = await call('/api/me');
      return me?.user ? { kind: 'user', user: me.user } : { kind: 'none' };
    } catch (e) {
      return { kind: e.kind === 'offline' ? 'offline' : 'unknown' };
    }
  }

  function schedule(ms) {
    if (!autoSync || !user || user.offline) return;
    timers.clearTimeout(debounceT);
    debounceT = timers.setTimeout(() => { syncNow(); }, ms);
  }
  function scheduleRetry() {
    if (!autoSync) return;
    timers.clearTimeout(retryT);
    retryT = timers.setTimeout(() => { syncNow(); }, retryDelays[Math.min(retryN, retryDelays.length - 1)]);
    retryN++;
  }

  async function doSync() {
    const rev0 = rev;
    const local0 = local.data;
    setStatus('guardando');
    const r = await getRemote();
    const remote = r?.data ? normalize(r.data) : null;
    let merged;
    if (!remote) merged = local0;
    else if (!local.base) merged = mergeFirst(local0, remote);
    else if (r.updatedAt != null && r.updatedAt === local.base.updatedAt) merged = local0;
    else merged = merge3(local.base, local0, remote);
    const needPut = !remote || !same(merged, remote);
    if (needPut) await putRemote(merged);
    local.base = { data: merged, updatedAt: needPut ? null : r.updatedAt, confirmed: remote ? remote.ventas.map(v => v.id) : [] };
    if (rev !== rev0) {
      // Hubo cambios mientras se sincronizaba: se aplican sobre lo conciliado y se vuelve a subir.
      local.data = merge3({ data: local0, confirmed: local0.ventas.map(v => v.id) }, local.data, merged);
      local.dirty = true;
      again = true;
    } else {
      local.data = merged;
      local.dirty = false;
    }
    persist();
    if (!local.dirty) {
      remove(K.stash(local.owner));
      if (notice === 'recuperado') notice = null;
    }
  }

  /** Sincroniza ahora. Devuelve una promesa que termina cuando no queda nada pendiente o falló. */
  function syncNow() {
    // Sin una sesión comprobada (por ejemplo, si se arrancó sin red) no se sube nada.
    if (!user || user.offline || !verified) return Promise.resolve();
    timers.clearTimeout(debounceT);
    if (!isOnline()) { setStatus('sin-conexion'); return Promise.resolve(); }
    if (syncing) { again = true; return syncing; }
    syncing = (async () => {
      try {
        do { again = false; await doSync(); } while (again);
        retryN = 0;
        timers.clearTimeout(retryT);
        setStatus('guardado');
      } catch (e) {
        persist();
        if (e.kind === 'offline') setStatus('sin-conexion');
        else if (e.kind === 'session') { setStatus('sesion'); return; }
        else setStatus('error', e.status === 400 ? 'limite' : null);
        scheduleRetry();
      } finally {
        syncing = null;
      }
    })();
    return syncing;
  }

  async function start() {
    load();
    emit();
    const me = await whoAmI();
    if (me.kind === 'offline' || me.kind === 'unknown') {
      // Sin red: se sigue con lo que hay en este dispositivo y se reintenta al volver la conexión.
      verified = true;
      if (local.owner === 'legacy') local.owner = null;
      user = local.owner ? { offline: true } : null;
      setStatus(local.owner ? 'sin-conexion' : 'local');
      return;
    }
    if (me.kind === 'none') {
      if (local.owner && local.owner !== 'legacy') { stashCurrent(); toAnonymous(); } else local.owner = null;
      persist();
      verified = true;
      user = null;
      setStatus('local');
      return;
    }
    const owner = await ownerOf(me.user.email);
    let intent = false;
    try { intent = session.getItem(K.intent) === '1'; session.removeItem(K.intent); } catch { /* */ }
    if (local.owner === owner) {
      // Mismo dueño: se sigue. Si llegaron datos del formato anterior, se suman solo si no están ya en la cuenta.
      const a = legacyPending && anonData();
      if (a && hasData(a)) {
        let remote = null;
        try { const r = await getRemote(); remote = r?.data ? normalize(r.data) : emptyState(); } catch { remote = null; }
        if (remote && containedIn(a, remote)) remove(K.anon);
        else anonPending = { ventas: a.ventas.length, items: Object.values(a.checks).filter(Boolean).length };
      }
    } else if (local.owner && local.owner !== 'legacy') {
      // Datos de otra cuenta: se guardan aparte si tenían cambios pendientes y no se mezclan.
      stashCurrent();
      local = fresh(owner);
      restoreStash(owner);
    } else if (!hasData(local.data)) {
      local = fresh(owner);
      restoreStash(owner);
    } else {
      // Datos sin cuenta (o del formato anterior) con contenido.
      let remote = null;
      try { const r = await getRemote(); remote = r?.data ? normalize(r.data) : emptyState(); } catch { remote = null; }
      if (remote && containedIn(local.data, remote)) {
        local = fresh(owner);
      } else if (intent) {
        local = { owner, data: local.data, dirty: true, base: null }; // la persona ingresó desde acá para guardarlos
      } else {
        write(K.anon, local.data);
        anonPending = { ventas: local.data.ventas.length, items: Object.values(local.data.checks).filter(Boolean).length };
        local = fresh(owner);
      }
      if (!local.dirty) restoreStash(owner);
    }
    persist();
    verified = true;
    user = me.user;
    emit();
    await syncNow();
  }

  function update(fn) {
    if (!verified && local.owner && local.owner !== 'legacy') return; // todavía no se sabe de quién son
    local.data = normalize(fn(local.data));
    rev++;
    if (user) local.dirty = true;
    persist();
    if (user) {
      if (!isOnline()) setStatus('sin-conexion');
      else if (status !== 'sesion') setStatus('guardando');
      schedule(debounce);
    } else emit();
  }

  /** Suma a la cuenta los datos que estaban cargados sin cuenta en este dispositivo. */
  function acceptAnon() {
    const a = anonData();
    anonPending = null;
    remove(K.anon);
    if (!a || !user) { emit(); return Promise.resolve(); }
    local.data = mergeFirst(a, local.data);
    local.dirty = true;
    rev++;
    persist();
    emit();
    return syncNow();
  }
  function dismissAnon() { anonPending = null; emit(); }
  function dismissNotice() { notice = null; emit(); }

  /** Cierra sesión: intenta subir lo pendiente; si no se puede, lo guarda aparte para esa cuenta. */
  async function logout(logoutImpl) {
    if (user && local.dirty) {
      await Promise.race([syncNow(), new Promise(r => timers.setTimeout(r, 4000))]);
    }
    const hadPending = local.dirty;
    stashCurrent();
    try { await logoutImpl?.(); } catch { /* sin red: igual se desvincula este dispositivo */ }
    toAnonymous();
    persist();
    user = null;
    notice = hadPending ? 'resguardo' : null;
    timers.clearTimeout(debounceT);
    timers.clearTimeout(retryT);
    setStatus('local');
  }

  /** Marca que la persona va a ingresar desde el kit (sus datos sin cuenta se suman sin preguntar). */
  function markLoginIntent() { try { session.setItem(K.intent, '1'); } catch { /* */ } }

  return {
    start, update, syncNow, logout, acceptAnon, dismissAnon, dismissNotice, markLoginIntent,
    snapshot: () => snap,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    stop() { timers.clearTimeout(debounceT); timers.clearTimeout(retryT); listeners.clear(); },
    // Al volver la conexión o la pestaña: si la sesión no se había podido comprobar, se comprueba;
    // si no, se sincroniza (trae lo cargado en otros dispositivos).
    async resume() {
      if (user?.offline) { verified = false; user = null; await start(); return; }
      if (user) await syncNow();
    },
  };
}
