// Números en formato argentino y cuentas del Kit del emprendedor feriante. Funciones puras (sin
// React) para poder probarlas: tests/unit/kit-calc.test.js. Los campos del kit guardan el texto tal
// cual lo escribió la persona; acá se interpreta cada vez que se calcula.

const SIGN = /^[-−–]/;

// Separadores de miles bien agrupados: "1.500", "120.000", "1.500.000" (o con coma si el decimal es punto).
const grouped = (int, sep) => new RegExp(`^\\d{1,3}(\\${sep}\\d{3})+$`).test(int);
const plainInt = int => /^\d*$/.test(int);

/**
 * Lee un importe o cantidad como lo escribe una persona en Argentina.
 *   "120.000" → 120000 · "1.500,50" → 1500.5 · "1500,50" → 1500.5 · "$5000" → 5000 · "12 000" → 12000
 * También acepta lo que ya admitía el kit: "2.99", "3.5", "0,5", "1,500.50" (miles con coma y decimal con punto).
 * Un solo punto seguido de exactamente tres cifras se lee como separador de miles ("1.500" → 1500),
 * salvo que la parte entera sea 0 ("0.500" → 0.5).
 * Devuelve { ok: true, value } (value null si está vacío) o { ok: false } si no es un número.
 */
export function parseNumber(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? { ok: true, value: input } : { ok: false };
  let s = String(input ?? '').replace(/[\s  ]/g, '');
  if (s === '') return { ok: true, value: null };
  let neg = false;
  if (SIGN.test(s)) { neg = true; s = s.slice(1); }
  if (s.startsWith('$')) s = s.slice(1);
  if (!neg && SIGN.test(s)) { neg = true; s = s.slice(1); }
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return { ok: false };

  const dot = s.lastIndexOf('.');
  const comma = s.lastIndexOf(',');
  let int;
  let frac = '';
  if (dot >= 0 && comma >= 0) {
    // Los dos separadores: el último es el decimal y el otro tiene que agrupar de a tres.
    const dec = dot > comma ? '.' : ',';
    const thou = dec === '.' ? ',' : '.';
    const parts = s.split(dec);
    if (parts.length !== 2 || !grouped(parts[0], thou)) return { ok: false };
    int = parts[0].split(thou).join('');
    frac = parts[1];
  } else if (comma >= 0) {
    // Solo coma: siempre es el decimal, como en la versión anterior ("1500,5").
    const parts = s.split(',');
    if (parts.length !== 2 || !plainInt(parts[0])) return { ok: false };
    [int, frac] = parts;
  } else if (dot >= 0) {
    const parts = s.split('.');
    if (grouped(s, '.') && !/^0\./.test(s)) int = parts.join('');
    else if (parts.length === 2 && plainInt(parts[0])) [int, frac] = parts;
    else return { ok: false };
  } else {
    int = s;
  }
  if (!/^\d*$/.test(frac)) return { ok: false };
  const value = Number(`${int || '0'}.${frac || '0'}`);
  if (!Number.isFinite(value)) return { ok: false };
  return { ok: true, value: neg && value !== 0 ? -value : value };
}

/** Número para cuentas internas: vacío o inválido da 0. Usar `readField` cuando hay que avisar. */
export const num = v => {
  const r = parseNumber(v);
  return r.ok && r.value != null ? r.value : 0;
};

export const MSG = {
  invalid: 'Escribí solo números, por ejemplo 12.000 o 1.500,50.',
  negative: 'No puede ser negativo.',
  positive: 'Tiene que ser mayor a 0.',
  percent: 'Tiene que estar entre 0 y 100.',
};

/**
 * Valida un campo. Vacío vale 0 (o `fallback`) y no es error, salvo `required`.
 * Opciones: positive (mayor a 0), percent (entre 0 y 100), required.
 * Devuelve { value, error } con error null si está bien.
 */
export function readField(v, { positive = false, percent = false, required = false, fallback = 0 } = {}) {
  const r = parseNumber(v);
  if (!r.ok) return { value: fallback, error: MSG.invalid };
  if (r.value == null) return { value: fallback, error: required ? (positive ? MSG.positive : MSG.invalid) : null };
  if (r.value < 0) return { value: fallback, error: MSG.negative };
  if (positive && r.value === 0) return { value: fallback, error: MSG.positive };
  if (percent && r.value > 100) return { value: fallback, error: MSG.percent };
  return { value: r.value, error: null };
}

export const fmt = n => (n < 0 ? '−$' : '$') + Math.round(Math.abs(n)).toLocaleString('es-AR');

/**
 * Calculadora: resultado estimado de la feria.
 *   ingresos = Σ precio × unidades · costo de lo vendido = Σ costo × unidades
 *   comisiones = ingresos × %digital × %comisión · ganancia = ingresos − costo vendido − fijos − comisiones
 *   equilibrio = ⌈fijos / (precio promedio − costo promedio − precio promedio × %digital × %comisión)⌉
 * `errors` usa claves como "fijos.alquiler", "comision" o "prod.<id>.precio". Con errores, `ok` es false
 * y no hay que mostrar el resultado (los valores inválidos no cuentan como 0 en silencio).
 */
export function calcFeria(calc, fijoKeys) {
  const errors = {};
  const field = (key, v, opts) => {
    const r = readField(v, opts);
    if (r.error) errors[key] = r.error;
    return r.value;
  };
  const fijos = fijoKeys.reduce((a, k) => a + field(`fijos.${k}`, calc.fijos?.[k]), 0);
  const cp = field('comision', calc.comision, { percent: true }) / 100;
  const pd = field('pctDigital', calc.pctDigital, { percent: true }) / 100;
  let ing = 0;
  let cv = 0;
  let unid = 0;
  for (const p of calc.productos || []) {
    const precio = field(`prod.${p.id}.precio`, p.precio);
    const costo = field(`prod.${p.id}.costo`, p.costo);
    const u = field(`prod.${p.id}.unid`, p.unid);
    ing += precio * u;
    cv += costo * u;
    unid += u;
  }
  const com = ing * pd * cp;
  const gan = ing - cv - fijos - com;
  const margen = ing > 0 ? Math.round((gan / ing) * 100) : 0;
  const pProm = unid > 0 ? ing / unid : 0;
  const mu = unid > 0 ? pProm - cv / unid - pProm * pd * cp : 0;
  const eq = mu > 0 ? Math.ceil(fijos / mu) : null;
  return { ok: Object.keys(errors).length === 0, errors, fijos, ing, cv, com, gan, margen, unid, pProm, eq };
}

/**
 * ROI post feria.
 *   ventas brutas = efectivo + digital · ingreso neto = brutas − comisiones
 *   costos = stand + traslado + mercadería vendida + otros · ganancia = neto − costos
 *   ROI = ganancia / costos (sin costos no hay ROI) · venta por día = brutas / días
 *   % del objetivo = brutas / objetivo (el objetivo se fija sobre lo vendido, antes de comisiones)
 * Decisión: 'sinCostos' | 'go' (ganancia y ROI ≥ 20%) | 'maybe' (ganancia con ROI < 20%) | 'no' (pérdida).
 */
export function calcRoi(roi) {
  const errors = {};
  const field = (key, opts) => {
    const r = readField(roi?.[key], opts);
    if (r.error) errors[key] = r.error;
    return r.value;
  };
  const ef = field('ef');
  const dig = field('dig');
  const com = field('com');
  const costo = field('stand') + field('tras') + field('ins') + field('otros');
  const cont = field('cont');
  const seg = field('seg');
  const dias = field('dias', { positive: true, fallback: 1 });
  const obj = field('obj');
  const bruto = ef + dig;
  const ing = bruto - com;
  const gan = ing - costo;
  const pctRoi = costo > 0 ? Math.round((gan / costo) * 100) : null;
  const pctObj = obj > 0 ? Math.round((bruto / obj) * 100) : null;
  const show = bruto > 0 || com > 0 || costo > 0;
  let decision = null;
  if (show) decision = costo === 0 ? 'sinCostos' : gan > 0 && pctRoi >= 20 ? 'go' : gan > 0 ? 'maybe' : 'no';
  return {
    ok: Object.keys(errors).length === 0, errors, show,
    ef, dig, com, bruto, ing, costo, gan, cont, seg, dias, obj, pctRoi, pctObj, decision,
    ventaDia: bruto / dias,
    costoContacto: cont > 0 && costo > 0 ? costo / cont : null,
  };
}

/** Monto de una venta: obligatorio y mayor a 0. Devuelve { value, error }. */
export const readMonto = v => readField(v, { positive: true, required: true });

/** Monto para el CSV: sin separador de miles y con coma decimal, sin perder centavos. */
export const csvMonto = n => String(Math.round(n * 100) / 100).replace('.', ',');
