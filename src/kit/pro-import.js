// Importar productos desde una planilla (Excel, CSV o filas pegadas desde Excel / Google Sheets).
// Funciones puras, con pruebas en tests/unit/pro-import.test.js.
//
// Columnas (la primera fila es el encabezado; el orden y las mayúsculas no importan):
//   Nombre (obligatoria) · Categoría · Costo · Precio (obligatoria) · Stock · Aviso de stock · Variantes
// Variantes: separadas por coma ("Azul, Rojo"). Stock: existencias actuales (solo sin variantes).
// Un producto con el mismo nombre que uno existente se ACTUALIZA (no se duplica).
import { parseNumber } from './calc.js';

export const COLUMNS = ['Nombre', 'Categoría', 'Costo', 'Precio', 'Stock', 'Aviso de stock', 'Variantes'];
const ALIASES = {
  nombre: ['nombre', 'producto', 'articulo', 'descripcion', 'item'],
  categoria: ['categoria', 'rubro', 'tipo', 'linea'],
  costo: ['costo', 'costo unitario', 'precio de costo', 'costo $'],
  precio: ['precio', 'precio de venta', 'precio venta', 'pvp', 'precio $', 'venta'],
  stock: ['stock', 'cantidad', 'existencias', 'unidades', 'stock actual'],
  stockMin: ['aviso de stock', 'stock minimo', 'minimo', 'aviso', 'alerta'],
  variantes: ['variantes', 'variante', 'talles', 'colores', 'opciones'],
};
const MAX_ROWS = 1000;

const norm = s => String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
export const keyName = s => norm(s);

// Texto CSV o TSV (lo que se copia de Excel) → filas. Detecta el separador: tab, punto y coma o coma.
export function parseDelimited(text) {
  const src = String(text ?? '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const first = src.split('\n').find(l => l.trim()) || '';
  const sep = first.includes('\t') ? '\t' : first.split(';').length > first.split(',').length ? ';' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"' && cell === '') q = true;
    else if (c === sep) { row.push(cell); cell = ''; } else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim() !== ''));
}

function mapHeader(header) {
  const map = {};
  header.forEach((h, i) => {
    const n = norm(h).replace(/[()]/g, '').trim();
    for (const [field, names] of Object.entries(ALIASES)) {
      if (map[field] === undefined && names.includes(n)) { map[field] = i; break; }
    }
  });
  return map;
}

const num = v => {
  if (v == null || v === '') return { ok: true, value: null };
  const r = parseNumber(typeof v === 'number' ? v : String(v).replace(/[$\s]/g, ''));
  return r.ok ? r : { ok: false };
};

/**
 * Filas (la primera es el encabezado) → { items, errors, missing }.
 * items: [{ fila, nombre, categoria, costo, precio, stock, stockMin, variantes: [nombres] }]
 * errors: [{ fila, msg }] (fila = número de fila en la planilla, contando el encabezado como 1)
 * missing: columnas obligatorias que no aparecen en el encabezado.
 */
export function parseProductRows(rows) {
  const [header = [], ...body] = rows || [];
  const map = mapHeader(header);
  const missing = ['nombre', 'precio'].filter(f => map[f] === undefined).map(f => (f === 'nombre' ? 'Nombre' : 'Precio'));
  if (missing.length) return { items: [], errors: [], missing };
  const items = [];
  const errors = [];
  const seen = new Map();
  const cell = (r, f) => (map[f] === undefined ? '' : r[map[f]]);
  body.slice(0, MAX_ROWS).forEach((r, i) => {
    const fila = i + 2;
    const nombre = String(cell(r, 'nombre') ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!nombre) { if (r.some(x => String(x ?? '').trim())) errors.push({ fila, msg: 'Falta el nombre.' }); return; }
    const precio = num(cell(r, 'precio'));
    if (!precio.ok || !(precio.value > 0)) { errors.push({ fila, msg: `"${nombre}": el precio tiene que ser un número mayor a 0.` }); return; }
    const costo = num(cell(r, 'costo'));
    if (!costo.ok || (costo.value != null && costo.value < 0)) { errors.push({ fila, msg: `"${nombre}": revisá el costo.` }); return; }
    const stock = num(cell(r, 'stock'));
    if (!stock.ok || (stock.value != null && (stock.value < 0 || !Number.isInteger(stock.value)))) { errors.push({ fila, msg: `"${nombre}": el stock tiene que ser un número entero.` }); return; }
    const min = num(cell(r, 'stockMin'));
    if (!min.ok || (min.value != null && min.value < 0)) { errors.push({ fila, msg: `"${nombre}": revisá el aviso de stock.` }); return; }
    const variantes = [...new Set(String(cell(r, 'variantes') ?? '').split(/[,;/]/).map(v => v.trim().slice(0, 40)).filter(Boolean))];
    const item = { fila, nombre, categoria: String(cell(r, 'categoria') ?? '').trim().slice(0, 40), costo: costo.value ?? 0, precio: precio.value, stock: stock.value, stockMin: min.value || null, variantes };
    const k = keyName(nombre);
    if (seen.has(k)) items[seen.get(k)] = item; // repetido en la planilla: vale la última fila
    else { seen.set(k, items.length); items.push(item); }
  });
  if (body.length > MAX_ROWS) errors.push({ fila: MAX_ROWS + 2, msg: `Se leen hasta ${MAX_ROWS} productos por vez.` });
  return { items, errors, missing: [] };
}

// Qué va a pasar: productos nuevos y existentes (por nombre) que se actualizan.
export function planImport(items, existentes) {
  const byName = new Map(existentes.map(p => [keyName(p.nombre), p]));
  return items.map(it => ({ ...it, existente: byName.get(keyName(it.nombre)) || null }));
}

// Plantilla para descargar (CSV con punto y coma: Excel en español la abre bien).
export function templateCsv() {
  const rows = [COLUMNS, ['Poncho de telar', 'Textiles', '45000', '95000', '8', '2', ''], ['Manta', 'Textiles', '30000', '65000', '', '', 'Azul, Rojo'], ['Camino de mesa', 'Textiles', '6000', '15000', '25', '5', '']];
  return '﻿' + rows.map(r => r.map(c => `"${c}"`).join(';')).join('\r\n');
}
