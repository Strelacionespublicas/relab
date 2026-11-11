// Módulos de Kit Feriante PRO: Mis ferias, Mis productos, Ventas PRO y Stock.
// Los datos viven en src/kit/pro-store.js (dispositivo + cuenta, sin conexión) y las cuentas en
// src/kit/pro-calc.js. El permiso lo decide el servidor; acá se muestra en solo lectura si no hay PRO.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createProStore } from './pro-store.js';
import { ownerOf } from './sync.js';
import { readField, fmt } from './calc.js';
import { buscarProductos, controlaStock, gastosFeria, ordenarParaVender, jornadasFeria, mesesDelPeriodo, periodo, resumenFeria, resumenSueldo, resumenNegocio, resumenVentas, stockBajo, stockDe, topProductos, ventaTotales } from './pro-calc.js';
import { fecha } from './pro.jsx';
import { keyName, parseDelimited, parseProductRows, planImport, templateCsv } from './pro-import.js';

const hoyKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dayKey = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const hora = ts => new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const fDia = k => (k ? new Date(k + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : '');
const txt = v => (v == null ? '' : String(v).replace('.', ','));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const byName = (a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');

// ---- Datos ----
export function useProData(user) {
  const [store, setStore] = useState(null);
  const [snap, setSnap] = useState(null);
  const email = user?.email;
  useEffect(() => {
    if (!email) { setStore(null); setSnap(null); return; }
    let s;
    let live = true;
    ownerOf(email).then(owner => {
      if (!live) return;
      s = createProStore({ owner });
      s.subscribe(setSnap);
      setStore(s);
      s.start();
    });
    const onOnline = () => s?.resume();
    const onVisible = () => { if (document.visibilityState === 'visible') s?.resume(); };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => { live = false; s?.stop(); window.removeEventListener('online', onOnline); document.removeEventListener('visibilitychange', onVisible); };
  }, [email]);
  const data = useMemo(() => {
    if (!store) return null;
    const ferias = store.list('feria').sort((a, b) => String(b.desde || '').localeCompare(String(a.desde || '')));
    const productos = store.list('producto').sort(byName);
    const ventas = store.list('venta').sort((a, b) => b.ts - a.ts);
    const movimientos = store.list('stock').sort((a, b) => b.ts - a.ts);
    const config = store.get('config', 'config') || {};
    return { ferias, productos, ventas, movimientos, config, comisiones: config.comisiones || {} };
  }, [store, snap]); // eslint-disable-line react-hooks/exhaustive-deps
  return { store, snap, data };
}

export const proCounts = data => (data ? { ferias: data.ferias.length, productos: data.productos.length, ventas: data.ventas.length } : null);

// ---- Envoltorio: sin sesión, sin PRO, solo lectura ----
const SYNC_TEXT = {
  cargando: 'Cargando tus datos PRO…', listo: '✓ Guardado en tu cuenta', guardando: 'Guardando…',
  'sin-conexion': 'Sin conexión: guardado en este dispositivo. Se sube solo cuando vuelva la señal.',
  'solo-lectura': 'Tu PRO no está activo: podés ver y exportar tus datos, pero no cargar cambios.',
  sesion: 'Tu sesión venció: ingresá de nuevo para subir los cambios.', error: 'Hubo un problema al guardar. Tus datos siguen en este dispositivo.',
};

export function ProSection({ id, user, access, pro, medios, onLogin }) {
  const { store, snap, data } = pro;
  if (!user) {
    return (
      <div className="kf-card kf-pro-gate">
        <h3 className="kf-card-title">Herramienta PRO</h3>
        <p>Kit Feriante PRO es gratis por 12 meses durante el lanzamiento. Se activa con tu cuenta de Google en un minuto.</p>
        <a className="kf-btn kf-btn--coral kf-btn--sm" href="/pro/">Activar PRO gratis</a>
        <button type="button" className="kf-link" onClick={onLogin}>Ya lo activé: ingresar</button>
      </div>
    );
  }
  if (!store || !data || access.pro === null) return <p className="kf-empty">Cargando…</p>;
  const activo = !!access.pro?.pro;
  const tieneDatos = data.ferias.length || data.productos.length || data.ventas.length || data.movimientos.length;
  if (!activo && !tieneDatos) {
    return (
      <div className="kf-card kf-pro-gate">
        <h3 className="kf-card-title">Activá Kit Feriante PRO</h3>
        <p>Organizá tus ferias, tu catálogo, tus ventas con stock y tus resultados. Gratis por 12 meses durante el lanzamiento.</p>
        <a className="kf-btn kf-btn--coral kf-btn--sm" href="/pro/">Activar PRO gratis</a>
        <button type="button" className="kf-link" onClick={access.openModal}>Tengo un código</button>
      </div>
    );
  }
  const canEdit = activo && snap?.status !== 'solo-lectura';
  const props = { store, data, canEdit, medios };
  return (
    <>
      {!canEdit && (
        <div className="kf-tip kf-tip--celeste kf-pro-ro" role="status">
          <span><strong>Modo lectura.</strong> Tu PRO no está activo: tus datos están guardados y podés verlos y exportarlos. Para seguir cargando, volvé a activar PRO.</span>
          <button type="button" className="kf-btn kf-btn--coral kf-btn--sm" onClick={access.openModal}>Tengo un código</button>
        </div>
      )}
      {snap && snap.status !== 'listo' && snap.status !== 'solo-lectura' && <p className={`kf-pro-sync ${snap.status}`} role="status">{SYNC_TEXT[snap.status]}{snap.pending ? ` (${snap.pending} pendiente${snap.pending === 1 ? '' : 's'})` : ''}</p>}
      {canEdit && (id === 'resumen' || id === 'ventaspro') && <PrimerosPasos data={data} />}
      {id === 'ferias' && <Ferias {...props} />}
      {id === 'productos' && <Productos {...props} />}
      {id === 'ventaspro' && <VentasPro {...props} />}
      {id === 'stock' && <Stock {...props} />}
      {id === 'resumen' && <Resumen {...props} />}
      <Exportar data={data} medios={medios} />
    </>
  );
}

// ---- Primera vez en PRO: carga guiada en 3 pasos ----
function PrimerosPasos({ data }) {
  const pasos = [
    ['productos', 'Cargá tus productos', 'A mano o todos juntos desde Excel.', data.productos.length > 0],
    ['ferias', 'Creá tu próxima feria', 'Con sus fechas y gastos.', data.ferias.length > 0],
    ['ventaspro', 'Registrá tu primera venta', 'Tocás el producto, elegís cómo te pagan y listo.', data.ventas.length > 0],
  ];
  if (pasos.every(p => p[3])) return null;
  const sig = pasos.find(p => !p[3]);
  return (
    <div className="kf-card kf-pasos">
      <h3 className="kf-card-title">Empezá en 3 pasos</h3>
      <ol>
        {pasos.map(([id, t, d, hecho], i) => (
          <li key={id} className={hecho ? 'ok' : sig[0] === id ? 'now' : ''}>
            <span className="n">{hecho ? '✓' : i + 1}</span>
            <span><b>{hecho ? t : <a href={'#' + id}>{t}</a>}</b><small>{d}</small></span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---- Resumen del negocio ----
const PERIODOS = [['mes', 'Este mes'], ['3m', '3 meses'], ['anio', 'Este año'], ['todo', 'Todo']];
const pct = x => `${Math.round(x * 100)}%`;

function Resumen({ data, medios, store, canEdit }) {
  const [per, setPer] = useState('todo');
  const medioLabel = Object.fromEntries(medios);
  const rango = periodo(per);
  const r = resumenNegocio(data, rango);
  const ventasPer = data.ventas.filter(v => (rango.desde == null || v.ts >= rango.desde));
  const { top, mejorMargen } = topProductos(ventasPer, 5);
  const ctx = { movimientos: data.movimientos, ventas: data.ventas };
  const bajos = data.productos.flatMap(p => (p.variantes?.length ? p.variantes.map(v => [p, v.id]) : [[p, null]]))
    .filter(([p, vid]) => data.movimientos.some(m => m.productoId === p.id && (m.varianteId ?? null) === vid) && stockBajo(p, stockDe(p.id, vid, ctx))).length;
  const maxFeria = Math.max(1, ...r.porFeria.map(f => f.total));
  const maxProd = Math.max(1, ...top.map(p => p.ingresos));
  const medios_ = Object.entries(r.porMedio).sort((a, b) => b[1].total - a[1].total);

  if (!data.ventas.length && !data.ferias.length) {
    return <p className="kf-empty">Cuando cargues tus ferias y registres ventas en <a href="#ventaspro">Ventas PRO</a>, acá vas a ver el resumen de tu negocio: cuánto vendiste, cuánto te quedó y qué es lo que más se vende.</p>;
  }
  return (
    <>
      <div className="kf-seg kf-res-per" role="group" aria-label="Período">
        {PERIODOS.map(([k, l]) => <button key={k} type="button" className={per === k ? 'on' : ''} onClick={() => setPer(k)}>{l}</button>)}
      </div>
      <div className={`kf-res-hero ${r.resultado >= 0 ? 'ok' : 'neg'}`}>
        <span>Te quedó</span>
        <b>{fmt(r.resultado)}</b>
        <small>Lo cobrado, menos comisiones, mercadería vendida y gastos de las ferias</small>
      </div>
      <div className="kf-metrics">
        <div><span>Cobrado</span><b>{fmt(r.total)}</b><small>{r.ventas} {r.ventas === 1 ? 'venta' : 'ventas'} · ticket {fmt(r.ticket)}</small></div>
        <div><span>Comisiones</span><b>{fmt(r.comisiones)}</b><small>según tus tasas</small></div>
        <div><span>Mercadería</span><b>{fmt(r.costo)}</b><small>costo de lo vendido</small></div>
        <div><span>Gastos</span><b>{fmt(r.gastos)}</b><small>de {r.porFeria.length} {r.porFeria.length === 1 ? 'feria' : 'ferias'}</small></div>
      </div>
      <TuSueldo r={r} data={data} per={per} store={store} canEdit={canEdit} />
      {bajos > 0 && <div className="kf-tip" role="alert"><span><strong>{bajos} {bajos === 1 ? 'producto' : 'productos'} con stock bajo.</strong> <a href="#stock">Ver stock</a></span></div>}

      {r.porFeria.length > 0 && (
        <div className="kf-card kf-res-block">
          <h3 className="kf-card-title">Comparación entre ferias</h3>
          <div className="kf-res-bars">
            {r.porFeria.map((f, i) => (
              <div key={f.id} className={`kf-res-row${i === 0 && r.porFeria.length > 1 ? ' best' : ''}`} title={`${f.nombre}: cobrado ${fmt(f.total)}, gastos ${fmt(f.gastos)}, te quedó ${fmt(f.resultado)}`}>
                <div className="kf-res-lab"><span>{f.nombre}{i === 0 && r.porFeria.length > 1 && <em> · la mejor</em>}</span><b className={f.resultado >= 0 ? 'ok' : 'neg'}>{fmt(f.resultado)}</b></div>
                <div className="kf-res-track"><i style={{ width: `${(f.total / maxFeria) * 100}%` }} /></div>
                <small>Cobrado {fmt(f.total)} · {f.ventas} {f.ventas === 1 ? 'venta' : 'ventas'} · gastos {fmt(f.gastos)}</small>
              </div>
            ))}
          </div>
          {r.sinFeria && <p className="kf-pro-note">Además, {r.sinFeria.ventas} {r.sinFeria.ventas === 1 ? 'venta' : 'ventas'} sin feria asignada por {fmt(r.sinFeria.total)}.</p>}
        </div>
      )}

      {top.length > 0 && (
        <div className="kf-card kf-res-block">
          <h3 className="kf-card-title">Lo que más vendés</h3>
          <div className="kf-res-bars">
            {top.map(p => (
              <div key={p.id} className="kf-res-row" title={`${p.nombre}: ${p.unidades} unidades, ${fmt(p.ingresos)}${p.costo ? `, margen ${pct(p.margen)}` : ''}`}>
                <div className="kf-res-lab"><span>{p.nombre}</span><b>{fmt(p.ingresos)}</b></div>
                <div className="kf-res-track"><i style={{ width: `${(p.ingresos / maxProd) * 100}%` }} /></div>
                <small>{p.unidades} {p.unidades === 1 ? 'unidad' : 'unidades'}{p.costo ? ` · margen ${pct(p.margen)}` : ''}</small>
              </div>
            ))}
          </div>
          {mejorMargen && <p className="kf-pro-note">El que más te deja por cada peso vendido: <b>{mejorMargen.nombre}</b> (margen {pct(mejorMargen.margen)}).</p>}
        </div>
      )}

      {medios_.length > 0 && (
        <div className="kf-card kf-res-block">
          <h3 className="kf-card-title">Cómo te pagan</h3>
          <div className="kf-medios">{medios_.map(([m, x]) => <span key={m}>{medioLabel[m] || m} <b>{fmt(x.total)}</b> <small>({pct(r.total ? x.total / r.total : 0)})</small></span>)}</div>
        </div>
      )}
    </>
  );
}

// ---- Tu sueldo (dentro del Resumen) ----
function TuSueldo({ r, data, per, store, canEdit }) {
  const cfg = data.config.sueldo || null;
  const [form, setForm] = useState(null);
  const [err, setErr] = useState('');
  const meses = mesesDelPeriodo(per, data.ventas);
  const s = resumenSueldo({ resultado: r.resultado, jornadas: r.jornadas }, cfg, { meses });
  const pct = s.cubre != null ? Math.round(s.cubre * 100) : null;
  const abrir = () => { setErr(''); setForm({ tipo: cfg?.tipo || 'mes', monto: txt(cfg?.monto ?? ''), horas: txt(cfg?.horas ?? '') }); };
  const guardar = e => {
    e.preventDefault();
    const m = readField(form.monto, { positive: true, required: true });
    if (m.error) return setErr(`Revisá el monto: ${m.error.toLowerCase()}`);
    const h = readField(form.horas);
    if (h.error || h.value > 24) return setErr('Las horas por jornada tienen que estar entre 1 y 24.');
    store.save('config', 'config', { ...data.config, sueldo: { tipo: form.tipo, monto: m.value, horas: h.value || null } });
    setForm(null);
  };
  const objetivoTxt = cfg ? (cfg.tipo === 'mes' ? `${fmt(cfg.monto)} por mes${meses > 1 ? ` × ${meses} meses` : ''}` : `${fmt(cfg.monto)} por jornada × ${r.jornadas}`) : '';
  return (
    <div className="kf-card kf-res-block kf-sueldo-pro">
      <h3 className="kf-card-title">Tu sueldo</h3>
      {form ? (
        <form className="kf-pro-form" onSubmit={guardar}>
          <div className="kf-seg" role="group" aria-label="Cómo querés pensar tu sueldo">
            <button type="button" className={form.tipo === 'mes' ? 'on' : ''} onClick={() => setForm({ ...form, tipo: 'mes' })}>Por mes</button>
            <button type="button" className={form.tipo === 'jornada' ? 'on' : ''} onClick={() => setForm({ ...form, tipo: 'jornada' })}>Por jornada</button>
          </div>
          <div className="kf-pro-grid">
            <label className="kf-field"><span>{form.tipo === 'mes' ? '¿Cuánto querés ganar por mes?' : '¿Cuánto querés ganar por jornada?'}</span><span className="kf-input-wrap"><em className="pre">$</em><input inputMode="decimal" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} placeholder="0" autoFocus /></span></label>
            <label className="kf-field"><span>Horas por jornada <small>(opcional)</small></span><input inputMode="numeric" value={form.horas} onChange={e => setForm({ ...form, horas: e.target.value })} placeholder="Ej.: 10" /><small>Contando armado y desarme</small></label>
          </div>
          {err && <p className="kf-err" role="alert">{err}</p>}
          <div className="kf-modal-act">
            <button type="button" className="kf-btn kf-btn--soft kf-btn--sm" onClick={() => setForm(null)}>Cancelar</button>
            <button type="submit" className="kf-btn kf-btn--coral kf-btn--sm">Guardar</button>
          </div>
        </form>
      ) : (
        <>
          <p>En este período trabajaste <b>{r.jornadas} {r.jornadas === 1 ? 'jornada' : 'jornadas'}</b> de feria y te quedaron <b>{fmt(s.porJornada ?? 0)} por jornada</b>{s.porHora != null ? <> (≈ {fmt(s.porHora)} por hora)</> : null}.</p>
          {cfg && pct != null ? (
            <>
              <div className="kf-sueldo-bar" aria-hidden="true"><i className={pct >= 100 ? 'ok' : 'low'} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} /></div>
              <p>Tu objetivo: <b>{fmt(s.objetivo)}</b> <small>({objetivoTxt})</small>. {pct >= 100 ? <>Lo cubriste: <b>{pct}%</b>.</> : <>Cubriste el <b>{Math.max(pct, 0)}%</b>.</>}</p>
              <p>Después de pagarte tu sueldo, al negocio {s.trasSueldo >= 0 ? <>le quedan <b className="pos">{fmt(s.trasSueldo)}</b>.</> : <>le faltan <b className="neg">{fmt(-s.trasSueldo)}</b>: para sostenerte, revisá precios, costos o a qué ferias vas.</>}</p>
            </>
          ) : <p className="kf-muted">Cargá cuánto querés ganar (por mes o por jornada) y te decimos si tus ferias te pagan el sueldo.</p>}
          {canEdit && <button type="button" className="kf-link" onClick={abrir}>{cfg ? 'Cambiar mi sueldo' : 'Cargar mi sueldo'}</button>}
        </>
      )}
    </div>
  );
}

// ---- Mis ferias ----
const blankFeria = () => ({ nombre: '', lugar: '', desde: hoyKey(), hasta: hoyKey(), gastos: [{ id: uid(), concepto: 'Stand', monto: '' }], notas: '' });

function Ferias({ store, data, canEdit }) {
  const [form, setForm] = useState(null); // { id, nuevo, ...campos de texto }
  const [err, setErr] = useState('');
  const activa = data.config.feriaActiva;
  const setActiva = id => store.save('config', 'config', { ...data.config, feriaActiva: id });
  const editar = f => { setErr(''); setForm({ ...f, nuevo: false, jornadas: f.jornadas ? String(f.jornadas) : '', gastos: (f.gastos || []).map(g => ({ ...g, monto: txt(g.monto) })) }); };
  const sueldoCfg = data.config.sueldo;
  const nueva = () => { setErr(''); setForm({ id: store.newId(), nuevo: true, ...blankFeria() }); };
  const guardar = e => {
    e.preventDefault();
    if (!form.nombre.trim()) return setErr('Poné el nombre de la feria.');
    if (form.hasta && form.desde && form.hasta < form.desde) return setErr('La fecha de fin es anterior a la de inicio.');
    const gastos = [];
    for (const g of form.gastos) {
      if (!g.concepto.trim() && !String(g.monto).trim()) continue;
      const { value, error } = readField(g.monto);
      if (error) return setErr(`Revisá el monto de "${g.concepto || 'gasto'}": ${error.toLowerCase()}`);
      gastos.push({ id: g.id, concepto: g.concepto.trim() || 'Gasto', monto: value });
    }
    let jornadas = null;
    if (String(form.jornadas ?? '').trim()) {
      const j = readField(form.jornadas, { positive: true });
      if (j.error || !Number.isInteger(j.value) || j.value > 366) return setErr('Las jornadas tienen que ser un número entero de días, por ejemplo 3.');
      jornadas = j.value;
    }
    const { id, nuevo, ...rest } = form;
    store.save('feria', id, { ...rest, nombre: rest.nombre.trim(), lugar: rest.lugar.trim(), gastos, jornadas });
    if (nuevo && !activa) setActiva(id);
    setForm(null);
  };
  const borrar = f => {
    const n = data.ventas.filter(v => v.feriaId === f.id).length;
    if (!window.confirm(n ? `"${f.nombre}" tiene ${n} ventas. Se va a la papelera (las ventas quedan). ¿Seguimos?` : `¿Mandar "${f.nombre}" a la papelera?`)) return;
    store.remove('feria', f.id);
    if (activa === f.id) setActiva(null);
  };
  const setG = (i, k, v) => setForm(f => ({ ...f, gastos: f.gastos.map((g, j) => (j === i ? { ...g, [k]: v } : g)) }));

  if (form) {
    return (
      <form className="kf-card kf-pro-form" onSubmit={guardar}>
        <h3 className="kf-card-title">{form.nuevo ? 'Nueva feria' : 'Editar feria'}</h3>
        <div className="kf-pro-grid">
          <label className="kf-field"><span>Nombre</span><input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Feria de Mataderos" maxLength={80} autoFocus /></label>
          <label className="kf-field"><span>Lugar</span><input value={form.lugar} onChange={e => setForm({ ...form, lugar: e.target.value })} placeholder="Ciudad o predio" maxLength={80} /></label>
          <label className="kf-field"><span>Desde</span><input type="date" value={form.desde} onChange={e => setForm({ ...form, desde: e.target.value })} /></label>
          <label className="kf-field"><span>Hasta</span><input type="date" value={form.hasta} onChange={e => setForm({ ...form, hasta: e.target.value })} /></label>
          <label className="kf-field"><span>Jornadas que trabajaste</span><input inputMode="numeric" value={form.jornadas ?? ''} onChange={e => setForm({ ...form, jornadas: e.target.value })} placeholder={String(jornadasFeria({ desde: form.desde, hasta: form.hasta }))} /><small>Vacío = las calculamos por las fechas ({jornadasFeria({ desde: form.desde, hasta: form.hasta })})</small></label>
        </div>
        <p className="kf-pro-sub">Gastos de la feria</p>
        {form.gastos.map((g, i) => (
          <div key={g.id} className="kf-pro-row">
            <input aria-label="Concepto" value={g.concepto} onChange={e => setG(i, 'concepto', e.target.value)} placeholder="Concepto" maxLength={60} />
            <span className="kf-input-wrap"><em className="pre">$</em><input aria-label="Monto" inputMode="decimal" value={g.monto} onChange={e => setG(i, 'monto', e.target.value)} placeholder="0" /></span>
            <button type="button" className="kf-x" aria-label="Quitar gasto" onClick={() => setForm(f => ({ ...f, gastos: f.gastos.filter((_, j) => j !== i) }))}>×</button>
          </div>
        ))}
        <button type="button" className="kf-link" onClick={() => setForm(f => ({ ...f, gastos: [...f.gastos, { id: uid(), concepto: '', monto: '' }] }))}>+ Agregar gasto</button>
        {err && <p className="kf-err" role="alert">{err}</p>}
        <div className="kf-modal-act">
          <button type="button" className="kf-btn kf-btn--soft kf-btn--sm" onClick={() => setForm(null)}>Cancelar</button>
          <button type="submit" className="kf-btn kf-btn--coral kf-btn--sm">Guardar feria</button>
        </div>
      </form>
    );
  }

  return (
    <>
      {canEdit && <button type="button" className="kf-btn kf-btn--coral kf-btn--sm kf-pro-new" onClick={nueva}>+ Nueva feria</button>}
      {!data.ferias.length && <p className="kf-empty">Todavía no cargaste ferias. Creá la próxima: así tus ventas y gastos quedan ordenados por evento.</p>}
      <div className="kf-pro-list">
        {data.ferias.map(f => {
          const r = resumenFeria(f, data.ventas.filter(v => v.feriaId === f.id), data.comisiones);
          return (
            <div key={f.id} className={`kf-card kf-pro-item${activa === f.id ? ' on' : ''}`}>
              <div className="kf-pro-item-h">
                <div>
                  <b>{f.nombre}</b>{activa === f.id && <span className="kf-pro-tag">Activa</span>}
                  <small>{[f.lugar, f.desde && (f.hasta && f.hasta !== f.desde ? `${fDia(f.desde)} al ${fDia(f.hasta)}` : fDia(f.desde))].filter(Boolean).join(' · ')}</small>
                </div>
                {canEdit && (
                  <div className="kf-pro-btns">
                    {activa !== f.id && <button type="button" className="kf-link" onClick={() => setActiva(f.id)}>Marcar activa</button>}
                    <button type="button" className="kf-link" onClick={() => editar(f)}>Editar</button>
                    <button type="button" className="kf-link" onClick={() => borrar(f)}>Borrar</button>
                  </div>
                )}
              </div>
              <div className="kf-pro-nums">
                <span>Ventas <b>{r.ventas}</b></span><span>Cobrado <b>{fmt(r.total)}</b></span><span>Comisiones <b>{fmt(r.comisiones)}</b></span>
                <span>Gastos <b>{fmt(r.gastos)}</b></span><span>Mercadería <b>{fmt(r.costo)}</b></span>
                <span className={r.resultado >= 0 ? 'ok' : 'neg'}>Resultado <b>{fmt(r.resultado)}</b></span>
                {(() => {
                  const sj = resumenSueldo({ resultado: r.resultado, jornadas: jornadasFeria(f) }, sueldoCfg?.tipo === 'jornada' ? sueldoCfg : null);
                  const objJ = sueldoCfg?.monto > 0 ? (sueldoCfg.tipo === 'jornada' ? sueldoCfg.monto : null) : null;
                  const pctJ = objJ && sj.porJornada != null ? Math.round((sj.porJornada / objJ) * 100) : null;
                  return (
                    <>
                      <span>Por jornada <b>{fmt(sj.porJornada ?? 0)}</b> <small>({jornadasFeria(f)} {jornadasFeria(f) === 1 ? 'jornada' : 'jornadas'})</small></span>
                      {pctJ != null && <span className={`kf-sueldo-tag ${pctJ >= 100 ? 'ok' : 'low'}`}>Sueldo cubierto {Math.max(pctJ, 0)}%</span>}
                    </>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>
      <Papelera store={store} kind="feria" canEdit={canEdit} label={f => f.nombre} />
    </>
  );
}

// ---- Mis productos ----
function Productos({ store, data, canEdit }) {
  const [form, setForm] = useState(null);
  const [err, setErr] = useState('');
  const [importar, setImportar] = useState(false);
  const cats = [...new Set(data.productos.map(p => p.categoria).filter(Boolean))];
  const nuevo = () => { setErr(''); setForm({ id: store.newId(), nuevo: true, nombre: '', categoria: '', costo: '', precio: '', stockMin: '', variantes: [] }); };
  const editar = p => { setErr(''); setForm({ ...p, nuevo: false, costo: txt(p.costo), precio: txt(p.precio), stockMin: txt(p.stockMin), variantes: p.variantes || [] }); };
  const guardar = e => {
    e.preventDefault();
    if (!form.nombre.trim()) return setErr('Poné el nombre del producto.');
    const precio = readField(form.precio, { positive: true, required: true });
    if (precio.error) return setErr(`Revisá el precio: ${precio.error.toLowerCase()}`);
    const costo = readField(form.costo);
    if (costo.error) return setErr(`Revisá el costo: ${costo.error.toLowerCase()}`);
    const min = readField(form.stockMin);
    if (min.error) return setErr(`Revisá el aviso de stock: ${min.error.toLowerCase()}`);
    const variantes = form.variantes.map(v => ({ ...v, nombre: v.nombre.trim() })).filter(v => v.nombre);
    const { id, nuevo: _n, ...rest } = form;
    store.save('producto', id, { ...rest, nombre: form.nombre.trim(), categoria: form.categoria.trim(), precio: precio.value, costo: costo.value, stockMin: min.value || null, variantes });
    setForm(null);
  };

  if (form) {
    return (
      <form className="kf-card kf-pro-form" onSubmit={guardar}>
        <h3 className="kf-card-title">{form.nuevo ? 'Nuevo producto' : 'Editar producto'}</h3>
        <div className="kf-pro-grid">
          <label className="kf-field"><span>Nombre</span><input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Poncho de telar" maxLength={80} autoFocus /></label>
          <label className="kf-field"><span>Categoría</span><input value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} placeholder="Textiles" maxLength={40} list="kf-cats" /><datalist id="kf-cats">{cats.map(c => <option key={c} value={c} />)}</datalist></label>
          <label className="kf-field"><span>Costo</span><span className="kf-input-wrap"><em className="pre">$</em><input inputMode="decimal" value={form.costo} onChange={e => setForm({ ...form, costo: e.target.value })} placeholder="0" /></span><small>Lo que te cuesta hacerlo o comprarlo</small></label>
          <label className="kf-field"><span>Precio de venta</span><span className="kf-input-wrap"><em className="pre">$</em><input inputMode="decimal" value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })} placeholder="0" /></span></label>
          <label className="kf-field"><span>Avisarme con stock de</span><input inputMode="numeric" value={form.stockMin} onChange={e => setForm({ ...form, stockMin: e.target.value })} placeholder="Ej.: 3" /><small>Vacío = sin aviso</small></label>
        </div>
        <p className="kf-pro-sub">Variantes (talle, color, aroma…) <small>opcional</small></p>
        {form.variantes.map((v, i) => (
          <div key={v.id} className="kf-pro-row">
            <input aria-label="Variante" value={v.nombre} onChange={e => setForm(f => ({ ...f, variantes: f.variantes.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)) }))} placeholder="Ej.: Azul" maxLength={40} />
            <button type="button" className="kf-x" aria-label="Quitar variante" onClick={() => setForm(f => ({ ...f, variantes: f.variantes.filter((_, j) => j !== i) }))}>×</button>
          </div>
        ))}
        <button type="button" className="kf-link" onClick={() => setForm(f => ({ ...f, variantes: [...f.variantes, { id: uid(), nombre: '' }] }))}>+ Agregar variante</button>
        {err && <p className="kf-err" role="alert">{err}</p>}
        <div className="kf-modal-act">
          <button type="button" className="kf-btn kf-btn--soft kf-btn--sm" onClick={() => setForm(null)}>Cancelar</button>
          <button type="submit" className="kf-btn kf-btn--coral kf-btn--sm">Guardar producto</button>
        </div>
      </form>
    );
  }
  if (importar) return <Importar store={store} data={data} onClose={() => setImportar(false)} />;
  return (
    <>
      {canEdit && (
        <div className="kf-pro-btns kf-pro-new">
          <button type="button" className="kf-btn kf-btn--coral kf-btn--sm" onClick={nuevo}>+ Nuevo producto</button>
          <button type="button" className="kf-btn kf-btn--outline kf-btn--sm" onClick={() => setImportar(true)}>Importar desde Excel</button>
        </div>
      )}
      {!data.productos.length && <p className="kf-empty">Cargá tus productos una vez y después vendés con un toque, con el precio y el stock al día. Si ya los tenés en una planilla, usá <b>Importar desde Excel</b>.</p>}
      <div className="kf-pro-list">
        {data.productos.map(p => {
          const margen = p.precio ? ((p.precio - (p.costo || 0)) / p.precio) * 100 : 0;
          return (
            <div key={p.id} className="kf-card kf-pro-item">
              <div className="kf-pro-item-h">
                <div>
                  <b>{p.nombre}</b>{p.categoria && <span className="kf-pro-tag soft">{p.categoria}</span>}
                  <small>{fmt(p.precio)}{p.costo ? ` · costo ${fmt(p.costo)} · margen ${Math.round(margen)}%` : ''}{p.variantes?.length ? ` · ${p.variantes.map(v => v.nombre).join(', ')}` : ''}</small>
                </div>
                {canEdit && <div className="kf-pro-btns"><button type="button" className={`kf-fav${p.favorito ? ' on' : ''}`} aria-pressed={!!p.favorito} aria-label={p.favorito ? `Sacar ${p.nombre} de favoritos` : `Marcar ${p.nombre} como favorito`} title="Favorito: aparece primero al vender" onClick={() => { const { id, deletedAt: _d, ...d } = p; store.save('producto', id, { ...d, favorito: !p.favorito }); }}>{p.favorito ? '★' : '☆'}</button><button type="button" className="kf-link" onClick={() => editar(p)}>Editar</button><button type="button" className="kf-link" onClick={() => window.confirm(`¿Mandar "${p.nombre}" a la papelera? Las ventas registradas no cambian.`) && store.remove('producto', p.id)}>Borrar</button></div>}
              </div>
            </div>
          );
        })}
      </div>
      <Papelera store={store} kind="producto" canEdit={canEdit} label={p => p.nombre} />
    </>
  );
}

// ---- Importar productos desde Excel / CSV / filas pegadas ----
function Importar({ store, data, onClose }) {
  const [res, setRes] = useState(null); // { items, errors, missing }
  const [pegado, setPegado] = useState('');
  const [leyendo, setLeyendo] = useState(false);
  const [fileErr, setFileErr] = useState('');
  const [hecho, setHecho] = useState(null);
  const plan = res ? planImport(res.items, data.productos) : [];
  const nuevos = plan.filter(x => !x.existente).length;

  const leerArchivo = async file => {
    setFileErr(''); setRes(null); setLeyendo(true);
    try {
      let rows;
      if (/\.(xlsx|xlsm)$/i.test(file.name)) {
        const { readSheet } = await import('read-excel-file/browser'); // se carga solo cuando hace falta
        rows = await readSheet(file);
      } else if (/\.(csv|txt|tsv)$/i.test(file.name)) {
        rows = parseDelimited(await file.text());
      } else {
        throw new Error('formato');
      }
      setRes(parseProductRows(rows.map(r => r.map(c => (c == null ? '' : c)))));
    } catch (e) {
      setFileErr(e?.message === 'formato' ? 'Subí un archivo de Excel (.xlsx) o CSV. Si tenés un .xls viejo, abrilo y guardalo como .xlsx.' : 'No pudimos leer el archivo. Probá guardarlo de nuevo como .xlsx, o copiá las filas y pegalas abajo.');
    }
    setLeyendo(false);
  };

  const confirmar = () => {
    const ctx = { movimientos: data.movimientos, ventas: data.ventas };
    let creados = 0; let actualizados = 0; let conStock = 0;
    for (const it of plan) {
      const prev = it.existente;
      const id = prev ? prev.id : store.newId();
      const prevVars = prev?.variantes || [];
      const variantes = it.variantes.length
        ? it.variantes.map(n => prevVars.find(v => keyName(v.nombre) === keyName(n)) || { id: uid(), nombre: n })
        : prevVars;
      const { id: _i, deletedAt: _d, ...base } = prev || {};
      store.save('producto', id, { ...base, nombre: it.nombre, categoria: it.categoria || base.categoria || '', costo: it.costo || base.costo || 0, precio: it.precio, stockMin: it.stockMin ?? base.stockMin ?? null, variantes });
      if (prev) actualizados++; else creados++;
      if (it.stock != null && !variantes.length) {
        const control = data.movimientos.some(m => m.productoId === id && (m.varianteId ?? null) === null);
        const cant = control ? it.stock - stockDe(id, null, ctx) : it.stock;
        if (cant || !control) {
          store.save('stock', store.newId(), { ts: Date.now(), productoId: id, varianteId: null, tipo: control ? 'ajuste' : 'inicial', cant: Math.round(cant), nota: 'Importado desde planilla' });
          conStock++;
        }
      }
    }
    setHecho({ creados, actualizados, conStock });
  };

  const descargarPlantilla = () => download('plantilla-productos-kit-feriante.csv', templateCsv(), 'text/csv;charset=utf-8');

  if (hecho) {
    return (
      <div className="kf-card kf-pro-form">
        <h3 className="kf-card-title">Listo</h3>
        <p className="kf-pro-ok">{hecho.creados ? `${hecho.creados} productos nuevos` : ''}{hecho.creados && hecho.actualizados ? ' y ' : ''}{hecho.actualizados ? `${hecho.actualizados} actualizados` : ''}{hecho.conStock ? `, con stock en ${hecho.conStock}` : ''}.</p>
        <div className="kf-modal-act"><button type="button" className="kf-btn kf-btn--coral kf-btn--sm" onClick={onClose}>Ver mis productos</button></div>
      </div>
    );
  }
  return (
    <div className="kf-card kf-pro-form">
      <h3 className="kf-card-title">Importar productos desde Excel</h3>
      <ol className="kf-pro-steps">
        <li>Descargá la plantilla y completala, o usá tu propia planilla con las columnas <b>Nombre</b> y <b>Precio</b>. También podés sumar Categoría, Costo, Stock, Aviso de stock y Variantes (separadas por coma).</li>
        <li>Subí el archivo, o copiá las filas desde Excel o Google Sheets (con el encabezado) y pegalas abajo.</li>
        <li>Revisá la vista previa y confirmá. Si un producto ya existe con el mismo nombre, se actualiza: no se duplica.</li>
      </ol>
      <div className="kf-pro-btns">
        <button type="button" className="kf-btn kf-btn--soft kf-btn--sm" onClick={descargarPlantilla}>Descargar plantilla</button>
        <label className="kf-btn kf-btn--outline kf-btn--sm kf-pro-file">Subir archivo (.xlsx o .csv)<input type="file" accept=".xlsx,.xlsm,.csv,.txt,.tsv" onChange={e => e.target.files[0] && leerArchivo(e.target.files[0])} /></label>
      </div>
      <label className="kf-field"><span>O pegá acá las filas</span>
        <textarea className="kf-pro-paste" rows={4} value={pegado} placeholder={'Nombre\tPrecio\tStock\nPoncho\t95000\t8'} onChange={e => { setPegado(e.target.value); setFileErr(''); setRes(e.target.value.trim() ? parseProductRows(parseDelimited(e.target.value)) : null); }} />
      </label>
      {leyendo && <p>Leyendo el archivo…</p>}
      {fileErr && <p className="kf-err" role="alert">{fileErr}</p>}
      {res?.missing?.length > 0 && <p className="kf-err" role="alert">Falta la columna {res.missing.join(' y ')} en la primera fila (el encabezado).</p>}
      {res && !res.missing.length && (
        <>
          <p className="kf-pro-sub">Vista previa: {nuevos} {nuevos === 1 ? 'producto nuevo' : 'productos nuevos'}, {plan.length - nuevos} {plan.length - nuevos === 1 ? 'se actualiza' : 'se actualizan'}{res.errors.length ? `, ${res.errors.length} con errores (no se importan)` : ''}</p>
          {res.errors.length > 0 && <ul className="kf-pro-errs">{res.errors.slice(0, 20).map(e => <li key={e.fila}>Fila {e.fila}: {e.msg}</li>)}</ul>}
          {plan.length > 0 && (
            <div className="kf-pro-prev">
              <table>
                <thead><tr><th>Producto</th><th>Precio</th><th>Costo</th><th>Stock</th><th /></tr></thead>
                <tbody>{plan.slice(0, 200).map(x => (
                  <tr key={x.fila}><td>{x.nombre}{x.variantes.length ? <small> · {x.variantes.join(', ')}</small> : ''}</td><td>{fmt(x.precio)}</td><td>{x.costo ? fmt(x.costo) : '—'}</td><td>{x.stock ?? '—'}</td><td>{x.existente ? <span className="kf-pro-tag soft">actualiza</span> : <span className="kf-pro-tag">nuevo</span>}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </>
      )}
      <div className="kf-modal-act">
        <button type="button" className="kf-btn kf-btn--soft kf-btn--sm" onClick={onClose}>Cancelar</button>
        <button type="button" className="kf-btn kf-btn--coral kf-btn--sm" disabled={!plan.length} onClick={confirmar}>Importar {plan.length || ''} {plan.length === 1 ? 'producto' : 'productos'}</button>
      </div>
    </div>
  );
}

// ---- Ventas PRO ----
const blankVenta = (feriaId, medio = 'mp') => ({ id: uid(), items: [], medio, descTipo: 'monto', descValor: '', nota: '', feriaId, ts: null });

function VentasPro({ store, data, canEdit, medios }) {
  const medioLabel = Object.fromEntries(medios);
  const [feriaSel, setFeriaSel] = useState(() => data.config.feriaActiva || '');
  const [draft, setDraft] = useState(() => blankVenta(data.config.feriaActiva || null));
  const [err, setErr] = useState('');
  const [vista, setVista] = useState('hoy');
  const [okMsg, setOkMsg] = useState('');
  const [tasas, setTasas] = useState(null);
  const [q, setQ] = useState('');
  const [eligiendo, setEligiendo] = useState(null); // producto con variantes esperando que se elija una
  const tasasRef = useRef(null);
  const abrirTasas = () => { if (tasasRef.current) { tasasRef.current.open = true; tasasRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); } };
  const [verTodos, setVerTodos] = useState(false);
  const buscador = useRef(null);
  const enviado = useRef(null);
  useEffect(() => { if (!feriaSel && data.config.feriaActiva) setFeriaSel(data.config.feriaActiva); }, [data.config.feriaActiva]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setDraft(d => (d.ts ? d : { ...d, feriaId: feriaSel || null })); }, [feriaSel]);

  const stockCtx = { movimientos: data.movimientos, ventas: data.ventas.filter(v => v.id !== draft.id) };
  const add = (p, vid) => {
    setErr('');
    setDraft(d => {
      const varianteId = vid ?? null;
      const i = d.items.findIndex(it => it.productoId === p.id && it.varianteId === varianteId);
      if (i >= 0) return { ...d, items: d.items.map((it, j) => (j === i ? { ...it, cant: it.cant + 1 } : it)) };
      return { ...d, items: [...d.items, { key: uid(), productoId: p.id, varianteId, nombre: p.nombre, cant: 1, precio: txt(p.precio), costo: p.costo || 0 }] };
    });
  };
  const setItem = (i, patch) => setDraft(d => ({ ...d, items: d.items.map((it, j) => (j === i ? { ...it, ...patch } : it)).filter(it => it.cant > 0) }));

  const items = [];
  let itemErr = '';
  for (const it of draft.items) {
    const pr = readField(it.precio, { required: true });
    if (pr.error && !itemErr) itemErr = `Revisá el precio de ${it.nombre}: ${pr.error.toLowerCase()}`;
    items.push({ productoId: it.productoId, varianteId: it.varianteId, nombre: it.nombre + (it.varianteId ? ` (${varName(data, it)})` : ''), cant: it.cant, precio: pr.value, costo: it.costo });
  }
  const desc = readField(draft.descValor, { percent: draft.descTipo === 'pct' });
  const venta = { items, medio: draft.medio, descuento: desc.value ? { tipo: draft.descTipo, valor: desc.value } : null };
  const tot = ventaTotales(venta, data.comisiones);

  const registrar = e => {
    e.preventDefault();
    if (!draft.items.length) return setErr('Elegí al menos un producto.');
    if (itemErr) return setErr(itemErr);
    if (desc.error) return setErr(`Revisá el descuento: ${desc.error.toLowerCase()}`);
    // Doble toque: el mismo borrador tiene siempre el mismo id, así que se guarda una sola vez.
    if (enviado.current === draft.id && !draft.ts) return;
    enviado.current = draft.id;
    store.save('venta', draft.id, { ts: draft.ts || Date.now(), feriaId: draft.feriaId || null, items, medio: draft.medio, descuento: venta.descuento, nota: draft.nota.trim() });
    setOkMsg(draft.ts ? 'Venta actualizada' : `Venta registrada: ${fmt(tot.total)}`);
    setTimeout(() => setOkMsg(''), 2500);
    setDraft(blankVenta(feriaSel || null, draft.medio));
    setErr('');
  };
  const editar = v => {
    setErr('');
    enviado.current = null;
    setDraft({ id: v.id, ts: v.ts, feriaId: v.feriaId, medio: v.medio, nota: v.nota || '', descTipo: v.descuento?.tipo || 'monto', descValor: txt(v.descuento?.valor ?? ''),
      items: v.items.map(it => ({ ...it, key: uid(), nombre: it.nombre.replace(/ \(.*\)$/, ''), precio: txt(it.precio) })) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const base = data.ventas.filter(v => (feriaSel ? v.feriaId === feriaSel : true));
  const lista = vista === 'hoy' ? base.filter(v => dayKey(v.ts) === hoyKey()) : base;
  const r = resumenVentas(lista, data.comisiones);
  const feria = data.ferias.find(f => f.id === feriaSel);

  return (
    <>
      <div className="kf-pro-bar">
        <label className="kf-field"><span>Feria</span>
          <select value={feriaSel} onChange={e => setFeriaSel(e.target.value)}>
            <option value="">Todas / sin feria</option>
            {data.ferias.map(f => <option key={f.id} value={f.id}>{f.nombre}{f.id === data.config.feriaActiva ? ' (activa)' : ''}</option>)}
          </select>
        </label>
        <div className="kf-seg" role="group" aria-label="Período">
          <button type="button" className={vista === 'hoy' ? 'on' : ''} onClick={() => setVista('hoy')}>Hoy</button>
          <button type="button" className={vista === 'todo' ? 'on' : ''} onClick={() => setVista('todo')}>{feria ? 'Toda la feria' : 'Todo'}</button>
        </div>
      </div>
      {canEdit && (
        <form className="kf-card kf-pro-form" onSubmit={registrar}>
          <h3 className="kf-card-title">{draft.ts ? 'Editar venta' : 'Nueva venta'}</h3>
          {!data.productos.length ? <p className="kf-empty">Primero cargá tus productos en <a href="#productos">Mis productos</a>.</p> : (
            (() => {
              // Venta rápida: favoritos y más vendidos primero; con muchos productos, buscador.
              const ordenados = ordenarParaVender(data.productos, data.ventas);
              const encontrados = buscarProductos(ordenados, q);
              const LIMITE = 12;
              const mostrar = q || verTodos ? encontrados : encontrados.slice(0, LIMITE);
              const conBuscador = data.productos.length > 6;
              const elegir = p => {
                if (p.variantes?.length) { setEligiendo(p); return; } // con variantes: primero se elige cuál
                add(p, null);
                if (q) { setQ(''); buscador.current?.focus(); }
              };
              return (
                <>
                  {conBuscador && (
                    <input ref={buscador} type="search" className="kf-pro-search" aria-label="Buscar producto" placeholder={`Buscar entre ${data.productos.length} productos…`} value={q}
                      onChange={e => setQ(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (encontrados.length === 1) elegir(encontrados[0]); } if (e.key === 'Escape') setQ(''); }} />
                  )}
                  <div className="kf-pro-chips" role="group" aria-label="Productos">
                    {mostrar.map(p => {
                      const st = controlaStock(p.id, data.movimientos) ? stockDe(p.id, undefined, stockCtx) : null;
                      return <button key={p.id} type="button" className={`kf-pro-chip${p.favorito ? ' fav' : ''}`} onClick={() => elegir(p)}>{p.favorito ? '★ ' : ''}{p.nombre}<small>{fmt(p.precio)}{st != null ? ` · ${st} en stock` : ''}</small></button>;
                    })}
                    {q && !encontrados.length && <p className="kf-empty">No hay productos con "{q}".</p>}
                  </div>
                  {!q && encontrados.length > LIMITE && <button type="button" className="kf-link" onClick={() => setVerTodos(v => !v)}>{verTodos ? 'Ver menos' : `Ver todos (${encontrados.length})`}</button>}
                  {q && encontrados.length === 1 && <small className="kf-pro-hint">Enter para sumarlo</small>}
                  {eligiendo && (
                    <div className="kf-pro-vars" role="group" aria-label={`Variante de ${eligiendo.nombre}`}>
                      <p>¿Qué {eligiendo.nombre} vendiste?</p>
                      <div className="kf-pro-chips">
                        {eligiendo.variantes.map(v => {
                          const st = data.movimientos.some(m => m.productoId === eligiendo.id && m.varianteId === v.id) ? stockDe(eligiendo.id, v.id, stockCtx) : null;
                          return <button key={v.id} type="button" className="kf-pro-chip" onClick={() => { add(eligiendo, v.id); setEligiendo(null); if (q) { setQ(''); buscador.current?.focus(); } }}>{v.nombre}<small>{st != null ? `${st} en stock` : ' '}</small></button>;
                        })}
                        <button type="button" className="kf-link" onClick={() => setEligiendo(null)}>Cancelar</button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()
          )}
          {draft.items.map((it, i) => {
            const p = data.productos.find(x => x.id === it.productoId);
            return (
              <div key={it.key} className="kf-pro-line">
                <span className="n">{it.nombre}</span>
                {p?.variantes?.length > 0 && <select aria-label="Variante" value={it.varianteId || ''} onChange={e => setItem(i, { varianteId: e.target.value || null })}>{p.variantes.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}</select>}
                <span className="kf-qty"><button type="button" aria-label="Uno menos" onClick={() => setItem(i, { cant: it.cant - 1 })}>−</button><b>{it.cant}</b><button type="button" aria-label="Uno más" onClick={() => setItem(i, { cant: it.cant + 1 })}>+</button></span>
                <span className="kf-input-wrap"><em className="pre">$</em><input aria-label={`Precio de ${it.nombre}`} inputMode="decimal" value={it.precio} onChange={e => setItem(i, { precio: e.target.value })} /></span>
              </div>
            );
          })}
          {draft.items.length > 0 && (
            <>
              <div className="kf-pro-grid">
                <label className="kf-field"><span>Medio de pago</span><select value={draft.medio} onChange={e => setDraft({ ...draft, medio: e.target.value })}>{medios.map(([k, l]) => <option key={k} value={k}>{l}{data.comisiones[k] ? ` (${txt(data.comisiones[k])}%)` : ''}</option>)}</select></label>
                <label className="kf-field"><span>Descuento</span>
                  <span className="kf-pro-desc">
                    <select aria-label="Tipo de descuento" value={draft.descTipo} onChange={e => setDraft({ ...draft, descTipo: e.target.value })}><option value="monto">$</option><option value="pct">%</option></select>
                    <input inputMode="decimal" value={draft.descValor} onChange={e => setDraft({ ...draft, descValor: e.target.value })} placeholder="0" />
                  </span>
                </label>
              </div>
              <div className="kf-pro-total">
                <span>Total <b>{fmt(tot.total)}</b></span>
                {tot.comision > 0 && <span>Comisión {txt(tot.tasa)}% <b>−{fmt(tot.comision)}</b></span>}
                <span>Te queda <b>{fmt(tot.neto)}</b></span>
              </div>
              {draft.medio !== 'efect' && !(data.comisiones[draft.medio] > 0) && (
                <p className="kf-pro-warn">No cargaste la comisión de {medioLabel[draft.medio] || draft.medio}: lo que te queda puede ser menos. <button type="button" className="kf-link-inline" onClick={abrirTasas}>Cargarla</button></p>
              )}
            </>
          )}
          {err && <p className="kf-err" role="alert">{err}</p>}
          <div className="kf-modal-act">
            {(draft.ts || draft.items.length > 0) && <button type="button" className="kf-btn kf-btn--soft kf-btn--sm" onClick={() => { setDraft(blankVenta(feriaSel || null, draft.medio)); setErr(''); }}>{draft.ts ? 'Cancelar edición' : 'Vaciar'}</button>}
            <button type="submit" className="kf-btn kf-btn--coral" disabled={!draft.items.length}>{draft.ts ? 'Guardar cambios' : '+ Registrar venta'}</button>
          </div>
          {okMsg && <p className="kf-pro-ok" role="status">{okMsg}</p>}
        </form>
      )}
      <div className="kf-metrics">
        <div><span>Ventas</span><b>{r.ventas}</b><small>{r.unidades} {r.unidades === 1 ? 'unidad' : 'unidades'}</small></div>
        <div><span>Cobrado</span><b>{fmt(r.total)}</b><small>{r.descuentos ? `con ${fmt(r.descuentos)} de descuentos` : 'bruto'}</small></div>
        <div><span>Comisiones</span><b>{fmt(r.comisiones)}</b><small>según tus tasas</small></div>
        <div><span>Neto</span><b>{fmt(r.neto)}</b><small>lo que te queda</small></div>
      </div>
      {Object.keys(r.porMedio).length > 0 && <div className="kf-medios">{Object.entries(r.porMedio).map(([m, x]) => <span key={m}>{medioLabel[m] || m} <b>{fmt(x.total)}</b></span>)}</div>}


      <div className="kf-ventas">
        {!lista.length && <p className="kf-empty">{vista === 'hoy' ? 'Todavía no hay ventas hoy.' : 'Todavía no hay ventas.'}</p>}
        {lista.map(v => {
          const t = ventaTotales(v, data.comisiones);
          return (
            <div key={v.id} className="kf-venta-i">
              <span className="p">{v.items.map(it => `${it.cant}× ${it.nombre}`).join(', ')}{t.descuento ? ` · desc. ${fmt(t.descuento)}` : ''}</span>
              <span className="m">{fmt(t.total)}</span>
              <span className={`kf-medio kf-medio--${v.medio}`}>{medioLabel[v.medio] || v.medio}</span>
              <span className="h">{vista === 'todo' ? `${fDia(dayKey(v.ts))} ` : ''}{hora(v.ts)}</span>
              {canEdit && <span className="kf-pro-btns"><button type="button" className="kf-link" onClick={() => editar(v)}>Editar</button><button type="button" aria-label="Borrar venta" onClick={() => window.confirm('¿Borrar esta venta? El stock se repone solo y la podés recuperar de la papelera.') && store.remove('venta', v.id)}>×</button></span>}
            </div>
          );
        })}
      </div>
      <Papelera store={store} kind="venta" canEdit={canEdit} label={v => `${(v.items || []).map(it => `${it.cant}× ${it.nombre}`).join(', ')} · ${fmt(ventaTotales(v, data.comisiones).total)}`} />

      <details ref={tasasRef} className="kf-card kf-pro-tasas" onToggle={e => e.target.open && setTasas(Object.fromEntries(medios.map(([k]) => [k, txt(data.comisiones[k] ?? '')])))}>
        <summary>Comisiones por medio de pago</summary>
        <p>Poné el % que te cobra cada medio (míralo en la herramienta Cobros o en tu cuenta). Se usa para calcular lo que te queda.</p>
        {tasas && (
          <form onSubmit={e => {
            e.preventDefault();
            const c = {};
            for (const [k, l] of medios) { const f = readField(tasas[k], { percent: true }); if (f.error) return setErr(`Comisión de ${l}: ${f.error.toLowerCase()}`); if (f.value) c[k] = f.value; }
            store.save('config', 'config', { ...data.config, comisiones: c });
            e.target.closest('details').open = false;
          }}>
            <div className="kf-pro-grid">
              {medios.map(([k, l]) => <label key={k} className="kf-field"><span>{l}</span><span className="kf-input-wrap"><input inputMode="decimal" value={tasas[k]} onChange={e => setTasas({ ...tasas, [k]: e.target.value })} placeholder="0" disabled={!canEdit} /><em>%</em></span></label>)}
            </div>
            {canEdit && <button type="submit" className="kf-btn kf-btn--coral kf-btn--sm">Guardar comisiones</button>}
          </form>
        )}
      </details>
    </>
  );
}
const varName = (data, it) => data.productos.find(p => p.id === it.productoId)?.variantes?.find(v => v.id === it.varianteId)?.nombre || '';

// ---- Stock ----
function Stock({ store, data, canEdit }) {
  const [mov, setMov] = useState(null); // { productoId, varianteId, tipo, cant }
  const [err, setErr] = useState('');
  const ctx = { movimientos: data.movimientos, ventas: data.ventas };
  const filas = data.productos.flatMap(p => (p.variantes?.length ? p.variantes.map(v => ({ p, v })) : [{ p, v: null }]));
  const guardar = e => {
    e.preventDefault();
    const { value, error } = readField(mov.cant, { positive: mov.tipo !== 'ajuste', required: true });
    if (error && mov.tipo !== 'ajuste') return setErr(`Revisá la cantidad: ${error.toLowerCase()}`);
    let cant = value;
    if (mov.tipo === 'ajuste') {
      // Ajuste: se escribe cuántas hay de verdad y se guarda la diferencia.
      const real = readField(mov.cant, { required: true });
      if (real.error) return setErr(`Revisá la cantidad: ${real.error.toLowerCase()}`);
      cant = real.value - stockDe(mov.productoId, mov.varianteId, ctx);
      if (!cant) { setMov(null); return; }
    }
    store.save('stock', store.newId(), { ts: Date.now(), productoId: mov.productoId, varianteId: mov.varianteId, tipo: mov.tipo, cant: Math.round(cant), nota: mov.nota?.trim() || '' });
    setMov(null);
    setErr('');
  };
  const bajos = filas.filter(({ p, v }) => controlaStock(p.id, data.movimientos) && stockBajo(p, stockDe(p.id, v ? v.id : null, ctx)));
  const TIPOS = { inicial: 'Existencias', reposicion: 'Reposición', ajuste: 'Ajuste' };

  return (
    <>
      {bajos.length > 0 && <div className="kf-tip" role="alert"><span><strong>Stock bajo:</strong> {bajos.map(({ p, v }) => `${p.nombre}${v ? ` (${v.nombre})` : ''}: ${stockDe(p.id, v ? v.id : null, ctx)}`).join(' · ')}</span></div>}
      {!data.productos.length && <p className="kf-empty">Primero cargá tus productos en <a href="#productos">Mis productos</a>.</p>}
      <div className="kf-pro-list">
        {filas.map(({ p, v }) => {
          const vid = v ? v.id : null;
          const control = data.movimientos.some(m => m.productoId === p.id && (m.varianteId ?? null) === vid);
          const s = stockDe(p.id, vid, ctx);
          const open = mov && mov.productoId === p.id && mov.varianteId === vid;
          return (
            <div key={p.id + (vid || '')} className={`kf-card kf-pro-item${control && stockBajo(p, s) ? ' low' : ''}`}>
              <div className="kf-pro-item-h">
                <div><b>{p.nombre}{v ? ` · ${v.nombre}` : ''}</b><small>{control ? `${s} ${Math.abs(s) === 1 ? 'unidad' : 'unidades'}${s < 0 ? ' (vendiste más de lo cargado: revisá con un ajuste)' : ''}` : 'Sin control de stock'}</small></div>
                {canEdit && !open && (
                  <div className="kf-pro-btns">
                    {!control ? <button type="button" className="kf-link" onClick={() => setMov({ productoId: p.id, varianteId: vid, tipo: 'inicial', cant: '' })}>Cargar existencias</button> : (
                      <><button type="button" className="kf-link" onClick={() => setMov({ productoId: p.id, varianteId: vid, tipo: 'reposicion', cant: '' })}>Reponer</button>
                        <button type="button" className="kf-link" onClick={() => setMov({ productoId: p.id, varianteId: vid, tipo: 'ajuste', cant: String(s) })}>Ajustar</button></>
                    )}
                  </div>
                )}
              </div>
              {open && (
                <form className="kf-pro-row" onSubmit={guardar}>
                  <label className="kf-field"><span>{mov.tipo === 'ajuste' ? 'Cuántas hay de verdad' : mov.tipo === 'inicial' ? 'Cuántas tenés' : 'Cuántas sumás'}</span><input inputMode="numeric" value={mov.cant} onChange={e => setMov({ ...mov, cant: e.target.value })} autoFocus /></label>
                  <button type="submit" className="kf-btn kf-btn--coral kf-btn--sm">Guardar</button>
                  <button type="button" className="kf-btn kf-btn--soft kf-btn--sm" onClick={() => { setMov(null); setErr(''); }}>Cancelar</button>
                </form>
              )}
              {open && err && <p className="kf-err" role="alert">{err}</p>}
            </div>
          );
        })}
      </div>
      {data.movimientos.length > 0 && (
        <details className="kf-card kf-pro-tasas">
          <summary>Movimientos cargados ({data.movimientos.length})</summary>
          <div className="kf-ventas">
            {data.movimientos.slice(0, 50).map(m => {
              const p = data.productos.find(x => x.id === m.productoId);
              const vn = p?.variantes?.find(x => x.id === m.varianteId)?.nombre;
              return (
                <div key={m.id} className="kf-venta-i">
                  <span className="p">{TIPOS[m.tipo] || m.tipo} · {p?.nombre || 'Producto borrado'}{vn ? ` (${vn})` : ''}</span>
                  <span className="m">{m.cant > 0 ? '+' : ''}{m.cant}</span>
                  <span className="h">{fDia(dayKey(m.ts))} {hora(m.ts)}</span>
                  {canEdit && <button type="button" aria-label="Borrar movimiento" onClick={() => window.confirm('¿Borrar este movimiento de stock?') && store.remove('stock', m.id)}>×</button>}
                </div>
              );
            })}
          </div>
        </details>
      )}
      <p className="kf-pro-note">Cada venta descuenta stock sola. Si editás o borrás una venta, el stock se corrige solo.</p>
    </>
  );
}

// ---- Papelera y exportar ----
function Papelera({ store, kind, canEdit, label }) {
  const items = store.list(kind, { trash: true });
  if (!items.length) return null;
  return (
    <details className="kf-pro-trash">
      <summary>Papelera ({items.length})</summary>
      <p>Se guarda 30 días.</p>
      {items.map(x => (
        <div key={x.id} className="kf-venta-i">
          <span className="p">{label(x)}</span>
          {canEdit && <button type="button" className="kf-link" onClick={() => { const { id, deletedAt: _d, ...d } = x; store.save(kind, id, d); }}>Recuperar</button>}
        </div>
      ))}
    </details>
  );
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function Exportar({ data, medios }) {
  const medioLabel = Object.fromEntries(medios);
  const csv = () => {
    const ferias = Object.fromEntries(data.ferias.map(f => [f.id, f.nombre]));
    const rows = [['Fecha', 'Hora', 'Feria', 'Productos', 'Unidades', 'Subtotal', 'Descuento', 'Total', 'Medio de pago', 'Comisión', 'Neto']];
    for (const v of [...data.ventas].sort((a, b) => a.ts - b.ts)) {
      const t = ventaTotales(v, data.comisiones);
      const n = x => String(Math.round(x * 100) / 100).replace('.', ',');
      rows.push([dayKey(v.ts), hora(v.ts), ferias[v.feriaId] || '', v.items.map(it => `${it.cant}x ${it.nombre}`).join(' + '), t.unidades, n(t.subtotal), n(t.descuento), n(t.total), medioLabel[v.medio] || v.medio, n(t.comision), n(t.neto)]);
    }
    download(`ventas-pro-${hoyKey()}.csv`, '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
  };
  const json = () => download(`kit-feriante-pro-${hoyKey()}.json`, JSON.stringify({ exportado: new Date().toISOString(), ...data }, null, 2), 'application/json');
  if (!data.ventas.length && !data.productos.length && !data.ferias.length) return null;
  return (
    <div className="kf-actions kf-pro-export">
      {data.ventas.length > 0 && <button type="button" className="kf-btn kf-btn--outline" onClick={csv}>Descargar ventas PRO (Excel / CSV)</button>}
      <button type="button" className="kf-link" onClick={json}>Copia completa de mis datos PRO</button>
    </div>
  );
}

export { gastosFeria, fecha };
