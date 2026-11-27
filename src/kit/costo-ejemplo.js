// Ejemplo de "Costo y precio": el lote de velas de la capacitación (20 velas).
// Cera: compró 2 kg a $40.000 y usó 1 kg ($20.000). Esencias $8.000, pabilos $2.000, envases $15.000,
// packaging $5.000, 5 h de trabajo a $4.000 ($20.000) y el 10% de $100.000 de gastos del taller ($10.000).
// Costo del lote $80.000 → $4.000 por vela. Feria: $30.000 de gastos para 20 unidades → $1.500 por unidad.
// Costo integral $5.500; con 30% de margen y 5% de comisión, el precio es $8.461,54.
export const EJEMPLO_COSTO = id => ({
  id,
  nombre: 'Vela de soja',
  insumos: [
    { id: `${id}-1`, nombre: 'Cera de soja', pagado: '40000', compra: '2000', usado: '1000' },
    { id: `${id}-2`, nombre: 'Esencias', pagado: '8000', compra: '', usado: '' },
    { id: `${id}-3`, nombre: 'Pabilos', pagado: '2000', compra: '', usado: '' },
  ],
  envases: '15000',
  pack: '5000',
  moHoras: '5',
  moValor: '4000',
  indMes: '100000',
  indPct: '10',
  unidades: '20',
  gFeria: '30000',
  uFeria: '20',
  metodo: 'margen',
  pct: '30',
  com: '5',
});
