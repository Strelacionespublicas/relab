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
