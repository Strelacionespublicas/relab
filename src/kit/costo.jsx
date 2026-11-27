// "Costo y precio" (herramienta gratis del Kit, momento "Antes de la feria").
// Cuentas en ./costo-calc.js. Se guarda en el estado del kit bajo `costos` ({ recetas, activa }) y viaja
// con la cuenta como el resto (src/kit/sync.js). Cada receta es un producto: sus materiales, el lote y
// el precio. El valor de tu hora sale de Mi sueldo si no escribís otro.
import { useMemo, useState } from 'react';
import { fmt } from './calc.js';
import { MAX_INSUMOS, MAX_RECETAS, aCalculadora, blankReceta, calcCosto } from './costo-calc.js';
import { EJEMPLO_COSTO } from './costo-ejemplo.js';
import { newId } from './state.js';
import { calcSueldo, sugerencias } from './sueldo-calc.js';

const pct = x => (x == null ? '—' : `${String(Math.round(x * 1000) / 10).replace('.', ',')}%`);
const unit = n => (n == null ? '—' : n < 100 ? `$${(Math.round(n * 100) / 100).toLocaleString('es-AR')}` : fmt(n));

function Num({ label, value, onChange, error, suffix = '$', hint, placeholder = '0' }) {
  return (
    <label className="kf-field">
      <span>{label}</span>
      <span className="kf-input-wrap">
        <input type="text" inputMode="decimal" value={value ?? ''} placeholder={placeholder} onChange={e => onChange(e.target.value)} aria-invalid={error ? true : undefined} />
        {suffix && <em>{suffix}</em>}
      </span>
      {error ? <small className="kf-err" role="alert">{error}</small> : hint && <small>{hint}</small>}
    </label>
  );
}
const Dato = ({ label, value, hi, tone }) => <div className={hi ? 'hi' : ''}><span>{label}</span><b className={tone || ''}>{value}</b></div>;

export function CostoPrecio({ st, set, openTab }) {
  const { recetas, activa } = st.costos;
  const cur = recetas.find(r => r.id === activa) || (activa == null ? recetas[0] : null) || null;
  const [tmpId] = useState(newId);
  const rec = cur || blankReceta(tmpId);
  const hora = useMemo(() => {
    const s = calcSueldo(st.sueldo.f, sugerencias({ roi: st.roi, ventas: st.ventas }));
    return s.jornada.valorHora > 0 ? s.jornada.valorHora : s.hora.valorHora;
  }, [st.sueldo.f, st.roi, st.ventas]);
  const r = calcCosto(rec, { valorHoraSug: hora });
  const { lote: l, unidad: u, precio: p, errors } = r;
  const [aviso, setAviso] = useState('');

  // Guardar un cambio: si la receta todavía no existe, se crea con el primer cambio.
  const edit = fn => {
    setAviso('');
    set('costos', c => {
      const ex = c.recetas.find(x => x.id === rec.id);
      if (!ex && c.recetas.length >= MAX_RECETAS) return c;
      const nueva = fn(ex || rec);
      return { activa: rec.id, recetas: ex ? c.recetas.map(x => (x.id === rec.id ? nueva : x)) : [...c.recetas, nueva] };
    });
  };
  const upd = (k, v) => edit(x => ({ ...x, [k]: v }));
  const updIns = (id, k, v) => edit(x => ({ ...x, insumos: x.insumos.map(i => (i.id === id ? { ...i, [k]: v } : i)) }));
  const addIns = () => edit(x => ({ ...x, insumos: [...x.insumos, { id: newId(), nombre: '', pagado: '', compra: '', usado: '' }].slice(0, MAX_INSUMOS) }));
  const delIns = id => edit(x => ({ ...x, insumos: x.insumos.length > 1 ? x.insumos.filter(i => i.id !== id) : [{ id: newId(), nombre: '', pagado: '', compra: '', usado: '' }] }));

  const lleno = recetas.length >= MAX_RECETAS;
  const nueva = () => {
    if (lleno) { setAviso(`Llegaste a ${MAX_RECETAS} productos. Borrá alguno para sumar otro.`); return; }
    const id = newId();
    set('costos', c => ({ activa: id, recetas: [...c.recetas, blankReceta(id)] }));
  };
  const ejemplo = () => {
    if (lleno) { setAviso(`Llegaste a ${MAX_RECETAS} productos. Borrá alguno para ver el ejemplo.`); return; }
    const id = newId();
    set('costos', c => ({ activa: id, recetas: [...c.recetas, EJEMPLO_COSTO(id)] }));
  };
  const borrar = () => {
    if (!cur || !window.confirm(`¿Borrar "${cur.nombre || 'este producto'}" de Costo y precio?`)) return;
    set('costos', c => { const rest = c.recetas.filter(x => x.id !== cur.id); return { recetas: rest, activa: rest[0]?.id ?? null }; });
  };
  const precioFinal = p.final;
  const aCalc = () => {
    if (!r.ok || u.costoUnit == null || !(precioFinal > 0)) return;
    set('calc', c => ({ ...c, productos: aCalculadora(c.productos, { nombre: rec.nombre, costoUnit: u.costoUnit, precio: precioFinal }, newId) }));
    setAviso(`✓ "${rec.nombre || 'Producto'}" quedó en la Calculadora con costo ${unit(u.costoUnit)} y precio ${fmt(precioFinal)}.`);
  };

  const ins = rec.insumos || [];
  const listo = r.ok && u.costoUnit != null;
  return (
    <div className="ms cp">
      <div className="ms-top">
        {recetas.length > 0 && (
          <label className="cp-sel">
            <select aria-label="Producto" value={cur?.id || ''} onChange={e => set('costos', c => ({ ...c, activa: e.target.value || null }))}>
              {!cur && <option value="">Nuevo producto</option>}
              {recetas.map(x => <option key={x.id} value={x.id}>{x.nombre || 'Sin nombre'}</option>)}
            </select>
          </label>
        )}
        {cur && <button type="button" className="kf-btn kf-btn--soft kf-btn--sm" onClick={nueva}>+ Otro producto</button>}
        <button type="button" className="kf-btn kf-btn--soft kf-btn--sm" onClick={ejemplo}>Ver ejemplo</button>
        {cur && <button type="button" className="kf-btn kf-btn--ghost kf-btn--sm" onClick={borrar}>Borrar</button>}
      </div>
      {aviso && !aviso.startsWith('✓') && <p className="kf-err" role="alert">{aviso}</p>}

      <section className="kf-card ms-mod" aria-labelledby="cp-h1">
        <h3 className="ms-h" id="cp-h1"><span>1</span>¿Qué usaste para hacer el lote?</h3>
        <label className="kf-field"><span>Producto</span><input type="text" value={rec.nombre} onChange={e => upd('nombre', e.target.value)} placeholder="Ej.: vela de soja" maxLength={80} /></label>
        <p className="ms-note">Cargá <b>solo lo que usaste</b> en este lote. Si compraste 2 kg de cera y usaste 1 kg, poné lo que pagaste, cuánto compraste y cuánto usaste: el kit calcula la parte que va al lote.</p>
        <div className="cp-ins">
          <div className="cp-ins-row cp-ins-head" aria-hidden="true"><span className="cp-ins-n">Material</span><span>Pagaste</span><span>Compraste</span><span>Usaste</span><span /></div>
          {ins.map((i, n) => {
            const c = l.insumos.find(x => x.id === i.id);
            const err = errors[`ins.${i.id}.pagado`] || errors[`ins.${i.id}.compra`] || errors[`ins.${i.id}.usado`];
            return (
              <div key={i.id} className="cp-ins-row">
                <input type="text" className="cp-ins-n" aria-label={`Material ${n + 1}`} value={i.nombre} onChange={e => updIns(i.id, 'nombre', e.target.value)} placeholder="Material (cera, tela, lana…)" maxLength={60} />
                <span className="kf-input-wrap"><em className="pre">$</em><input type="text" inputMode="decimal" aria-label="Lo que pagaste" value={i.pagado} onChange={e => updIns(i.id, 'pagado', e.target.value)} placeholder="0" aria-invalid={errors[`ins.${i.id}.pagado`] ? true : undefined} /></span>
                <input type="text" inputMode="decimal" aria-label="Cuánto compraste" value={i.compra} onChange={e => updIns(i.id, 'compra', e.target.value)} placeholder="—" aria-invalid={errors[`ins.${i.id}.compra`] ? true : undefined} />
                <input type="text" inputMode="decimal" aria-label="Cuánto usaste" value={i.usado} onChange={e => updIns(i.id, 'usado', e.target.value)} placeholder="—" aria-invalid={errors[`ins.${i.id}.usado`] ? true : undefined} />
                <button type="button" className="kf-x" aria-label={`Quitar ${i.nombre || 'material'}`} onClick={() => delIns(i.id)}>×</button>
                {err ? <small className="kf-err cp-ins-msg" role="alert">{err}</small>
                  : c?.parcial ? <small className="cp-ins-msg">Al lote van <b>{fmt(c.costo)}</b> (lo que usaste).</small> : null}
              </div>
            );
          })}
        </div>
        <p className="cp-help">Cantidades en la misma unidad (g, ml, metros, unidades). Si usaste todo lo que compraste, dejá esas dos vacías.</p>
        {ins.length < MAX_INSUMOS && <p className="cp-add"><button type="button" className="kf-link" onClick={addIns}>+ Agregar material</button></p>}
        <div className="ms-g2">
          <Num label="Envases" value={rec.envases} onChange={v => upd('envases', v)} error={errors.envases} hint="Frascos, cajas, bolsas del lote." />
          <Num label="Packaging" value={rec.pack} onChange={v => upd('pack', v)} error={errors.pack} hint="Etiquetas, cintas, papel." />
        </div>
      </section>

      <section className="kf-card ms-mod" aria-labelledby="cp-h2">
        <h3 className="ms-h" id="cp-h2"><span>2</span>Tu trabajo y los gastos del taller</h3>
        <div className="ms-g2">
          <Num label="Horas que te llevó el lote" value={rec.moHoras} onChange={v => upd('moHoras', v)} error={errors.moHoras} suffix="h" />
          <Num label="Valor de tu hora" value={rec.moValor ?? ''} onChange={v => upd('moValor', v)} error={errors.moValor}
            placeholder={hora > 0 ? String(Math.round(hora)) : '0'}
            hint={l.valorPropio ? 'Lo escribiste a mano.' : hora > 0 ? 'Tomado de Mi sueldo. Podés cambiarlo.' : null} />
        </div>
        {!l.valorPropio && !(hora > 0) && <p className="kf-muted">¿No sabés cuánto vale tu hora? <button type="button" className="kf-link-inline" onClick={() => openTab('sueldo')}>Calculala en Mi sueldo</button>.</p>}
        <details className="ms-mo" open={!!(rec.indMes || rec.indPct)}>
          <summary>Sumar luz, gas, alquiler del taller o herramientas (opcional)</summary>
          <div className="ms-g2">
            <Num label="Gastos del taller por mes" value={rec.indMes} onChange={v => upd('indMes', v)} error={errors.indMes} hint="Luz, gas, agua, alquiler, mantenimiento y lo que separás para renovar herramientas." />
            <Num label="Parte que le toca a este lote" value={rec.indPct} onChange={v => upd('indPct', v)} error={errors.indPct} suffix="%" hint="Ej.: si en el mes hacés 10 lotes parecidos, poné 10%." />
          </div>
        </details>
        <div className="ms-out">
          <Dato label="Materiales" value={fmt(l.materiales)} />
          <Dato label="Tu mano de obra" value={fmt(l.mo)} />
          <Dato label="Envases, packaging y taller" value={fmt(l.envases + l.pack + l.indirectos)} />
        </div>
      </section>

      <section className="kf-card ms-mod" aria-labelledby="cp-h3">
        <h3 className="ms-h" id="cp-h3"><span>3</span>¿Cuánto te cuesta cada unidad?</h3>
        <Num label="Unidades que salieron bien" value={rec.unidades} onChange={v => upd('unidades', v)} error={errors.unidades} suffix="u." hint="Solo las que vas a vender: las falladas ya quedan dentro del costo." placeholder="Ej.: 20" />
        <div className="ms-out">
          <Dato label="Costo del lote" value={fmt(l.costoLote)} />
          <Dato label="Costo por unidad" value={unit(u.costoUnit)} hi />
        </div>
      </section>

      <section className="kf-card ms-mod" aria-labelledby="cp-h4">
        <h3 className="ms-h" id="cp-h4"><span>4</span>¿A cuánto lo vendo?</h3>
        <details className="ms-mo" open={!!(rec.gFeria || rec.uFeria)}>
          <summary>Sumar lo que te cuesta ir a la feria (recomendado)</summary>
          <div className="ms-g2">
            <Num label="Gastos de la feria" value={rec.gFeria} onChange={v => upd('gFeria', v)} error={errors.gFeria} hint="Stand, traslado, comida y tu sueldo de la jornada." />
            <Num label="Unidades que pensás vender" value={rec.uFeria} onChange={v => upd('uFeria', v)} error={errors.uFeria} suffix="u." hint="De todos tus productos juntos, así el gasto no se cuenta de más." />
          </div>
          {u.comercialUnit > 0 && <p className="kf-muted">Cada unidad tiene que cubrir <b>{unit(u.comercialUnit)}</b> de la feria. Costo integral: <b>{unit(u.integral)}</b>.</p>}
        </details>
        <div className="kf-seg" role="group" aria-label="Cómo calcular el precio">
          <button type="button" className={p.metodo === 'margen' ? 'on' : ''} onClick={() => upd('metodo', 'margen')}>Por margen</button>
          <button type="button" className={p.metodo === 'recargo' ? 'on' : ''} onClick={() => upd('metodo', 'recargo')}>Por recargo</button>
        </div>
        <p className="cp-help">{p.metodo === 'margen'
          ? <><b>Margen:</b> qué parte del precio de venta es ganancia. Con 30% de margen, de cada $100 que cobrás te quedan $30.</>
          : <><b>Recargo:</b> cuánto le sumás al costo. Con 30% de recargo, a un costo de $100 le sumás $30. No es lo mismo que el margen: el mismo 30% da un precio más bajo.</>}</p>
        <div className="ms-g2">
          <Num label={p.metodo === 'margen' ? 'Margen que querés' : 'Recargo que querés'} value={rec.pct} onChange={v => upd('pct', v)} error={errors.pct} suffix="%" placeholder="Ej.: 30" />
          <Num label="Comisión del cobro" value={rec.com} onChange={v => upd('com', v)} error={errors.com} suffix="%" hint="Si cobrás con QR o tarjeta. Mirá Cobros." />
        </div>
        {listo && p.sugerido != null && (
          <div className="ms-out">
            <Dato label="Precio sugerido" value={unit(p.sugerido)} hi />
            <Dato label="Redondeado" value={fmt(p.redondeado)} />
          </div>
        )}
        {listo && p.sugerido != null && !p.precioEscrito && p.redondeado !== Math.round(p.sugerido) && (
          <p className="kf-muted"><button type="button" className="kf-link-inline" onClick={() => upd('precio', String(p.redondeado))}>Usar {fmt(p.redondeado)} como precio final</button></p>
        )}
        {!listo && <p className="kf-muted">{u.costoUnit == null && r.ok ? 'Cargá las unidades del paso 3 para calcular el precio.' : 'Corregí los campos marcados para ver el precio.'}</p>}
        <Num label="Tu precio final" value={rec.precio ?? ''} onChange={v => upd('precio', v)} error={errors.precio}
          placeholder={p.sugerido != null ? String(Math.round(p.sugerido)) : '0'}
          hint={p.precioEscrito ? 'Lo escribiste a mano. Borralo para volver al sugerido.' : 'Vacío = el sugerido. Podés poner el que vas a usar en la feria.'} />
        {listo && precioFinal > 0 && (
          <>
            <div className="ms-out">
              <Dato label="Te queda por unidad" value={unit(p.ganUnit)} tone={p.ganUnit < 0 ? 'neg' : ''} hi />
              <Dato label="Margen real" value={pct(p.margenReal)} />
              <Dato label="Recargo real" value={pct(p.recargoReal)} />
            </div>
            {p.ganUnit < 0 && <p className="ms-falta" role="alert">Con este precio perdés {unit(-p.ganUnit)} por unidad: no cubre {u.comercialUnit > 0 ? 'el costo y lo que cuesta ir a la feria' : 'lo que te cuesta hacerlo'}.</p>}
            {p.precioEscrito && p.sugerido != null && p.ganUnit >= 0 && precioFinal < p.sugerido && <p className="kf-muted">Tu precio está por debajo del sugerido: ganás menos de lo que querías.</p>}
            <div className="ms-actions cp-act">
              <button type="button" className="kf-btn kf-btn--coral" onClick={aCalc}>Usar en la Calculadora</button>
            </div>
            <p className="cp-help">A la Calculadora va el costo de producción ({unit(u.costoUnit)}), no el integral: los gastos de la feria se cargan allá aparte, así no se cuentan dos veces.</p>
          </>
        )}
        {aviso.startsWith('✓') && <p className="ms-aviso" role="status">{aviso} <button type="button" className="kf-link-inline" onClick={() => openTab('calculadora')}>Ir a la Calculadora</button></p>}
      </section>
    </div>
  );
}
