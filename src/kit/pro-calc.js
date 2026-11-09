// Cuentas de Kit Feriante PRO (funciones puras, con pruebas en tests/unit/pro-calc.test.js).
// Los datos PRO guardan números ya interpretados (la validación pasa por readField al cargar).
//
// Stock: libro de movimientos. Existencias iniciales, reposiciones y ajustes son registros 'stock'
// (cantidad con signo); cada venta es una salida. Stock = Σ movimientos − Σ unidades vendidas.
// Así editar o borrar una venta corrige el stock solo, y dos celulares vendiendo a la vez no se pisan.

const n = v => (Number.isFinite(v) ? v : 0);
const sameVar = (a, b) => (a ?? null) === (b ?? null);

export function ventaTotales(venta, comisiones = {}) {
  const items = venta?.items || [];
  const subtotal = items.reduce((s, it) => s + n(it.cant) * n(it.precio), 0);
  const d = venta?.descuento;
  let descuento = 0;
  if (d && n(d.valor) > 0) descuento = d.tipo === 'pct' ? subtotal * Math.min(n(d.valor), 100) / 100 : Math.min(n(d.valor), subtotal);
  const total = subtotal - descuento;
  const tasa = n(comisiones[venta?.medio]);
  const comision = total * tasa / 100;
  const costo = items.reduce((s, it) => s + n(it.cant) * n(it.costo), 0);
  const unidades = items.reduce((s, it) => s + n(it.cant), 0);
  return { subtotal, descuento, total, tasa, comision, neto: total - comision, costo, unidades };
}

// Stock de un producto. Con varianteId === undefined suma todas sus variantes.
export function stockDe(productoId, varianteId, { movimientos = [], ventas = [] }) {
  const match = (pid, vid) => pid === productoId && (varianteId === undefined || sameVar(vid, varianteId));
  const entra = movimientos.reduce((s, m) => s + (match(m.productoId, m.varianteId) ? n(m.cant) : 0), 0);
  const sale = ventas.reduce((s, v) => s + (v.items || []).reduce((t, it) => t + (match(it.productoId, it.varianteId) ? n(it.cant) : 0), 0), 0);
  return entra - sale;
}

// ¿Lleva control de stock? Solo si alguna vez se cargaron existencias (si no, no se avisa nada).
export const controlaStock = (productoId, movimientos = []) => movimientos.some(m => m.productoId === productoId);

export function stockBajo(producto, actual) {
  return Number.isFinite(producto?.stockMin) && producto.stockMin > 0 && actual <= producto.stockMin;
}

export function resumenVentas(ventas, comisiones = {}) {
  const r = { ventas: 0, unidades: 0, total: 0, descuentos: 0, comisiones: 0, neto: 0, costo: 0, porMedio: {} };
  for (const v of ventas) {
    const t = ventaTotales(v, comisiones);
    r.ventas++;
    r.unidades += t.unidades;
    r.total += t.total;
    r.descuentos += t.descuento;
    r.comisiones += t.comision;
    r.neto += t.neto;
    r.costo += t.costo;
    const m = (r.porMedio[v.medio] ||= { total: 0, ventas: 0 });
    m.total += t.total;
    m.ventas++;
  }
  return r;
}

export const gastosFeria = feria => (feria?.gastos || []).reduce((s, g) => s + n(g.monto), 0);

// Resultado de una feria: lo cobrado neto de comisiones, menos la mercadería vendida y los gastos.
export function resumenFeria(feria, ventas, comisiones = {}) {
  const r = resumenVentas(ventas, comisiones);
  const gastos = gastosFeria(feria);
  return { ...r, gastos, resultado: r.neto - r.costo - gastos };
}

// ---- Resumen del negocio (pantalla "Resumen") ----
const enRango = (ts, desde, hasta) => (desde == null || ts >= desde) && (hasta == null || ts < hasta);
const diaMs = k => (k ? new Date(`${k}T12:00:00`).getTime() : null);

/**
 * Resumen de todas las ferias en un período [desde, hasta) (ms; null = sin límite).
 * Cuenta las ventas del período; los gastos de una feria cuentan si la feria empieza en el período
 * o si tiene ventas en él. Devuelve los totales, el detalle por feria y las ventas sin feria.
 */
export function resumenNegocio({ ferias = [], ventas = [], comisiones = {} }, { desde = null, hasta = null } = {}) {
  const vs = ventas.filter(v => enRango(v.ts, desde, hasta));
  const conVentas = new Set(vs.map(v => v.feriaId).filter(Boolean));
  const fs = ferias.filter(f => conVentas.has(f.id) || enRango(diaMs(f.desde) ?? -1, desde, hasta));
  const porFeria = fs.map(f => ({ id: f.id, nombre: f.nombre, desde: f.desde, ...resumenFeria(f, vs.filter(v => v.feriaId === f.id), comisiones) }))
    .sort((a, b) => b.resultado - a.resultado);
  const sinFeria = vs.filter(v => !v.feriaId || !fs.some(f => f.id === v.feriaId));
  const r = resumenVentas(vs, comisiones);
  const gastos = fs.reduce((s, f) => s + gastosFeria(f), 0);
  return {
    ...r,
    gastos,
    resultado: r.neto - r.costo - gastos,
    ticket: r.ventas ? r.total / r.ventas : 0,
    porFeria,
    sinFeria: sinFeria.length ? resumenVentas(sinFeria, comisiones) : null,
  };
}

// Productos más vendidos por ingresos. El descuento de una venta se reparte entre sus ítems según su peso.
export function topProductos(ventas, n = 5) {
  const m = new Map();
  for (const v of ventas) {
    const t = ventaTotales(v);
    const factor = t.subtotal ? t.total / t.subtotal : 0;
    for (const it of v.items || []) {
      const key = it.productoId || it.nombre;
      const nombre = String(it.nombre || '').replace(/ \(.*\)$/, '');
      const p = m.get(key) || { id: key, nombre, unidades: 0, ingresos: 0, costo: 0 };
      p.unidades += n_(it.cant);
      p.ingresos += n_(it.cant) * n_(it.precio) * factor;
      p.costo += n_(it.cant) * n_(it.costo);
      m.set(key, p);
    }
  }
  const lista = [...m.values()].map(p => ({ ...p, margen: p.ingresos > 0 ? (p.ingresos - p.costo) / p.ingresos : 0 }))
    .sort((a, b) => b.ingresos - a.ingresos);
  const conCosto = lista.filter(p => p.costo > 0 && p.ingresos > 0);
  return { top: lista.slice(0, n), mejorMargen: conCosto.sort((a, b) => b.margen - a.margen)[0] || null };
}
const n_ = v => (Number.isFinite(v) ? v : 0);

// Inicio de los períodos del Resumen (hora local).
export function periodo(id, now = new Date()) {
  const y = now.getFullYear();
  const mth = now.getMonth();
  if (id === 'mes') return { desde: new Date(y, mth, 1).getTime(), hasta: null };
  if (id === '3m') return { desde: new Date(y, mth - 2, 1).getTime(), hasta: null };
  if (id === 'anio') return { desde: new Date(y, 0, 1).getTime(), hasta: null };
  return { desde: null, hasta: null };
}
