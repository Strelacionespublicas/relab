// "Mi sueldo y rentabilidad": cuentas puras (sin React) para separar facturación, costos de lo
// vendido, gastos de participar, tu sueldo, la ganancia, la reposición y la reinversión.
// Pruebas: tests/unit/sueldo-calc.test.js. Los campos guardan el texto tal cual lo escribió la
// persona (formato argentino) y se interpretan acá con readField de calc.js.
//
// Regla para no contar dos veces: la mano de obra de producción (lo que te pagás por fabricar lo
// que vendiste) es un COSTO de lo vendido en el resultado, y a la vez es ingreso personal en el
// sobre "Mi sueldo". El sueldo de la jornada de feria es otra cosa: el tiempo de preparar, viajar,
// armar, atender y desarmar. Quien revende deja la mano de obra en 0.
import { readField } from './calc.js';

// Campos del formulario (clave guardada → para qué es). No cambiar las claves: se guardan.
export const HORA_KEYS = ['hSueldo', 'hDias', 'hHoras'];
export const JORNADA_KEYS = ['jPrep', 'jTras', 'jArmado', 'jVenta', 'jDesarmado', 'jOtras'];
export const COSTO_KEYS = ['cMp', 'cPack', 'cMo', 'cOtros'];
export const GASTO_KEYS = ['gTransp', 'gAlq', 'gAlim', 'gCom', 'gImp', 'gOtros'];
// Los que cambian con lo que vendés (para la facturación mínima). Transporte, alquiler, comida y
// otros gastos se pagan igual vendas o no; las comisiones y los impuestos van con cada venta.
const VARIABLES = ['cMp', 'cPack', 'cMo', 'cOtros', 'gCom', 'gImp'];
export const ALL_KEYS = [...HORA_KEYS, ...JORNADA_KEYS, 'jValor', 'jCant', 'bVentas', 'moHoras', ...COSTO_KEYS, ...GASTO_KEYS, 'reinv'];

export const REINV_DEFAULT = 30;

/**
 * Valores sugeridos a partir de lo que ya cargó en el kit, para no cargar dos veces.
 *  - Ventas: lo del ROI (efectivo + digital) si está; si no, el total de Ventas del día.
 *  - Mercadería, traslado, stand, comisiones y otros: los costos reales del ROI.
 *  - Cantidad de jornadas: la del ROI ("Días de feria"). Las horas por jornada del ROI van en
 *    `horasRoi` solo como referencia (no es un campo).
 * Solo se sugieren valores mayores a 0. Devuelve { campo: { value, from } }.
 */
export function sugerencias({ roi = {}, ventas = [] } = {}) {
  const out = {};
  const put = (k, v, from) => { if (Number.isFinite(v) && v > 0) out[k] = { value: v, from }; };
  const r = k => readField(roi[k]).value;
  const bruto = r('ef') + r('dig');
  const tracker = ventas.reduce((a, v) => a + (Number.isFinite(v.monto) ? v.monto : 0), 0);
  if (bruto > 0) put('bVentas', bruto, 'ROI post feria');
  else put('bVentas', tracker, 'Ventas del día');
  put('cMp', r('ins'), 'ROI post feria');
  put('gTransp', r('tras'), 'ROI post feria');
  put('gAlq', r('stand'), 'ROI post feria');
  put('gCom', r('com'), 'ROI post feria');
  put('gOtros', r('otros'), 'ROI post feria');
  // Las horas del ROI son la jornada completa (con armado y desarme), no solo la atención: no se
  // sugieren en ningún campo para no contarlas dos veces. Se muestran como referencia para repartirlas.
  const horasRoi = r('horas');
  if (horasRoi > 0) out.horasRoi = { value: horasRoi, from: 'ROI post feria' };
  const dias = readField(roi.dias, { positive: true, fallback: 1 }).value;
  if (dias > 1) put('jCant', dias, 'ROI post feria');
  return out;
}

/** Valor efectivo de un campo: lo escrito si existe (aunque sea ''), si no la sugerencia. */
export const efectivo = (f, sug, k) => (f?.[k] !== undefined ? f[k] : sug?.[k] != null ? String(sug[k].value) : '');

/**
 * Todas las cuentas. `f` son los campos tal cual (texto) y `sug` las sugerencias (opcional).
 * Devuelve { ok, errors, hora, jornada, balance, sobres, semaforo }.
 */
export function calcSueldo(f = {}, sug = {}) {
  const errors = {};
  const field = (k, opts) => {
    const r = readField(efectivo(f, sug, k), opts);
    if (r.error) errors[k] = r.error;
    return r.value;
  };

  // 1. ¿Cuánto vale mi hora?
  const hSueldo = field('hSueldo');
  const hDias = field('hDias');
  const hHoras = field('hHoras');
  if (hDias > 31) errors.hDias = 'Un mes tiene hasta 31 días.';
  if (hHoras > 24) errors.hHoras = 'Un día tiene hasta 24 horas.';
  const horasMes = hDias * hHoras;
  const valorHoraCalc = hSueldo > 0 && horasMes > 0 ? hSueldo / horasMes : null;
  const hora = {
    sueldo: hSueldo, dias: hDias, horasDia: hHoras, horasMes,
    valorHora: valorHoraCalc,
    valorJornada: valorHoraCalc != null ? valorHoraCalc * hHoras : null,
    falta: hSueldo > 0 && horasMes === 0 ? 'horas' : hSueldo === 0 && horasMes > 0 ? 'sueldo' : null,
  };

  // 2. Mi sueldo por jornada de feria
  const horasJ = JORNADA_KEYS.reduce((a, k) => a + field(k), 0);
  if (horasJ > 24) errors.jHoras = 'Una jornada no puede sumar más de 24 horas.';
  const jValor = field('jValor');
  const valorHora = f.jValor !== undefined && f.jValor !== '' ? jValor : valorHoraCalc ?? 0;
  const jCant = field('jCant', { positive: true, fallback: 1 });
  const sueldoJornada = horasJ * valorHora;
  const jornada = {
    horas: horasJ, valorHora, valorHoraPropio: f.jValor !== undefined && f.jValor !== '',
    cant: jCant, horasTotal: horasJ * jCant,
    sueldoJornada, sueldoFeria: sueldoJornada * jCant,
  };

  // 3. Balance de la feria
  const V = field('bVentas');
  // Mano de obra: si no escribió un monto y cargó horas de producción, horas × valor de su hora.
  const moHoras = field('moHoras');
  const moSug = moHoras > 0 && valorHora > 0 ? moHoras * valorHora : null;
  const v = {};
  for (const k of [...COSTO_KEYS, ...GASTO_KEYS]) v[k] = field(k);
  if (moSug != null && (f.cMo === undefined || f.cMo === '')) v.cMo = moSug;
  const costos = COSTO_KEYS.reduce((a, k) => a + v[k], 0);
  const gastos = GASTO_KEYS.reduce((a, k) => a + v[k], 0);
  const S = jornada.sueldoFeria;
  const resultado = V - costos - gastos - S;
  const margen = V > 0 ? resultado / V : null;
  // Facturación mínima: cubrir gastos fijos y tu sueldo de feria, con los costos variables en la
  // misma proporción sobre lo vendido que en esta feria. Sin ventas no hay proporción para estimar.
  const variables = VARIABLES.reduce((a, k) => a + v[k], 0);
  const fijos = gastos + costos - variables + S;
  const ratio = V > 0 ? variables / V : null;
  let minima = null;
  let minimaMotivo = null;
  if (ratio == null) minimaMotivo = 'sinVentas';
  else if (ratio >= 1) minimaMotivo = 'sinMargen';
  else minima = fijos / (1 - ratio);

  // Lo que efectivamente cubrió lo vendido, en orden: reponer y pagar gastos, tu mano de obra, tu sueldo de feria.
  const reposicion = costos - v.cMo + gastos;
  const negocio = Math.min(V, reposicion);
  const moCubierta = Math.min(Math.max(V - reposicion, 0), v.cMo);
  const sueldoCubierto = Math.min(Math.max(V - costos - gastos, 0), S);
  const balance = {
    ventas: V, ...v, moSug, costos, gastos, sueldo: S, resultado, margen,
    variables, fijos, ratio, minima, minimaMotivo,
    reposicion, faltaCostos: Math.max(costos + gastos - V, 0),
    sueldoCubierto, faltaSueldo: Math.max(S - sueldoCubierto, 0),
  };

  // 4. Los cuatro sobres. Sin ganancia no se reparte nada.
  const pctR = Math.min(Math.max(readField(f.reinv ?? String(REINV_DEFAULT), { percent: true, fallback: REINV_DEFAULT }).value, 0), 100) / 100;
  const ganancia = Math.max(resultado, 0);
  const reinversion = ganancia * pctR;
  const disponible = ganancia - reinversion;
  const sobres = {
    negocio, sueldo: moCubierta + sueldoCubierto, ganancia: disponible, reinversion,
    pctReinv: Math.round(pctR * 100),
    moCubierta, sueldoCubierto,
    ingresoPersonal: moCubierta + sueldoCubierto + disponible,
  };

  // Semáforo: rojo = no cubrió costos y gastos; amarillo = los cubrió pero no todo tu sueldo; verde = cubrió todo.
  let semaforo = null;
  if (V > 0 || costos + gastos + S > 0) {
    if (V < costos + gastos) semaforo = 'rojo';
    else if (resultado < 0) semaforo = 'amarillo';
    else semaforo = 'verde';
  }

  return { ok: Object.keys(errors).length === 0, errors, hora, jornada, balance, sobres, semaforo };
}

/** Lo que se guarda de cada jornada en el historial (números ya resueltos, para no depender de otras herramientas). */
export function resumenParaHistorial(f, sug) {
  const vals = {};
  for (const k of ALL_KEYS) {
    const e = efectivo(f, sug, k);
    if (e === '' || (k !== 'reinv' && readField(e).value === 0)) continue; // los ceros no se guardan: ocupan lugar
    vals[k] = e;
  }
  const r = calcSueldo(vals);
  return {
    f: vals,
    r: {
      ventas: r.balance.ventas, costos: r.balance.costos, gastos: r.balance.gastos, sueldo: r.balance.sueldo,
      mo: r.balance.cMo, resultado: r.balance.resultado, margen: r.balance.margen, horas: r.jornada.horasTotal,
      sueldoCubierto: r.balance.sueldoCubierto, moCubierta: r.sobres.moCubierta, ingresoPersonal: r.sobres.ingresoPersonal,
      reinversion: r.sobres.reinversion, semaforo: r.semaforo,
    },
  };
}

/** Acumulado por mes (AAAA-MM) del historial, del más reciente al más viejo. */
export function acumuladoMensual(hist = []) {
  const m = new Map();
  for (const h of hist) {
    const k = String(h.fecha || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(k) || !h.r) continue;
    const a = m.get(k) || { mes: k, ferias: 0, ventas: 0, costos: 0, sueldo: 0, ganancia: 0, ingresoPersonal: 0 };
    a.ferias += 1;
    a.ventas += h.r.ventas || 0;
    a.costos += (h.r.costos || 0) + (h.r.gastos || 0);
    a.sueldo += (h.r.sueldoCubierto || 0) + (h.r.moCubierta || 0);
    a.ganancia += h.r.resultado || 0;
    a.ingresoPersonal += h.r.ingresoPersonal || 0;
    m.set(k, a);
  }
  return [...m.values()].sort((a, b) => (a.mes < b.mes ? 1 : -1));
}
