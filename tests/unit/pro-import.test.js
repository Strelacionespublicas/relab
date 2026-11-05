import { describe, expect, it } from 'vitest';
import { parseDelimited, parseProductRows, planImport, templateCsv } from '../../src/kit/pro-import.js';

describe('parseDelimited', () => {
  it('lee lo que se pega desde Excel (tabs)', () => {
    expect(parseDelimited('Nombre\tPrecio\nPoncho\t95.000\n')).toEqual([['Nombre', 'Precio'], ['Poncho', '95.000']]);
  });
  it('CSV con punto y coma, comillas y saltos de Windows', () => {
    expect(parseDelimited('﻿"Nombre";"Precio"\r\n"Manta ""azul""";"65.000,50"\r\n')).toEqual([['Nombre', 'Precio'], ['Manta "azul"', '65.000,50']]);
  });
  it('CSV con coma y comas dentro de comillas; ignora filas vacías', () => {
    expect(parseDelimited('Nombre,Precio,Variantes\nManta,65000,"Azul, Rojo"\n,,\n')).toEqual([['Nombre', 'Precio', 'Variantes'], ['Manta', '65000', 'Azul, Rojo']]);
  });
});

describe('parseProductRows', () => {
  it('encabezados en cualquier orden y con otros nombres; importes argentinos', () => {
    const r = parseProductRows([
      ['Precio de venta', 'Producto', 'Costo', 'Cantidad', 'Talles', 'Rubro'],
      ['95.000', 'Poncho', '45.000', '8', '', 'Textiles'],
      ['$ 1.500,50', 'Llavero', '', '', 'S, M, L', ''],
    ]);
    expect(r.missing).toEqual([]);
    expect(r.errors).toEqual([]);
    expect(r.items).toEqual([
      { fila: 2, nombre: 'Poncho', categoria: 'Textiles', costo: 45000, precio: 95000, stock: 8, stockMin: null, variantes: [] },
      { fila: 3, nombre: 'Llavero', categoria: '', costo: 0, precio: 1500.5, stock: null, stockMin: null, variantes: ['S', 'M', 'L'] },
    ]);
  });
  it('acepta números de Excel (no texto)', () => {
    expect(parseProductRows([['Nombre', 'Precio', 'Stock'], ['Poncho', 95000, 3]]).items[0]).toMatchObject({ precio: 95000, stock: 3 });
  });
  it('avisa las columnas obligatorias que faltan', () => {
    expect(parseProductRows([['Producto', 'Costo'], ['A', '1']]).missing).toEqual(['Precio']);
    expect(parseProductRows([]).missing).toEqual(['Nombre', 'Precio']);
  });
  it('errores por fila, con número de fila de la planilla; el resto se importa', () => {
    const r = parseProductRows([['Nombre', 'Precio', 'Stock'], ['Bien', '100', ''], ['', '100', ''], ['Sin precio', '', ''], ['Raro', 'abc', ''], ['Medio', '100', '2,5']]);
    expect(r.items.map(i => i.nombre)).toEqual(['Bien']);
    expect(r.errors.map(e => e.fila)).toEqual([3, 4, 5, 6]);
  });
  it('nombre repetido en la planilla: vale la última fila', () => {
    const r = parseProductRows([['Nombre', 'Precio'], ['Manta', '1'], ['manta ', '2']]);
    expect(r.items).toHaveLength(1);
    expect(r.items[0].precio).toBe(2);
  });
  it('la plantilla se lee sin errores', () => {
    const r = parseProductRows(parseDelimited(templateCsv()));
    expect(r.errors).toEqual([]);
    expect(r.items).toHaveLength(3);
    expect(r.items[1].variantes).toEqual(['Azul', 'Rojo']);
  });
});

describe('planImport', () => {
  it('marca los que ya existen por nombre (sin importar mayúsculas ni tildes)', () => {
    const plan = planImport([{ nombre: 'Cerámica Azul' }, { nombre: 'Nuevo' }], [{ id: 'p1', nombre: 'ceramica azul' }]);
    expect(plan[0].existente.id).toBe('p1');
    expect(plan[1].existente).toBeNull();
  });
});
