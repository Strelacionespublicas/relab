// Pruebas de src/kit/sueldo-calc.js ("Mi sueldo y rentabilidad").
import { describe, expect, it } from 'vitest';
import { acumuladoMensual, calcSueldo, resumenParaHistorial, sugerencias } from '../../src/kit/sueldo-calc.js';
import { EJEMPLO_SUELDO } from '../../src/kit/sueldo-ejemplo.js';

describe('ejemplo del enunciado', () => {
  const r = calcSueldo(EJEMPLO_SUELDO);
  it('valor hora y sueldo de la jornada', () => {
    expect(r.ok).toBe(true);
    expect(r.hora.horasMes).toBe(160);
    expect(r.hora.valorHora).toBe(4000);
    expect(r.hora.valorJornada).toBe(32000);
    expect(r.jornada.horas).toBe(6);
    expect(r.jornada.sueldoJornada).toBe(24000);
  });
  it('balance, sobres e ingreso personal', () => {
    expect(r.balance.ventas).toBe(150000);
    expect(r.balance.costos).toBe(90000);
    expect(r.balance.gastos).toBe(8000);
    expect(r.balance.resultado).toBe(28000);
    expect(r.sobres.negocio).toBe(68000);
    expect(r.sobres.sueldo).toBe(54000);
    expect(r.sobres.reinversion).toBeCloseTo(11200);
    expect(r.sobres.ganancia).toBeCloseTo(16800);
    expect(r.sobres.ingresoPersonal).toBeCloseTo(70800);
    expect(r.sobres.negocio + r.sobres.sueldo + r.sobres.ganancia + r.sobres.reinversion).toBeCloseTo(150000);
    expect(r.semaforo).toBe('verde');
    expect(r.balance.margen).toBeCloseTo(28000 / 150000);
  });
  it('facturación mínima con costos variables', () => {
    // variables = 60.000 + 30.000 = 90.000 (60% de lo vendido); fijos = 8.000 + 24.000 = 32.000
    expect(r.balance.ratio).toBeCloseTo(0.6);
    expect(r.balance.minima).toBeCloseTo(80000);
    // con 80.000 de venta y la misma proporción, el resultado da 0
    const check = calcSueldo({ ...EJEMPLO_SUELDO, bVentas: '80000', cMp: '32000', cMo: '16000' });
    expect(check.balance.resultado).toBeCloseTo(0);
  });
});

describe('semáforo y casos límite', () => {
  it('amarillo: cubre costos pero no todo el sueldo; muestra lo que falta', () => {
    const r = calcSueldo({ ...{ jVenta: '6', jValor: '4000' }, bVentas: '110000', cMp: '60000', cMo: '30000', gTransp: '5000', gAlq: '3000' });
    expect(r.semaforo).toBe('amarillo');
    expect(r.balance.sueldoCubierto).toBe(12000);
    expect(r.balance.faltaSueldo).toBe(12000);
    expect(r.sobres.ganancia).toBe(0);
    expect(r.sobres.reinversion).toBe(0);
  });
  it('rojo: no cubre costos; no reparte ganancia ni sueldo de feria', () => {
    const r = calcSueldo({ jVenta: '6', jValor: '4000', bVentas: '50000', cMp: '60000', gAlq: '3000' });
    expect(r.semaforo).toBe('rojo');
    expect(r.balance.faltaCostos).toBe(13000);
    expect(r.sobres.negocio).toBe(50000);
    expect(r.sobres.sueldo).toBe(0);
    expect(r.sobres.ingresoPersonal).toBe(0);
  });
  it('sin ventas: el tiempo igual vale y el resultado es negativo', () => {
    const r = calcSueldo({ jVenta: '6', jValor: '4000', gAlq: '3000' });
    expect(r.balance.resultado).toBe(-27000);
    expect(r.balance.minima).toBeNull();
    expect(r.balance.minimaMotivo).toBe('sinVentas');
    expect(r.semaforo).toBe('rojo');
  });
  it('sin margen: costos variables iguales o mayores a lo vendido', () => {
    const r = calcSueldo({ bVentas: '1000', cMp: '1000' });
    expect(r.balance.minima).toBeNull();
    expect(r.balance.minimaMotivo).toBe('sinMargen');
  });
  it('división por cero y vacíos', () => {
    const r = calcSueldo({ hSueldo: '500000' });
    expect(r.hora.valorHora).toBeNull();
    expect(r.hora.falta).toBe('horas');
    expect(r.semaforo).toBeNull();
    expect(calcSueldo({}).ok).toBe(true);
  });
  it('valida negativos, texto y rangos', () => {
    const r = calcSueldo({ hSueldo: '-5', bVentas: 'abc', hHoras: '30', reinv: '40' });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(['bVentas', 'hHoras', 'hSueldo']);
  });
  it('mano de obra desde horas de producción × valor hora', () => {
    const r = calcSueldo({ jValor: '4000', moHoras: '7,5', bVentas: '100000' });
    expect(r.balance.cMo).toBe(30000);
    expect(calcSueldo({ jValor: '4000', moHoras: '7,5', cMo: '10000' }).balance.cMo).toBe(10000);
  });
  it('revendedora: sin mano de obra, el costo es la mercadería', () => {
    const r = calcSueldo({ jVenta: '8', jValor: '3000', bVentas: '200000', cMp: '120000', gCom: '6000' });
    expect(r.balance.resultado).toBe(200000 - 120000 - 6000 - 24000);
    expect(r.sobres.ingresoPersonal).toBeCloseTo(24000 + 50000 * 0.7);
  });
  it('varias jornadas multiplican el sueldo de feria', () => {
    const r = calcSueldo({ jVenta: '6', jValor: '4000', jCant: '3' });
    expect(r.jornada.sueldoFeria).toBe(72000);
    expect(r.jornada.horasTotal).toBe(18);
  });
  it('reinversión 0 y 100', () => {
    expect(calcSueldo({ ...EJEMPLO_SUELDO, reinv: '0' }).sobres.reinversion).toBe(0);
    expect(calcSueldo({ ...EJEMPLO_SUELDO, reinv: '100' }).sobres.ganancia).toBe(0);
  });
});

describe('sugerencias del resto del kit', () => {
  it('usa el ROI y, si no hay, el tracker', () => {
    const s = sugerencias({ roi: { ef: '50.000', dig: '100.000', stand: '3000', tras: '5000', ins: '60000', com: '0', horas: '6', dias: '1' }, ventas: [{ monto: 999 }] });
    expect(s.bVentas).toEqual({ value: 150000, from: 'ROI post feria' });
    expect(s.gAlq.value).toBe(3000);
    expect(s.gCom).toBeUndefined();
    expect(s.jCant).toBeUndefined();
    expect(sugerencias({ roi: {}, ventas: [{ monto: 1000 }, { monto: 2500 }] }).bVentas).toEqual({ value: 3500, from: 'Ventas del día' });
  });
  it('lo escrito gana a la sugerencia, incluso vacío', () => {
    const sug = sugerencias({ roi: { stand: '3000' } });
    expect(calcSueldo({}, sug).balance.gAlq).toBe(3000);
    expect(calcSueldo({ gAlq: '1000' }, sug).balance.gAlq).toBe(1000);
    expect(calcSueldo({ gAlq: '' }, sug).balance.gAlq).toBe(0);
  });
});

describe('historial', () => {
  it('guarda valores resueltos y acumula por mes', () => {
    const a = { id: 'a', fecha: '2026-11-08', ...resumenParaHistorial(EJEMPLO_SUELDO) };
    const b = { id: 'b', fecha: '2026-11-22', ...resumenParaHistorial({ ...EJEMPLO_SUELDO, bVentas: '110000' }) };
    const c = { id: 'c', fecha: '2026-10-01', ...resumenParaHistorial({ ...EJEMPLO_SUELDO, reinv: '0' }) };
    expect(a.r.resultado).toBe(28000);
    expect(b.r.resultado).toBe(-12000);
    const m = acumuladoMensual([a, b, c]);
    expect(m.map(x => x.mes)).toEqual(['2026-11', '2026-10']);
    expect(m[0].ferias).toBe(2);
    expect(m[0].ventas).toBe(260000);
    expect(m[0].ganancia).toBe(16000);
    expect(m[0].sueldo).toBe(54000 + 42000);
  });
});

describe('auditoría: las horas del ROI no se cuentan dos veces', () => {
  it('no se sugieren en Atención y venta; quedan como referencia', () => {
    const sug = sugerencias({ roi: { horas: '10' } });
    expect(sug.jVenta).toBeUndefined();
    expect(sug.horasRoi).toEqual({ value: 10, from: 'ROI post feria' });
  });
  it('con 10 h en el ROI y 1 h de armado, la jornada suma 1 h (no 11)', () => {
    const sug = sugerencias({ roi: { horas: '10' } });
    expect(calcSueldo({ jArmado: '1', jValor: '4000' }, sug).jornada.horas).toBe(1);
  });
});
