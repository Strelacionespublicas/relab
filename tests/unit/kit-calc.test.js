// Pruebas de src/kit/calc.js: importes en formato argentino, validaciones y cuentas del Kit feriante.
import { describe, expect, it } from 'vitest';
import { calcFeria, calcRoi, csvMonto, fmt, MSG, num, parseNumber, readField, readMonto } from '../../src/kit/calc.js';

const val = s => parseNumber(s).value;
const FIJOS = ['alquiler', 'traslado', 'deco', 'viaticos', 'personal', 'otros'];

describe('parseNumber · formatos argentinos pedidos', () => {
  it.each([
    ['120.000', 120000],
    ['1.500,50', 1500.5],
    ['$5000', 5000],
    ['12 000', 12000],
    ['1500,50', 1500.5],
  ])('%s → %d', (input, expected) => expect(val(input)).toBe(expected));
});

describe('parseNumber · otros formatos válidos', () => {
  it.each([
    ['120000', 120000],
    ['1.500.000', 1500000],
    ['1.500.000,75', 1500000.75],
    ['$ 1.500,50', 1500.5],
    ['$120.000', 120000],
    ['12 000', 12000],
    ['1,500.50', 1500.5],
    ['1500,5', 1500.5],
    ['0,5', 0.5],
    [',5', 0.5],
    ['0.500', 0.5],
    ['2.99', 2.99],
    ['3.5', 3.5],
    ['3', 3],
    ['5.', 5],
    ['5,', 5],
    ['0', 0],
    ['  42  ', 42],
  ])('%s → %d', (input, expected) => expect(val(input)).toBe(expected));

  it('acepta números ya guardados como number', () => {
    expect(parseNumber(95000)).toEqual({ ok: true, value: 95000 });
    expect(parseNumber(1500.5)).toEqual({ ok: true, value: 1500.5 });
  });

  it('lee el signo negativo (la validación decide si se permite)', () => {
    expect(val('-5')).toBe(-5);
    expect(val('−1.500')).toBe(-1500);
    expect(val('$-200')).toBe(-200);
    expect(val('-0')).toBe(0);
  });

  it('vacío es null, no 0', () => {
    expect(parseNumber('')).toEqual({ ok: true, value: null });
    expect(parseNumber('   ')).toEqual({ ok: true, value: null });
    expect(parseNumber(null)).toEqual({ ok: true, value: null });
    expect(parseNumber(undefined)).toEqual({ ok: true, value: null });
  });
});

describe('parseNumber · inválidos (no se convierten en 0)', () => {
  it.each(['abc', '12a', '1.50.0', '1,500,000', '1.5,00', '1,5.00,0', '$', '-', '.', ',', '12-3', '1.2.3', '5%', 'NaN', 'Infinity', '1e5'])(
    '%s es inválido', input => expect(parseNumber(input).ok).toBe(false),
  );
  it('NaN e Infinity como number son inválidos', () => {
    expect(parseNumber(NaN).ok).toBe(false);
    expect(parseNumber(Infinity).ok).toBe(false);
  });
});

describe('num (compatibilidad para cuentas internas)', () => {
  it('lee los formatos argentinos', () => {
    expect(num('120.000')).toBe(120000);
    expect(num('1.500,50')).toBe(1500.5);
  });
  it('vacío o inválido da 0', () => {
    expect(num('')).toBe(0);
    expect(num('abc')).toBe(0);
  });
});

describe('readField', () => {
  it('vacío vale 0 sin error', () => expect(readField('')).toEqual({ value: 0, error: null }));
  it('inválido da error y no un 0 silencioso', () => expect(readField('12a')).toEqual({ value: 0, error: MSG.invalid }));
  it('rechaza negativos', () => expect(readField('-500').error).toBe(MSG.negative));
  it('porcentaje entre 0 y 100', () => {
    expect(readField('0', { percent: true }).error).toBeNull();
    expect(readField('100', { percent: true }).error).toBeNull();
    expect(readField('2,99', { percent: true }).value).toBe(2.99);
    expect(readField('101', { percent: true }).error).toBe(MSG.percent);
    expect(readField('-1', { percent: true }).error).toBe(MSG.negative);
  });
  it('positive exige mayor a 0 y usa el valor por defecto', () => {
    expect(readField('0', { positive: true, fallback: 1 })).toEqual({ value: 1, error: MSG.positive });
    expect(readField('', { positive: true, fallback: 1 })).toEqual({ value: 1, error: null });
  });
});

describe('readMonto (Ventas del día)', () => {
  it('lee montos argentinos', () => {
    expect(readMonto('12.000')).toEqual({ value: 12000, error: null });
    expect(readMonto('1.500,50')).toEqual({ value: 1500.5, error: null });
    expect(readMonto('$5000').value).toBe(5000);
  });
  it('rechaza vacío, cero, negativo e inválido', () => {
    expect(readMonto('').error).toBe(MSG.positive);
    expect(readMonto('0').error).toBe(MSG.positive);
    expect(readMonto('-100').error).toBe(MSG.negative);
    expect(readMonto('doce mil').error).toBe(MSG.invalid);
  });
});

describe('calcFeria (Calculadora)', () => {
  const caso = {
    fijos: { alquiler: '100.000' },
    comision: '3', pctDigital: '50',
    productos: [
      { id: 'a', costo: '2.000', precio: '5.000', unid: '30' },
      { id: 'b', costo: '1000', precio: '3000', unid: '20' },
    ],
  };

  it('ingresos, costos, comisiones, ganancia, margen y equilibrio (cuenta a mano)', () => {
    const r = calcFeria(caso, FIJOS);
    expect(r.ok).toBe(true);
    expect(r.ing).toBe(210000); // 5000×30 + 3000×20
    expect(r.cv).toBe(80000); // 2000×30 + 1000×20
    expect(r.fijos).toBe(100000);
    expect(r.com).toBeCloseTo(3150); // 210000 × 50% × 3%
    expect(r.gan).toBeCloseTo(26850);
    expect(r.margen).toBe(13);
    expect(r.eq).toBe(40); // 100000 / (4200 − 1600 − 63)
  });

  it('el caso de Rosa da lo mismo que antes', () => {
    const rosa = {
      fijos: { alquiler: '120000', traslado: '30000', deco: '25000', viaticos: '40000' },
      comision: '3', pctDigital: '70',
      productos: [
        { id: '1', costo: '45000', precio: '95000', unid: '8' },
        { id: '2', costo: '30000', precio: '65000', unid: '10' },
        { id: '3', costo: '6000', precio: '15000', unid: '25' },
      ],
    };
    const r = calcFeria(rosa, FIJOS);
    expect(r.ing).toBe(1785000);
    expect(Math.round(r.gan)).toBe(722515);
    expect(r.eq).toBe(10);
  });

  it('antes "120.000" contaba como 120: ahora como 120000', () => {
    expect(calcFeria({ ...caso, fijos: { alquiler: '120.000' } }, FIJOS).fijos).toBe(120000);
  });

  it('0% digital no cobra comisión', () => expect(calcFeria({ ...caso, pctDigital: '0' }, FIJOS).com).toBe(0));

  it('valores inválidos se marcan y no se calculan como 0', () => {
    const r = calcFeria({ ...caso, fijos: { alquiler: 'cien mil' } }, FIJOS);
    expect(r.ok).toBe(false);
    expect(r.errors['fijos.alquiler']).toBe(MSG.invalid);
  });

  it('rechaza negativos y porcentajes fuera de rango', () => {
    const r = calcFeria({ ...caso, pctDigital: '-50', comision: '150', productos: [{ id: 'x', costo: '-1', precio: '10', unid: '1' }] }, FIJOS);
    expect(r.ok).toBe(false);
    expect(r.errors.pctDigital).toBe(MSG.negative);
    expect(r.errors.comision).toBe(MSG.percent);
    expect(r.errors['prod.x.costo']).toBe(MSG.negative);
  });

  it('sin unidades o con margen negativo no hay equilibrio', () => {
    expect(calcFeria({ ...caso, productos: [{ id: 'a', costo: '1', precio: '2', unid: '' }] }, FIJOS).eq).toBeNull();
    expect(calcFeria({ ...caso, productos: [{ id: 'a', costo: '9', precio: '5', unid: '10' }] }, FIJOS).eq).toBeNull();
  });

  it('todo vacío no rompe', () => {
    const r = calcFeria({ fijos: {}, productos: [{ id: 'a', costo: '', precio: '', unid: '' }], comision: '3', pctDigital: '70' }, FIJOS);
    expect(r).toMatchObject({ ok: true, ing: 0, gan: 0, margen: 0, eq: null });
  });
});

describe('calcRoi (ROI post feria)', () => {
  const base = { ef: '50.000', dig: '20.000', com: '1.000', stand: '40.000', dias: '2', obj: '100.000', cont: '10', seg: '25' };

  it('neto, costos, ganancia, ROI, venta por día, objetivo y costo por contacto', () => {
    const r = calcRoi(base);
    expect(r.ok).toBe(true);
    expect(r.bruto).toBe(70000);
    expect(r.ing).toBe(69000);
    expect(r.costo).toBe(40000);
    expect(r.gan).toBe(29000);
    expect(r.pctRoi).toBe(73); // 29000 / 40000
    expect(r.ventaDia).toBe(35000); // 70000 / 2
    expect(r.pctObj).toBe(70); // 70000 / 100000, sobre lo vendido
    expect(r.costoContacto).toBe(4000);
    expect(r.decision).toBe('go');
  });

  it('decisiones', () => {
    expect(calcRoi({ ef: '45000', stand: '40000' }).decision).toBe('maybe'); // ROI 12%
    expect(calcRoi({ ef: '30000', stand: '40000' }).decision).toBe('no');
    expect(calcRoi({ ef: '30000' }).decision).toBe('sinCostos');
    expect(calcRoi({}).decision).toBeNull();
  });

  it('sin costos no hay ROI', () => expect(calcRoi({ ef: '1000' }).pctRoi).toBeNull());

  it('días: vacío es 1; 0 es error', () => {
    expect(calcRoi({ ef: '1000' }).dias).toBe(1);
    expect(calcRoi({ ef: '1000', dias: '0' }).errors.dias).toBe(MSG.positive);
  });

  it('inválidos y negativos se marcan', () => {
    const r = calcRoi({ ef: 'mucho', stand: '-5' });
    expect(r.ok).toBe(false);
    expect(r.errors.ef).toBe(MSG.invalid);
    expect(r.errors.stand).toBe(MSG.negative);
  });
});

describe('formato de salida', () => {
  it('fmt redondea a pesos con separador argentino', () => {
    expect(fmt(1785000)).toBe('$1.785.000');
    expect(fmt(-2500)).toBe('−$2.500');
  });
  it('csvMonto no pierde centavos', () => {
    expect(csvMonto(1500.5)).toBe('1500,5');
    expect(csvMonto(12000)).toBe('12000');
  });
});

describe('ROI: tu sueldo', () => {
  const base = { ef: '300.000', dig: '', com: '', stand: '100.000', dias: '2' }; // ganancia 200.000 en 2 jornadas
  it('ganancia por jornada; por hora solo con horas', () => {
    const r = calcRoi(base);
    expect(r.ganDia).toBe(100000);
    expect(r.ganHora).toBeNull();
    expect(r.cubre).toBeNull();
    expect(r.trasSueldo).toBeNull();
    expect(calcRoi({ ...base, horas: '10' }).ganHora).toBe(10000);
  });
  it('sueldo cubierto: porcentaje y lo que le queda al negocio', () => {
    const r = calcRoi({ ...base, sueldo: '80.000' });
    expect(r.cubre).toBeCloseTo(1.25, 5);
    expect(r.trasSueldo).toBe(40000);
  });
  it('sueldo no cubierto: lo que falta', () => {
    const r = calcRoi({ ...base, sueldo: '150.000' });
    expect(r.cubre).toBeCloseTo(100000 / 150000, 5);
    expect(r.trasSueldo).toBe(-100000);
  });
  it('campos inválidos se marcan y no rompen el resto', () => {
    const r = calcRoi({ ...base, sueldo: 'mucho', horas: '-3' });
    expect(r.ok).toBe(false);
    expect(r.errors.sueldo).toBeTruthy();
    expect(r.errors.horas).toBeTruthy();
    expect(r.gan).toBe(200000);
  });
  it('lo que ya calculaba no cambia', () => {
    const r = calcRoi(base);
    expect(r.gan).toBe(200000);
    expect(r.ventaDia).toBe(150000);
    expect(r.decision).toBe('go');
  });
});
