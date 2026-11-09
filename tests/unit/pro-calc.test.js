import { describe, expect, it } from 'vitest';
import { controlaStock, gastosFeria, resumenFeria, resumenVentas, stockBajo, stockDe, ventaTotales } from '../../src/kit/pro-calc.js';

const com = { mp: 6.29, efect: 0 };
const poncho = { productoId: 'p1', varianteId: null, cant: 2, precio: 95000, costo: 45000 };
const manta = { productoId: 'p2', varianteId: 'azul', cant: 1, precio: 65000, costo: 30000 };

describe('ventaTotales', () => {
  it('suma ítems, aplica comisión del medio y calcula el neto', () => {
    const t = ventaTotales({ items: [poncho, manta], medio: 'mp' }, com);
    expect(t.subtotal).toBe(255000);
    expect(t.total).toBe(255000);
    expect(t.comision).toBeCloseTo(16039.5, 5);
    expect(t.neto).toBeCloseTo(238960.5, 5);
    expect(t.costo).toBe(120000);
    expect(t.unidades).toBe(3);
  });
  it('descuento en monto (tope el subtotal) y en porcentaje (tope 100%)', () => {
    expect(ventaTotales({ items: [poncho], descuento: { tipo: 'monto', valor: 10000 }, medio: 'efect' }, com).total).toBe(180000);
    expect(ventaTotales({ items: [poncho], descuento: { tipo: 'monto', valor: 999999 } }).total).toBe(0);
    expect(ventaTotales({ items: [poncho], descuento: { tipo: 'pct', valor: 10 } }).total).toBe(171000);
    expect(ventaTotales({ items: [poncho], descuento: { tipo: 'pct', valor: 150 } }).total).toBe(0);
  });
  it('la comisión se calcula sobre el total con descuento; medio sin tasa = 0', () => {
    const t = ventaTotales({ items: [poncho], descuento: { tipo: 'monto', valor: 90000 }, medio: 'mp' }, com);
    expect(t.comision).toBeCloseTo(100000 * 0.0629, 5);
    expect(ventaTotales({ items: [poncho], medio: 'uala' }, com).comision).toBe(0);
  });
  it('datos faltantes o raros no rompen', () => {
    expect(ventaTotales({}).total).toBe(0);
    expect(ventaTotales({ items: [{ cant: 'x', precio: null }] }).total).toBe(0);
  });
});

describe('stock', () => {
  const movimientos = [
    { productoId: 'p1', varianteId: null, cant: 10 }, { productoId: 'p1', varianteId: null, cant: 5 },
    { productoId: 'p2', varianteId: 'azul', cant: 4 }, { productoId: 'p2', varianteId: 'rojo', cant: 3 },
    { productoId: 'p1', varianteId: null, cant: -1 },
  ];
  const ventas = [{ items: [poncho, manta] }, { items: [{ ...poncho, cant: 1 }] }];
  it('entradas menos ventas, por variante y en total', () => {
    expect(stockDe('p1', null, { movimientos, ventas })).toBe(11);
    expect(stockDe('p2', 'azul', { movimientos, ventas })).toBe(3);
    expect(stockDe('p2', 'rojo', { movimientos, ventas })).toBe(3);
    expect(stockDe('p2', undefined, { movimientos, ventas })).toBe(6);
  });
  it('vender sin stock deja el número negativo (no frena la venta)', () => {
    expect(stockDe('p3', null, { movimientos, ventas: [{ items: [{ productoId: 'p3', cant: 2 }] }] })).toBe(-2);
  });
  it('controlaStock y stockBajo', () => {
    expect(controlaStock('p1', movimientos)).toBe(true);
    expect(controlaStock('p9', movimientos)).toBe(false);
    expect(stockBajo({ stockMin: 3 }, 3)).toBe(true);
    expect(stockBajo({ stockMin: 3 }, 4)).toBe(false);
    expect(stockBajo({}, 0)).toBe(false);
  });
});

describe('resúmenes', () => {
  it('por medio y por feria, con gastos y costo de mercadería', () => {
    const ventas = [{ items: [poncho], medio: 'mp' }, { items: [manta], medio: 'efect' }];
    const r = resumenVentas(ventas, com);
    expect(r.ventas).toBe(2);
    expect(r.porMedio.mp.total).toBe(190000);
    expect(r.porMedio.efect.ventas).toBe(1);
    const feria = { gastos: [{ monto: 120000 }, { monto: 30000 }] };
    expect(gastosFeria(feria)).toBe(150000);
    const f = resumenFeria(feria, ventas, com);
    expect(f.resultado).toBeCloseTo(255000 - 190000 * 0.0629 - 120000 - 150000, 5);
  });
});

import { periodo, resumenNegocio, topProductos } from '../../src/kit/pro-calc.js';

describe('resumen del negocio', () => {
  const T = (y, m, d) => new Date(y, m - 1, d, 12).getTime();
  const ferias = [
    { id: 'f1', nombre: 'Poncho', desde: '2026-07-10', gastos: [{ monto: 100000 }] },
    { id: 'f2', nombre: 'Navidad', desde: '2026-11-20', gastos: [{ monto: 50000 }] },
    { id: 'f3', nombre: 'Vieja', desde: '2025-12-01', gastos: [{ monto: 10 }] },
  ];
  const item = (pid, cant, precio, costo) => ({ productoId: pid, nombre: pid, cant, precio, costo });
  const ventas = [
    { ts: T(2026, 7, 10), feriaId: 'f1', medio: 'mp', items: [item('poncho', 2, 95000, 45000)] },
    { ts: T(2026, 11, 20), feriaId: 'f2', medio: 'efect', items: [item('manta', 1, 65000, 30000), item('taza', 4, 9000, 3500)], descuento: { tipo: 'monto', valor: 1000 } },
    { ts: T(2026, 11, 21), feriaId: null, medio: 'efect', items: [item('taza', 1, 9000, 3500)] },
  ];
  const com = { mp: 10 };

  it('todo: suma ventas, gastos de las ferias del período y calcula el resultado', () => {
    const r = resumenNegocio({ ferias, ventas, comisiones: com });
    expect(r.ventas).toBe(3);
    expect(r.total).toBe(190000 + 100000 + 9000);
    expect(r.comisiones).toBeCloseTo(19000, 5);
    expect(r.gastos).toBe(150010);
    expect(r.resultado).toBeCloseTo(r.neto - r.costo - 150010, 5);
    expect(r.porFeria[0].nombre).toBe('Navidad'); // ordenado por resultado
    expect(r.sinFeria.ventas).toBe(1);
  });

  it('un período deja afuera ventas y gastos de otras fechas', () => {
    const r = resumenNegocio({ ferias, ventas, comisiones: com }, { desde: T(2026, 11, 1), hasta: null });
    expect(r.ventas).toBe(2);
    expect(r.gastos).toBe(50000);
    expect(r.porFeria.map(f => f.nombre)).toEqual(['Navidad']);
  });

  it('topProductos reparte el descuento y calcula el margen', () => {
    const { top, mejorMargen } = topProductos(ventas, 2);
    expect(top.map(p => p.id)).toEqual(['poncho', 'manta']);
    const manta = top[1];
    expect(manta.ingresos).toBeCloseTo(65000 * (100000 / 101000), 5);
    expect(manta.unidades).toBe(1);
    expect(mejorMargen.id).toBe('taza');
  });

  it('periodo: inicio del mes, de 3 meses y del año', () => {
    const now = new Date(2026, 10, 9);
    expect(periodo('mes', now).desde).toBe(new Date(2026, 10, 1).getTime());
    expect(periodo('3m', now).desde).toBe(new Date(2026, 8, 1).getTime());
    expect(periodo('anio', now).desde).toBe(new Date(2026, 0, 1).getTime());
    expect(periodo('todo', now).desde).toBeNull();
  });
});
