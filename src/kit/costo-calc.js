// "Costo y precio": cuánto te cuesta hacer un lote, cuánto cuesta cada unidad y qué precio necesitás.
// Funciones puras (sin React). Pruebas: tests/unit/costo-calc.test.js. Los campos guardan el texto tal
// cual lo escribió la persona (formato argentino) y se interpretan acá con readField de calc.js.
//
// Reglas:
//  - Materia prima: cuenta solo lo que usaste en el lote. Si compraste 2 kg a $40.000 y usaste 1 kg,
//    al lote van $20.000 (precio pagado / cantidad comprada × cantidad usada).
//  - Costo de producción del lote = materiales + envases + packaging + tu mano de obra (horas × valor
//    de tu hora) + la parte de los gastos del taller que le toca al lote (indirectos).
//  - Costo por unidad = costo del lote / unidades que salieron bien (la merma queda absorbida).
//  - Costo comercial por unidad (opcional) = gastos de participar en la feria / unidades que pensás
//    vender en ella (de TODOS tus productos, para no cargar el gasto entero a cada uno).
//  - Precio por margen (sobre el precio de venta): costo / (1 − margen − comisión).
//    Precio por recargo (sobre el costo): costo × (1 + recargo) / (1 − comisión).
//  - A la Calculadora y a Mis productos va el costo de PRODUCCIÓN por unidad, no el integral: los
//    gastos de la feria se cargan aparte en cada feria y, si no, se contarían dos veces.
// Los cálculos no se redondean; el redondeo es solo al mostrar.
import { MSG, readField } from './calc.js';

export const MAX_RECETAS = 30;
export const MAX_INSUMOS = 20;
// Campos de texto de una receta (claves guardadas: no cambiarlas).
export const CAMPOS = ['nombre', 'envases', 'pack', 'moHoras', 'moValor', 'indMes', 'indPct', 'unidades', 'gFeria', 'uFeria', 'metodo', 'pct', 'com', 'precio'];

/**
 * Cuentas de una receta. `r` es la receta tal cual (texto); `valorHoraSug` el valor de la hora de
 * Mi sueldo (se usa si no escribió uno). Devuelve { ok, errors, lote, unidad, precio }.
 */
export function calcCosto(r = {}, { valorHoraSug = null } = {}) {
  const errors = {};
  const field = (k, v, opts) => {
    const x = readField(v, opts);
    if (x.error) errors[k] = x.error;
    return x.value;
  };

  // 1. Materiales: lo usado de cada compra
  const insumos = (r.insumos || []).map(i => {
    const pagado = field(`ins.${i.id}.pagado`, i.pagado);
    const compra = field(`ins.${i.id}.compra`, i.compra);
    const usado = field(`ins.${i.id}.usado`, i.usado);
    let costo = pagado;
    if (compra > 0 && usado > 0) {
      if (usado > compra) errors[`ins.${i.id}.usado`] = 'Usaste más de lo que compraste: revisá las cantidades.';
      costo = (pagado / compra) * usado;
    } else if (usado > 0 && !(compra > 0)) {
      errors[`ins.${i.id}.compra`] = 'Poné cuánto compraste para calcular lo que usaste.';
    }
    return { id: i.id, nombre: i.nombre, costo, parcial: compra > 0 && usado > 0 && usado < compra };
  });
  const materiales = insumos.reduce((a, i) => a + i.costo, 0);

  // 2. Envases, packaging, mano de obra e indirectos (todo del lote)
  const envases = field('envases', r.envases);
  const pack = field('pack', r.pack);
  const moHoras = field('moHoras', r.moHoras);
  const valorPropio = r.moValor !== undefined && String(r.moValor).trim() !== '';
  const moValor = valorPropio ? field('moValor', r.moValor) : (Number.isFinite(valorHoraSug) && valorHoraSug > 0 ? valorHoraSug : 0);
  const mo = moHoras * moValor;
  const indMes = field('indMes', r.indMes);
  const indPct = field('indPct', r.indPct, { percent: true });
  const indirectos = indMes * indPct / 100;
  const costoLote = materiales + envases + pack + mo + indirectos;

  // 3. Por unidad
  const unidades = field('unidades', r.unidades);
  const costoUnit = unidades > 0 ? costoLote / unidades : null;

  // 4. Precio
  const gFeria = field('gFeria', r.gFeria);
  const uFeria = field('uFeria', r.uFeria);
  if (gFeria > 0 && !(uFeria > 0)) errors.uFeria = 'Poné cuántas unidades pensás vender en la feria.';
  const comercialUnit = gFeria > 0 && uFeria > 0 ? gFeria / uFeria : 0;
  const integral = costoUnit != null ? costoUnit + comercialUnit : null;
  const metodo = r.metodo === 'recargo' ? 'recargo' : 'margen';
  const pct = field('pct', r.pct, metodo === 'margen' ? { percent: true } : {}) / 100;
  const com = field('com', r.com, { percent: true }) / 100;
  let sugerido = null;
  if (metodo === 'margen' && pct + com >= 1) errors.pct = 'El margen más la comisión tienen que sumar menos de 100%.';
  else if (metodo === 'recargo' && com >= 1) errors.com = MSG.percent;
  else if (integral != null && integral > 0) sugerido = metodo === 'margen' ? integral / (1 - pct - com) : integral * (1 + pct) / (1 - com);

  const precioEscrito = r.precio !== undefined && String(r.precio).trim() !== '';
  const final = precioEscrito ? field('precio', r.precio) : sugerido;
  const neto = final != null ? final * (1 - com) : null; // lo que te queda después de la comisión
  const ganUnit = final != null && integral != null ? neto - integral : null;
  const margenReal = final > 0 && ganUnit != null ? ganUnit / final : null;
  const recargoReal = integral > 0 && ganUnit != null ? ganUnit / integral : null;

  return {
    ok: Object.keys(errors).length === 0, errors,
    lote: { insumos, materiales, envases, pack, moHoras, moValor, valorPropio, mo, indMes, indPct, indirectos, costoLote },
    unidad: { unidades, costoUnit, gFeria, uFeria, comercialUnit, integral },
    precio: { metodo, pct, com, sugerido, redondeado: sugerido != null ? redondear(sugerido) : null, precioEscrito, final, neto, ganUnit, margenReal, recargoReal },
  };
}

/** Redondea para arriba a un precio "de feria": a $50 hasta $5.000, a $100 hasta $50.000 y a $500 desde ahí. */
export function redondear(p) {
  if (!(p > 0)) return 0;
  const paso = p < 5000 ? 50 : p < 50000 ? 100 : 500;
  return Math.ceil(p / paso - 1e-9) * paso;
}

/** Receta en blanco (texto vacío: los campos sin tocar no cuentan). */
export const blankReceta = id => ({ id, nombre: '', insumos: [{ id: `${id}-1`, nombre: '', pagado: '', compra: '', usado: '' }], metodo: 'margen', pct: '', com: '' });

/**
 * Lleva una receta a la Calculadora: actualiza el producto con el mismo nombre (sin importar
 * mayúsculas) o usa la primera fila vacía, o agrega una. Va el costo de producción por unidad.
 */
export function aCalculadora(productos, { nombre, costoUnit, precio }, newId) {
  const n = String(nombre || '').trim();
  const fila = { nombre: n || 'Producto', costo: String(Math.round(costoUnit * 100) / 100).replace('.', ','), precio: String(Math.round(precio)) };
  const key = n.toLowerCase();
  const i = key ? productos.findIndex(p => String(p.nombre || '').trim().toLowerCase() === key) : -1;
  if (i >= 0) return productos.map((p, j) => (j === i ? { ...p, ...fila } : p));
  const vacia = productos.findIndex(p => !p.nombre && !p.costo && !p.precio && !p.unid);
  if (vacia >= 0) return productos.map((p, j) => (j === vacia ? { ...p, ...fila } : p));
  return [...productos, { id: newId(), unid: '', ...fila }];
}
