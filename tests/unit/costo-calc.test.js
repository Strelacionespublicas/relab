import { describe, expect, it } from 'vitest';
import { aCalculadora, calcCosto, redondear } from '../../src/kit/costo-calc.js';
import { EJEMPLO_COSTO } from '../../src/kit/costo-ejemplo.js';

const ins = (id, pagado, compra = '', usado = '') => ({ id, nombre: id, pagado, compra, usado });

describe('caso de la auditoría: lote de velas', () => {
  const r = calcCosto(EJEMPLO_COSTO('v'));
  it('materiales solo por lo usado', () => {
    expect(r.ok).toBe(true);
    expect(r.lote.insumos[0].costo).toBe(20000);
    expect(r.lote.insumos[0].parcial).toBe(true);
    expect(r.lote.materiales).toBe(30000);
  });
  it('costo del lote y por unidad', () => {
    expect(r.lote.mo).toBe(20000);
    expect(r.lote.indirectos).toBe(10000);
    expect(r.lote.costoLote).toBe(80000);
    expect(r.unidad.costoUnit).toBe(4000);
  });
  it('costo comercial e integral', () => {
    expect(r.unidad.comercialUnit).toBe(1500);
    expect(r.unidad.integral).toBe(5500);
  });
  it('precio con margen 30% y comisión 5%', () => {
    expect(r.precio.sugerido).toBeCloseTo(8461.54, 2);
    expect(r.precio.margenReal).toBeCloseTo(0.30, 10);
  });
});

describe('precio: margen y recargo no son lo mismo', () => {
  const base = { insumos: [ins('a', '80000')], unidades: '20', gFeria: '30000', uFeria: '20' }; // 4.000 + 1.500 = integral 5.500
  it('recargo 30% → $7.150', () => {
    expect(calcCosto({ ...base, metodo: 'recargo', pct: '30' }).precio.sugerido).toBeCloseTo(7150, 6);
  });
  it('margen 30% → $7.857,14', () => {
    expect(calcCosto({ ...base, metodo: 'margen', pct: '30' }).precio.sugerido).toBeCloseTo(7857.14, 2);
  });
  it('margen 30% + comisión 5% → $8.461,54', () => {
    expect(calcCosto({ ...base, metodo: 'margen', pct: '30', com: '5' }).precio.sugerido).toBeCloseTo(8461.54, 2);
  });
  it('recargo con comisión: la comisión se suma sobre el precio', () => {
    const r = calcCosto({ ...base, metodo: 'recargo', pct: '30', com: '5' });
    expect(r.precio.sugerido).toBeCloseTo(7150 / 0.95, 6);
    expect(r.precio.recargoReal).toBeCloseTo(0.30, 10);
  });
  it('un recargo puede pasar el 100% (un margen no)', () => {
    expect(calcCosto({ ...base, metodo: 'recargo', pct: '150' }).ok).toBe(true);
    expect(calcCosto({ ...base, metodo: 'margen', pct: '150' }).errors.pct).toBeTruthy();
  });
  it('margen + comisión de 100% o más: error y sin precio', () => {
    const r = calcCosto({ ...base, pct: '95', com: '5' });
    expect(r.errors.pct).toBeTruthy();
    expect(r.precio.sugerido).toBeNull();
  });
});

describe('precio final escrito a mano', () => {
  const base = { insumos: [ins('a', '80000')], unidades: '20', pct: '30' }; // 4.000 por unidad
  it('muestra la ganancia y el margen reales a ese precio', () => {
    const r = calcCosto({ ...base, precio: '8000' });
    expect(r.precio.final).toBe(8000);
    expect(r.precio.ganUnit).toBe(4000);
    expect(r.precio.margenReal).toBe(0.5);
  });
  it('con comisión, la ganancia es sobre lo que te queda', () => {
    const r = calcCosto({ ...base, precio: '8000', com: '10' });
    expect(r.precio.neto).toBe(7200);
    expect(r.precio.ganUnit).toBe(3200);
  });
  it('un precio por debajo del costo da pérdida', () => {
    expect(calcCosto({ ...base, precio: '3000' }).precio.ganUnit).toBe(-1000);
  });
});

describe('casos límite', () => {
  it('sin unidades no hay costo por unidad ni precio', () => {
    const r = calcCosto({ insumos: [ins('a', '1000')] });
    expect(r.lote.costoLote).toBe(1000);
    expect(r.unidad.costoUnit).toBeNull();
    expect(r.precio.sugerido).toBeNull();
  });
  it('todo vacío: ceros, sin errores', () => {
    const r = calcCosto({});
    expect(r.ok).toBe(true);
    expect(r.lote.costoLote).toBe(0);
  });
  it('negativos y textos inválidos se marcan', () => {
    const r = calcCosto({ insumos: [ins('a', '-5')], envases: 'mucho', unidades: '-2' });
    expect(r.errors['ins.a.pagado']).toBeTruthy();
    expect(r.errors.envases).toBeTruthy();
    expect(r.errors.unidades).toBeTruthy();
  });
  it('usar más de lo que compraste es un error', () => {
    expect(calcCosto({ insumos: [ins('a', '1000', '1', '2')] }).errors['ins.a.usado']).toBeTruthy();
  });
  it('lo usado sin la cantidad comprada pide completarla', () => {
    expect(calcCosto({ insumos: [ins('a', '1000', '', '2')] }).errors['ins.a.compra']).toBeTruthy();
  });
  it('gastos de feria sin unidades pide completarlas', () => {
    expect(calcCosto({ gFeria: '30000' }).errors.uFeria).toBeTruthy();
  });
  it('el valor de la hora viene de Mi sueldo si no se escribió', () => {
    expect(calcCosto({ moHoras: '5' }, { valorHoraSug: 4000 }).lote.mo).toBe(20000);
    expect(calcCosto({ moHoras: '5', moValor: '3000' }, { valorHoraSug: 4000 }).lote.mo).toBe(15000);
    expect(calcCosto({ moHoras: '5', moValor: '' }, { valorHoraSug: 4000 }).lote.mo).toBe(20000);
  });
  it('indirectos: porcentaje de 0 a 100', () => {
    expect(calcCosto({ indMes: '100000', indPct: '120' }).errors.indPct).toBeTruthy();
  });
  it('sin precisión perdida en cuentas intermedias', () => {
    expect(calcCosto({ insumos: [ins('a', '10000')], unidades: '3' }).unidad.costoUnit).toBeCloseTo(3333.333333, 5);
  });
});

describe('redondeo de precio', () => {
  it('redondea para arriba según el tamaño', () => {
    expect(redondear(8461.54)).toBe(8500);
    expect(redondear(4320)).toBe(4350);
    expect(redondear(61234)).toBe(61500);
    expect(redondear(8500)).toBe(8500);
    expect(redondear(0)).toBe(0);
  });
});

describe('llevar a la Calculadora', () => {
  let n = 0;
  const id = () => `n${++n}`;
  const dato = { nombre: 'Vela', costoUnit: 4000, precio: 8461.54 };
  it('actualiza el producto con el mismo nombre', () => {
    const ps = [{ id: 'a', nombre: 'vela ', costo: '1', precio: '2', unid: '10' }];
    expect(aCalculadora(ps, dato, id)).toEqual([{ id: 'a', nombre: 'Vela', costo: '4000', precio: '8462', unid: '10' }]);
  });
  it('usa la primera fila vacía o agrega una', () => {
    expect(aCalculadora([{ id: 'a', nombre: '', costo: '', precio: '', unid: '' }], dato, id)[0].nombre).toBe('Vela');
    const out = aCalculadora([{ id: 'a', nombre: 'Jabón', costo: '1', precio: '2', unid: '' }], dato, id);
    expect(out.length).toBe(2);
    expect(out[1].costo).toBe('4000');
  });
  it('mantiene los centavos del costo con coma', () => {
    expect(aCalculadora([], { ...dato, costoUnit: 3333.3333 }, id)[0].costo).toBe('3333,33');
  });
});
