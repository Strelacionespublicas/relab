// "Mi sueldo y rentabilidad" (herramienta gratis del Kit, momento "Después de la feria").
// Cuentas en ./sueldo-calc.js; lo cargado se guarda en el estado del kit bajo `sueldo`
// ({ f: campos, hist: jornadas guardadas }) y viaja con la cuenta como el resto (src/kit/sync.js).
// Se completa sola con lo que ya está en Ventas del día y en el ROI: un campo sin tocar muestra la
// sugerencia; si la persona escribe, gana lo escrito.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { fmt, readField } from './calc.js';
import { MAX_HIST, newId } from './state.js';
import { ALL_KEYS, REINV_DEFAULT, acumuladoMensual, calcSueldo, efectivo, resumenParaHistorial, sugerencias } from './sueldo-calc.js';
import { EJEMPLO_SUELDO } from './sueldo-ejemplo.js';

const pct = x => (x == null ? '—' : `${Math.round(x * 100)}%`);
const horasTxt = h => `${String(Math.round(h * 10) / 10).replace('.', ',')} h`;
const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fechaTxt = f => { const [y, m, d] = String(f || '').split('-').map(Number); return y ? new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'; };
const mesTxt = k => { const [y, m] = k.split('-').map(Number); const s = new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1); };

// Colores de los sobres (validados para daltonismo y contraste; siempre con nombre y monto al lado).
export const SOBRES = [
  ['negocio', 'Mi negocio', '#2368B5', 'Reponer mercadería y pagar los gastos. No es tuyo: es del negocio.'],
  ['sueldo', 'Mi sueldo', '#0E9C8C', 'Tu mano de obra y tu jornada de feria. Es lo que te ganaste trabajando.'],
  ['ganancia', 'Mi ganancia', '#D3860F', 'Lo que sobra después de pagar todo y de pagarte. Disponible para vos.'],
  ['reinversion', 'Mi reinversión', '#9A5BD0', 'Para crecer: más stock, un stand mejor, herramientas.'],
];
const SEMAFORO = {
  verde: ['ok', '●', 'Cubriste costos, tu sueldo y te quedó ganancia'],
  amarillo: ['mid', '●', 'Cubriste los costos, pero no todo tu sueldo'],
  rojo: ['bad', '●', 'Lo vendido no alcanzó para cubrir los costos'],
};

function Campo({ k, label, f, sug, upd, errors, suffix = '$', hint, placeholder = '0' }) {
  const s = sug[k];
  const auto = f[k] === undefined && s;
  const value = efectivo(f, sug, k);
  const err = errors[k];
  return (
    <label className="kf-field">
      <span>{label}</span>
      <span className="kf-input-wrap">
        <input type="text" inputMode="decimal" value={value} placeholder={placeholder} onChange={e => upd(k, e.target.value)} aria-invalid={err ? true : undefined} />
        {suffix && <em>{suffix}</em>}
      </span>
      {err ? <small className="kf-err" role="alert">{err}</small>
        : auto ? <small className="ms-from">Tomado de {s.from}. Si no es así, escribí otro número.</small>
          : s && f[k] !== String(s.value) ? <small><button type="button" className="kf-link-inline ms-reset" onClick={() => upd(k, undefined)}>↺ Volver a lo de {s.from} ({fmt(s.value)})</button></small>
            : hint && <small>{hint}</small>}
    </label>
  );
}

const Dato = ({ label, value, hi, tone }) => <div className={hi ? 'hi' : ''}><span>{label}</span><b className={tone || ''}>{value}</b></div>;

// Barra apilada de los cuatro sobres (parte de un todo: lo vendido). Cada tramo con su nombre y monto en la leyenda.
function BarraSobres({ s, total }) {
  const [tip, setTip] = useState(null);
  const parts = SOBRES.map(([k, label, color]) => ({ k, label, color, v: s[k] })).filter(p => p.v > 0.5);
  if (!(total > 0) || !parts.length) return null;
  return (
    <div className="ms-barra-wrap">
      <div className="ms-barra" role="img" aria-label={'Reparto de lo vendido: ' + parts.map(p => `${p.label} ${fmt(p.v)}`).join(', ')} onMouseLeave={() => setTip(null)}>
        {parts.map(p => (
          <span key={p.k} style={{ flexGrow: p.v, background: p.color }} onMouseEnter={() => setTip(p)} onClick={() => setTip(p)} />
        ))}
      </div>
      <p className="ms-barra-tip" aria-live="polite">{tip ? <><i style={{ background: tip.color }} />{tip.label}: <b>{fmt(tip.v)}</b> · {Math.round((tip.v / total) * 100)}% de lo vendido</> : 'Tocá un tramo para ver el detalle.'}</p>
    </div>
  );
}

// Resumen para imprimir o guardar en PDF (se usa el "Imprimir" del navegador).
function Imprimible({ data }) {
  if (!data) return null;
  const { nombre, fecha, r } = data;
  const b = r.balance;
  const sem = r.semaforo && SEMAFORO[r.semaforo];
  return createPortal(
    <div className="ms-print">
      <p className="ms-print-k">Kit del feriante · Mi sueldo y rentabilidad</p>
      <h1>{nombre || 'Mi jornada de feria'}</h1>
      <p>{fechaTxt(fecha)}{sem ? ` · ${sem[2]}` : ''}</p>
      <h2>Tu tiempo</h2>
      <table><tbody>
        <tr><td>Valor de tu hora</td><td>{fmt(r.jornada.valorHora)}</td></tr>
        <tr><td>Horas de la feria</td><td>{horasTxt(r.jornada.horasTotal)}</td></tr>
        <tr><td>Sueldo objetivo de la feria</td><td>{fmt(b.sueldo)}</td></tr>
      </tbody></table>
      <h2>Balance</h2>
      <table><tbody>
        <tr><td>Facturación</td><td>{fmt(b.ventas)}</td></tr>
        <tr><td>Costos de lo vendido (incluye mano de obra {fmt(b.cMo)})</td><td>−{fmt(b.costos)}</td></tr>
        <tr><td>Gastos de participar</td><td>−{fmt(b.gastos)}</td></tr>
        <tr><td>Tu sueldo de feria</td><td>−{fmt(b.sueldo)}</td></tr>
        <tr className="t"><td>Ganancia neta</td><td>{fmt(b.resultado)}</td></tr>
        <tr><td>Margen</td><td>{pct(b.margen)}</td></tr>
        <tr><td>Facturación mínima para cubrir todo</td><td>{b.minima != null ? fmt(b.minima) : '—'}</td></tr>
      </tbody></table>
      <h2>Los cuatro sobres</h2>
      <table><tbody>
        {SOBRES.map(([k, label]) => <tr key={k}><td>{label}</td><td>{fmt(r.sobres[k])}</td></tr>)}
        <tr className="t"><td>Ingreso personal (sueldo + ganancia disponible)</td><td>{fmt(r.sobres.ingresoPersonal)}</td></tr>
      </tbody></table>
      {b.faltaSueldo > 0 && <p>Te faltaron {fmt(b.faltaSueldo)} para cubrir tu sueldo de feria.</p>}
      {b.faltaCostos > 0 && <p>Faltaron {fmt(b.faltaCostos)} para cubrir los costos y gastos.</p>}
      <p className="ms-print-pie">relab.strelacionespublicas.com.ar/kit-feriante</p>
    </div>,
    document.body,
  );
}

export function MiSueldo({ st, set, isPro, openTab }) {
  const f = st.sueldo.f;
  const hist = st.sueldo.hist;
  const sug = useMemo(() => sugerencias({ roi: st.roi, ventas: st.ventas }), [st.roi, st.ventas]);
  const r = calcSueldo(f, sug);
  const { hora, jornada: j, balance: b, sobres: s, errors } = r;
  const upd = (k, v) => set('sueldo', x => {
    const nf = { ...x.f };
    if (v === undefined) delete nf[k]; else nf[k] = v;
    return { ...x, f: nf };
  });
  const [editId, setEditId] = useState(null);
  const [nombre, setNombre] = useState('');
  const [fecha, setFecha] = useState(hoy);
  const [aviso, setAviso] = useState('');
  const [printData, setPrintData] = useState(null);
  const editando = editId && hist.find(h => h.id === editId);

  useEffect(() => {
    if (!printData) return undefined;
    document.body.classList.add('ms-print-on');
    const done = () => { document.body.classList.remove('ms-print-on'); setPrintData(null); };
    window.addEventListener('afterprint', done, { once: true });
    const t = setTimeout(() => window.print(), 50);
    return () => { clearTimeout(t); window.removeEventListener('afterprint', done); document.body.classList.remove('ms-print-on'); };
  }, [printData]);

  const hayDatos = ALL_KEYS.some(k => k !== 'reinv' && f[k] !== undefined && f[k] !== '');
  const verEjemplo = () => {
    if (hayDatos && !window.confirm('El ejemplo reemplaza lo que cargaste acá. ¿Seguimos?')) return;
    setEditId(null);
    setNombre('Ejemplo · Feria del domingo');
    set('sueldo', x => ({ ...x, f: { ...EJEMPLO_SUELDO } }));
  };
  const limpiar = () => {
    if (!window.confirm('¿Borrar lo que cargaste en esta herramienta? Las jornadas guardadas no se tocan.')) return;
    setEditId(null);
    setNombre('');
    set('sueldo', x => ({ ...x, f: {} }));
  };
  const guardar = () => {
    if (!r.ok) { setAviso('Corregí los campos marcados antes de guardar.'); return; }
    if (!(b.ventas > 0) && !(b.costos + b.gastos > 0)) { setAviso('Cargá al menos lo que vendiste o lo que gastaste.'); return; }
    if (!editando && hist.length >= MAX_HIST) { setAviso(`Llegaste a ${MAX_HIST} jornadas guardadas. Borrá alguna vieja para guardar esta.`); return; }
    const entry = { id: editando ? editando.id : newId(), nombre: nombre.trim().slice(0, 80) || 'Jornada de feria', fecha: /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : hoy(), ts: Date.now(), ...resumenParaHistorial(f, sug) };
    set('sueldo', x => {
      const rest = x.hist.filter(h => h.id !== entry.id);
      return { ...x, hist: [entry, ...rest].sort((a, c) => c.fecha.localeCompare(a.fecha) || c.ts - a.ts) };
    });
    setEditId(entry.id);
    setAviso(editando ? '✓ Cambios guardados.' : '✓ Jornada guardada en tu historial.');
  };
  const abrir = h => {
    if (hayDatos && editId !== h.id && !window.confirm('Esto reemplaza lo que tenés cargado arriba por esta jornada. ¿Seguimos?')) return;
    set('sueldo', x => ({ ...x, f: { ...h.f } }));
    setEditId(h.id);
    setNombre(h.nombre);
    setFecha(h.fecha);
    setAviso(`Editando "${h.nombre}". Cambiá lo que quieras y tocá "Guardar cambios".`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const borrar = h => {
    if (!window.confirm(`¿Borrar "${h.nombre}" del historial?`)) return;
    set('sueldo', x => ({ ...x, hist: x.hist.filter(y => y.id !== h.id) }));
    if (editId === h.id) setEditId(null);
  };
  const nueva = () => { setEditId(null); setNombre(''); setFecha(hoy()); setAviso(''); set('sueldo', x => ({ ...x, f: {} })); };
  const pdfActual = () => setPrintData({ nombre: nombre.trim() || 'Mi jornada de feria', fecha, r });
  const pdfDe = h => setPrintData({ nombre: h.nombre, fecha: h.fecha, r: calcSueldo(h.f) });

  const reinv = readField(f.reinv ?? String(REINV_DEFAULT), { percent: true, fallback: REINV_DEFAULT }).value;
  const sem = r.semaforo && SEMAFORO[r.semaforo];
  const mostrarResultado = r.ok && r.semaforo;
  const meses = isPro ? acumuladoMensual(hist) : [];
  const mejor = hist.length > 1 ? hist.reduce((a, h) => (h.r.margen ?? -Infinity) > (a.r.margen ?? -Infinity) ? h : a, hist[0]) : null;

  return (
    <div className="ms">
      <div className="ms-top">
        <button type="button" className="kf-btn kf-btn--soft kf-btn--sm" onClick={verEjemplo}>Ver ejemplo</button>
        {hayDatos && <button type="button" className="kf-btn kf-btn--ghost kf-btn--sm" onClick={limpiar}>Limpiar</button>}
        {editando && <span className="ms-editing">Editando: <b>{editando.nombre}</b> · <button type="button" className="kf-link-inline" onClick={nueva}>Empezar una nueva</button></span>}
      </div>

      {/* 1 */}
      <section className="kf-card ms-mod" aria-labelledby="ms-h1">
        <h3 className="ms-h" id="ms-h1"><span>1</span>¿Cuánto vale mi hora?</h3>
        <div className="ms-g3">
          <Campo k="hSueldo" label="Sueldo mensual que querés ganar" f={f} sug={sug} upd={upd} errors={errors} />
          <Campo k="hDias" label="Días que trabajás por mes" f={f} sug={sug} upd={upd} errors={errors} suffix="días" placeholder="Ej.: 20" />
          <Campo k="hHoras" label="Horas por día" f={f} sug={sug} upd={upd} errors={errors} suffix="h" placeholder="Ej.: 8" />
        </div>
        <p className="ms-note">Contá <b>todas</b> tus horas de trabajo: producir, comprar, administrar, vender, publicar en redes y estar en ferias.</p>
        <div className="ms-out">
          <Dato label="Horas al mes" value={hora.horasMes ? horasTxt(hora.horasMes) : '—'} />
          <Dato label="Tu hora vale" value={hora.valorHora != null ? fmt(hora.valorHora) : '—'} hi />
          <Dato label="Tu jornada vale" value={hora.valorJornada != null ? fmt(hora.valorJornada) : '—'} />
        </div>
        {hora.falta === 'horas' && <p className="kf-muted">Cargá los días y las horas para saber cuánto vale tu hora.</p>}
      </section>

      {/* 2 */}
      <section className="kf-card ms-mod" aria-labelledby="ms-h2">
        <h3 className="ms-h" id="ms-h2"><span>2</span>Mi sueldo por jornada de feria</h3>
        <p className="ms-note">Una feria no son solo las horas en el stand. <b>Aunque no vendas, tu tiempo vale.</b></p>
        <div className="ms-g3">
          <Campo k="jPrep" label="Preparación" f={f} sug={sug} upd={upd} errors={errors} suffix="h" />
          <Campo k="jTras" label="Traslado (ida y vuelta)" f={f} sug={sug} upd={upd} errors={errors} suffix="h" />
          <Campo k="jArmado" label="Armado" f={f} sug={sug} upd={upd} errors={errors} suffix="h" />
          <Campo k="jVenta" label="Atención y venta" f={f} sug={sug} upd={upd} errors={errors} suffix="h" />
          <Campo k="jDesarmado" label="Desarmado" f={f} sug={sug} upd={upd} errors={errors} suffix="h" />
          <Campo k="jOtras" label="Otras" f={f} sug={sug} upd={upd} errors={errors} suffix="h" />
        </div>
        {errors.jHoras && <p className="kf-err" role="alert">{errors.jHoras}</p>}
        <div className="ms-g2">
          <Campo k="jValor" label="Valor de tu hora" f={f} sug={sug} upd={upd} errors={errors}
            placeholder={hora.valorHora != null ? String(Math.round(hora.valorHora)) : '0'}
            hint={j.valorHoraPropio ? 'Lo escribiste a mano.' : hora.valorHora != null ? 'Tomado del paso 1. Podés cambiarlo.' : 'Completá el paso 1 o escribilo acá.'} />
          <Campo k="jCant" label="¿Cuántas jornadas dura la feria?" f={f} sug={sug} upd={upd} errors={errors} suffix="" placeholder="1" />
        </div>
        <div className="ms-out">
          <Dato label="Horas por jornada" value={horasTxt(j.horas)} />
          <Dato label="Sueldo por jornada" value={fmt(j.sueldoJornada)} hi />
          {j.cant > 1 && <Dato label={`Sueldo de las ${j.cant} jornadas`} value={fmt(j.sueldoFeria)} />}
        </div>
      </section>

      {/* 3 */}
      <section className="kf-card ms-mod" aria-labelledby="ms-h3">
        <h3 className="ms-h" id="ms-h3"><span>3</span>Balance de la feria</h3>
        <div className="ms-bal">
          <div>
            <p className="ms-sub">Ingresos</p>
            <Campo k="bVentas" label="Lo que vendiste en total" f={f} sug={sug} upd={upd} errors={errors} />
            <p className="ms-sub">Costos de lo que vendiste</p>
            <Campo k="cMp" label="Materia prima o mercadería" f={f} sug={sug} upd={upd} errors={errors} hint="Solo de lo que vendiste, no de todo el stock." />
            <Campo k="cPack" label="Packaging" f={f} sug={sug} upd={upd} errors={errors} />
            <Campo k="cMo" label="Mano de obra de producción" f={f} sug={sug} upd={upd} errors={errors}
              placeholder={b.moSug != null && (f.cMo === undefined || f.cMo === '') ? String(Math.round(b.moSug)) : '0'}
              hint="Lo que te pagás por fabricar lo que vendiste. Si revendés, dejalo en 0." />
            <details className="ms-mo" open={f.moHoras !== undefined && f.moHoras !== ''}>
              <summary>¿Lo hiciste vos? Calculalo con tus horas</summary>
              <Campo k="moHoras" label="Horas que te llevó hacer lo que vendiste" f={f} sug={sug} upd={upd} errors={errors} suffix="h"
                hint={j.valorHora > 0 ? `Se multiplica por tu hora (${fmt(j.valorHora)}) si no escribiste un monto arriba.` : 'Completá el valor de tu hora en el paso 2.'} />
            </details>
            <Campo k="cOtros" label="Otros costos de producción" f={f} sug={sug} upd={upd} errors={errors} />
          </div>
          <div>
            <p className="ms-sub">Gastos de participar</p>
            <Campo k="gTransp" label="Transporte" f={f} sug={sug} upd={upd} errors={errors} />
            <Campo k="gAlq" label="Alquiler del stand o inscripción" f={f} sug={sug} upd={upd} errors={errors} />
            <Campo k="gAlim" label="Alimentación" f={f} sug={sug} upd={upd} errors={errors} />
            <Campo k="gCom" label="Comisiones (billeteras, posnet)" f={f} sug={sug} upd={upd} errors={errors} />
            <Campo k="gImp" label="Impuestos" f={f} sug={sug} upd={upd} errors={errors} />
            <Campo k="gOtros" label="Otros gastos" f={f} sug={sug} upd={upd} errors={errors} />
            <p className="ms-sub">Tu remuneración</p>
            <div className="ms-remu"><span>Sueldo de feria (paso 2)</span><b>{fmt(j.sueldoFeria)}</b></div>
          </div>
        </div>
        <p className="ms-note"><b>Facturar no es ganar.</b> De cada venta, una parte vuelve al negocio para reponer y pagar gastos.</p>
      </section>

      {!r.ok && <p className="kf-empty">Corregí los campos marcados para ver el resultado.</p>}

      {mostrarResultado && (
        <section className="kf-results ms-dash" aria-labelledby="ms-hd">
          <h3 id="ms-hd">Tu resultado</h3>
          <div className={`ms-sem ms-sem--${sem[0]}`} role="status"><span aria-hidden="true">{sem[1]}</span><b>{r.semaforo === 'verde' ? 'Verde' : r.semaforo === 'amarillo' ? 'Amarillo' : 'Rojo'}:</b> {sem[2]}{b.resultado === 0 && r.semaforo === 'verde' ? ', justo, sin ganancia.' : '.'}</div>
          {b.faltaCostos > 0 && <p className="ms-falta">Faltaron <b>{fmt(b.faltaCostos)}</b> para cubrir costos y gastos, y <b>{fmt(b.sueldo)}</b> de tu sueldo de feria.</p>}
          {b.faltaCostos === 0 && b.faltaSueldo > 0 && <p className="ms-falta">Te faltaron <b>{fmt(b.faltaSueldo)}</b> para cubrir tu sueldo de feria. No lo saques de la plata de los costos.</p>}
          <div className="kf-res-grid ms-cards">
            <Dato label="Total vendido" value={fmt(b.ventas)} />
            <Dato label="Horas de la feria" value={horasTxt(j.horasTotal)} />
            <Dato label="Valor de tu hora" value={fmt(j.valorHora)} />
            <Dato label="Sueldo objetivo" value={fmt(b.sueldo)} />
            <Dato label="Sueldo cubierto" value={fmt(b.sueldoCubierto)} tone={b.sueldoCubierto < b.sueldo ? 'neg' : 'pos'} />
            <Dato label="Para reponer y gastos" value={fmt(s.negocio)} />
            <Dato label="Ganancia neta" value={fmt(b.resultado)} tone={b.resultado < 0 ? 'neg' : 'pos'} hi />
            <Dato label={`Reinversión (${s.pctReinv}%)`} value={fmt(s.reinversion)} />
            <Dato label="Ingreso personal" value={fmt(s.ingresoPersonal)} hi />
            <Dato label="Margen" value={pct(b.margen)} tone={b.margen < 0 ? 'neg' : ''} />
          </div>
          <p className="ms-min">
            {b.minima != null ? <>Para cubrir costos, gastos y tu sueldo necesitás facturar al menos <b>{fmt(b.minima)}</b>{b.ventas >= b.minima ? ' — lo superaste.' : ` — te faltaron ${fmt(b.minima - b.ventas)}.`}</>
              : b.minimaMotivo === 'sinMargen' ? <>Con estos costos no hay venta que alcance: cada venta cuesta lo mismo o más de lo que cobrás. Revisá precios en la <button type="button" className="kf-link-inline" onClick={() => openTab('calculadora')}>Calculadora</button>.</>
                : <>Cargá lo que vendiste para calcular la facturación mínima.</>}
          </p>
          <p className="ms-aclara">Ingreso personal = mano de obra cubierta ({fmt(s.moCubierta)}) + sueldo de feria cubierto ({fmt(s.sueldoCubierto)}) + ganancia disponible ({fmt(s.ganancia)}). El sueldo objetivo es lo que querías; el sueldo cubierto es lo que la feria realmente generó.</p>
        </section>
      )}

      {/* 4 */}
      {mostrarResultado && (
        <section className="kf-card ms-mod" aria-labelledby="ms-h4">
          <h3 className="ms-h" id="ms-h4"><span>4</span>Los cuatro sobres</h3>
          <p className="ms-note">Separá la plata apenas termina la feria. <b>Reponer no es reinvertir</b>: reponer es volver a tener lo que vendiste; reinvertir es crecer.</p>
          <label className="ms-slider">
            <span>¿Qué parte de la ganancia reinvertís? <b>{Math.round(reinv)}%</b></span>
            <input type="range" min="0" max="100" step="5" value={Math.round(reinv)} onChange={e => upd('reinv', e.target.value)} aria-valuetext={`${Math.round(reinv)}%`} />
            <small>No hay un porcentaje obligatorio. Elegí el que te sirva hoy.</small>
          </label>
          <BarraSobres s={s} total={b.ventas} />
          <div className="ms-sobres">
            {SOBRES.map(([k, label, color, desc]) => (
              <div key={k} className="ms-sobre" style={{ '--c': color }}>
                <p><i aria-hidden="true" />{label}</p>
                <b>{fmt(s[k])}</b>
                <small>{desc}</small>
              </div>
            ))}
          </div>
          {b.resultado <= 0 && <p className="ms-falta">Sin ganancia no hay nada para repartir en "Mi ganancia" ni en "Mi reinversión". <b>No retires dinero de los costos</b>: es lo que te permite volver a la próxima feria.</p>}
          <p className="ms-note"><b>Sueldo no es ganancia.</b> Tu sueldo paga tu trabajo; la ganancia es lo que el negocio genera además.</p>
        </section>
      )}

      {/* Guardar y PDF */}
      <section className="kf-card ms-mod ms-save" aria-labelledby="ms-h5">
        <h3 className="ms-h" id="ms-h5">Guardar esta jornada</h3>
        <div className="ms-g2">
          <label className="kf-field"><span>Nombre de la feria</span><input type="text" value={nombre} maxLength={80} placeholder="Ej.: Feria de la plaza" onChange={e => setNombre(e.target.value)} /></label>
          <label className="kf-field"><span>Fecha</span><input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></label>
        </div>
        <div className="ms-actions">
          <button type="button" className="kf-btn kf-btn--coral" onClick={guardar}>{editando ? 'Guardar cambios' : 'Guardar en mi historial'}</button>
          <button type="button" className="kf-btn kf-btn--soft" onClick={pdfActual} disabled={!mostrarResultado}>Descargar resumen en PDF</button>
        </div>
        {aviso && <p className="ms-aviso" role="status">{aviso}</p>}
        <p className="kf-muted ms-pdf-hint">Para el PDF, en la ventana de impresión elegí "Guardar como PDF".</p>
      </section>

      {/* Historial */}
      <section className="kf-card ms-mod" aria-labelledby="ms-h6">
        <h3 className="ms-h" id="ms-h6">Historial de ferias</h3>
        {hist.length === 0 ? <p className="kf-muted">Todavía no guardaste jornadas. Cuando guardes la primera, la vas a ver acá.</p> : (
          <ul className="ms-hist">
            {hist.map(h => {
              const sm = h.r.semaforo && SEMAFORO[h.r.semaforo];
              return (
                <li key={h.id} className={editId === h.id ? 'on' : ''}>
                  <span className={`ms-dot ms-sem--${sm ? sm[0] : 'none'}`} aria-label={h.r.semaforo ? `Semáforo ${h.r.semaforo}` : ''} />
                  <div className="ms-hist-t"><b>{h.nombre}</b><small>{fechaTxt(h.fecha)} · vendiste {fmt(h.r.ventas)}</small></div>
                  <div className="ms-hist-n"><b className={h.r.resultado < 0 ? 'neg' : 'pos'}>{fmt(h.r.resultado)}</b><small>margen {pct(h.r.margen)}</small></div>
                  <div className="ms-hist-a">
                    <button type="button" className="kf-link-inline" onClick={() => abrir(h)}>Ver y editar</button>
                    <button type="button" className="kf-link-inline" onClick={() => pdfDe(h)}>PDF</button>
                    <button type="button" className="kf-link-inline ms-del" onClick={() => borrar(h)} aria-label={`Borrar ${h.nombre}`}>Borrar</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {isPro && hist.length > 0 && (
          <div className="ms-pro">
            <p className="ms-sub">Comparación y acumulado por mes · PRO</p>
            {mejor && <p className="kf-muted">La más rentable: <b>{mejor.nombre}</b>, con {pct(mejor.r.margen)} de margen.</p>}
            <div className="ms-table-wrap">
              <table className="ms-table">
                <thead><tr><th>Mes</th><th>Ferias</th><th>Vendido</th><th>Costos y gastos</th><th>Tu sueldo</th><th>Ganancia</th></tr></thead>
                <tbody>{meses.map(m => (
                  <tr key={m.mes}><td>{mesTxt(m.mes)}</td><td>{m.ferias}</td><td>{fmt(m.ventas)}</td><td>{fmt(m.costos)}</td><td>{fmt(m.sueldo)}</td><td className={m.ganancia < 0 ? 'neg' : ''}>{fmt(m.ganancia)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}
        {!isPro && hist.length > 1 && (
          <p className="kf-tip kf-tip--celeste ms-pro-teaser"><span><strong>Con PRO</strong> comparás tus ferias y ves el acumulado de cada mes: ventas, costos, sueldo y ganancia. <a href="/pro/">Conocé PRO</a>.</span></p>
        )}
      </section>
      <Imprimible data={printData} />
    </div>
  );
}
