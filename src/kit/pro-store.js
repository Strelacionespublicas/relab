// Datos de Kit Feriante PRO en el dispositivo: copia local por cuenta, cola de cambios sin conexión
// y sincronización con /api/pro/data (leer) y /api/pro/ops (escribir). Pruebas: tests/unit/pro-store.test.js.
//
// - Cada registro tiene un id creado acá: reenviar no duplica (el servidor reconoce el opId).
// - Los cambios se guardan primero en el dispositivo (clave con la huella de la cuenta: no se mezclan
//   cuentas) y se suben en orden. Sin red quedan en la cola y se suben solos al volver.
// - Si otro dispositivo cambió el mismo registro, se reenvía sobre la versión nueva: manda el último
//   cambio de la persona. Las ventas son registros separados, así que dos celulares no se pisan.
// - Sin PRO vigente (403) la cola no se pierde: queda guardada y la app pasa a solo lectura.

const KEY = owner => `relab-kit-pro:${owner}`;
const BATCH = 100;
const MAX_REBASE = 5;
const rid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const k = (kind, id) => `${kind}:${id}`;

export function createProStore({ owner, storage = globalThis.localStorage, fetchImpl = (...a) => fetch(...a), isOnline = () => navigator.onLine, retryMs = 15_000, timers = globalThis } = {}) {
  let st = { rows: {}, queue: [], cursor: 0 };
  let status = 'cargando'; // cargando | listo | guardando | sin-conexion | solo-lectura | sesion | error
  let detail = null;
  let inFlight = null;
  let retryTimer = null;
  const subs = new Set();

  const load = () => {
    try { const raw = storage.getItem(KEY(owner)); if (raw) st = { rows: {}, queue: [], cursor: 0, ...JSON.parse(raw) }; } catch { /* copia dañada: se rearma desde la cuenta */ }
  };
  const persist = () => {
    try { storage.setItem(KEY(owner), JSON.stringify(st)); } catch { detail = 'espacio'; }
  };
  const snapshot = () => ({ status, detail, pending: st.queue.length, rows: st.rows });
  const emit = () => { const s = snapshot(); subs.forEach(f => f(s)); };
  const set = (s, d = null) => { status = s; detail = d; emit(); };

  const call = async (method, path, body) => {
    const res = await fetchImpl(path, { method, credentials: 'same-origin', headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };

  async function pull() {
    if (!isOnline()) { if (status === 'cargando') set('sin-conexion'); return; }
    let r;
    try { r = await call('GET', `/api/pro/data${st.cursor ? `?since=${st.cursor}` : ''}`); } catch { set('sin-conexion'); return; }
    if (r.status === 401) return set('sesion');
    if (r.status !== 200) return set('error', 'leer');
    const pendingKeys = new Set(st.queue.map(e => k(e.kind, e.id)));
    for (const row of r.body.rows || []) {
      const key = k(row.kind, row.id);
      const cur = st.rows[key];
      if (pendingKeys.has(key)) continue; // hay un cambio local esperando: ese manda
      if (!cur || cur.sv == null || row.version > cur.sv) {
        st.rows[key] = { kind: row.kind, id: row.id, data: row.data, deletedAt: row.deletedAt ?? null, sv: row.version };
      }
    }
    st.cursor = r.body.now || st.cursor;
    persist();
    if (status === 'cargando' || status === 'sin-conexion' || status === 'error') set(st.queue.length ? 'guardando' : 'listo');
    else emit();
  }

  function enqueue(entry) {
    const key = k(entry.kind, entry.id);
    const sent = new Set(inFlight || []);
    // Un solo cambio pendiente por registro (el último), salvo el que ya está en camino.
    st.queue = st.queue.filter(e => sent.has(e.opId) || k(e.kind, e.id) !== key);
    st.queue.push({ opId: rid(), ...entry, tries: 0 });
  }

  function save(kind, id, data) {
    const key = k(kind, id);
    const cur = st.rows[key];
    st.rows[key] = { kind, id, data, deletedAt: null, sv: cur?.sv ?? null };
    enqueue({ kind, id, data });
    persist();
    set('guardando');
    flush();
  }

  function remove(kind, id) {
    const key = k(kind, id);
    const cur = st.rows[key];
    if (!cur) return;
    const sent = new Set(inFlight || []);
    const creating = st.queue.some(e => sent.has(e.opId) && k(e.kind, e.id) === key);
    if (cur.sv == null && !creating) {
      // Nunca llegó al servidor: se descarta acá mismo.
      delete st.rows[key];
      st.queue = st.queue.filter(e => k(e.kind, e.id) !== key);
    } else {
      st.rows[key] = { ...cur, deletedAt: Date.now() };
      enqueue({ kind, id, delete: true });
    }
    persist();
    emit();
    flush();
  }

  const scheduleRetry = () => {
    if (retryTimer) return;
    retryTimer = timers.setTimeout(() => { retryTimer = null; flush(); }, retryMs);
  };

  async function flush() {
    if (inFlight || !st.queue.length) { if (!st.queue.length && status === 'guardando') set('listo'); return; }
    if (!isOnline()) { set('sin-conexion'); return; }
    const batch = [];
    for (const e of st.queue) {
      if (batch.length >= BATCH) break;
      const row = st.rows[k(e.kind, e.id)];
      const base = row?.sv ?? null;
      if (e.delete && base == null) { batch.push({ ...e, skip: true }); continue; }
      batch.push({ ...e, base });
    }
    const send = batch.filter(e => !e.skip);
    inFlight = batch.map(e => e.opId);
    let r;
    try {
      r = send.length ? await call('POST', '/api/pro/ops', { ops: send.map(({ opId, kind, id, base, data, delete: del }) => (del ? { opId, kind, id, base, delete: true } : { opId, kind, id, base, data })) }) : { status: 200, body: { results: [] } };
    } catch {
      inFlight = null;
      set('sin-conexion');
      scheduleRetry();
      return;
    }
    inFlight = null;
    if (r.status === 403 && r.body?.error === 'pro_required') return set('solo-lectura');
    if (r.status === 401) return set('sesion');
    if (r.status !== 200) { set('error', 'servidor'); scheduleRetry(); return; }
    const byOp = new Map((r.body.results || []).map(x => [x.opId, x]));
    const done = new Set(batch.filter(e => e.skip).map(e => e.opId));
    let problem = null;
    for (const e of send) {
      const res = byOp.get(e.opId);
      const q = st.queue.find(x => x.opId === e.opId);
      const row = st.rows[k(e.kind, e.id)];
      if (!res) continue;
      if (res.ok) {
        done.add(e.opId);
        // Si mientras tanto hubo otro cambio local, este ya quedó atrás: solo se actualiza la versión.
        if (row) row.sv = res.version;
      } else if (res.error === 'conflict') {
        if (row) row.sv = res.version; // reenviar sobre la versión actual (o crear si no existe)
        if (q && ++q.tries > MAX_REBASE) { done.add(e.opId); problem = 'conflicto'; }
      } else {
        done.add(e.opId);
        problem = res.error === 'limit' ? 'limite' : 'invalido';
      }
    }
    st.queue = st.queue.filter(e => !done.has(e.opId));
    persist();
    if (problem) set('error', problem);
    else set(st.queue.length ? 'guardando' : 'listo');
    if (st.queue.length) flush();
  }

  return {
    owner,
    async start() { load(); emit(); await pull(); await flush(); },
    pull, flush, save, remove,
    resume() { pull().then(flush); },
    subscribe(f) { subs.add(f); return () => subs.delete(f); },
    snapshot,
    list(kind, { trash = false } = {}) {
      return Object.values(st.rows).filter(r => r.kind === kind && (trash ? r.deletedAt : !r.deletedAt)).map(r => ({ id: r.id, ...r.data, deletedAt: r.deletedAt }));
    },
    get(kind, id) { const r = st.rows[k(kind, id)]; return r && !r.deletedAt ? { id: r.id, ...r.data } : null; },
    newId: rid,
    stop() { if (retryTimer) timers.clearTimeout(retryTimer); retryTimer = null; subs.clear(); },
  };
}
