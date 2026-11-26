// Ejemplo de "Mi sueldo y rentabilidad" (botón "Ver ejemplo"). Resultado esperado: ganancia neta
// $28.000, reinversión 40% = $11.200, disponible $16.800, ingreso personal total $70.800.
export const EJEMPLO_SUELDO = {
  hSueldo: '640000', hDias: '20', hHoras: '8', // 160 h al mes → $4.000 la hora
  jPrep: '1', jTras: '1', jArmado: '0,5', jVenta: '3', jDesarmado: '0,5', jOtras: '0', // 6 h → $24.000
  jCant: '1',
  bVentas: '150000',
  cMp: '60000', cPack: '0', cMo: '30000', cOtros: '0',
  gTransp: '5000', gAlq: '3000', gAlim: '0', gCom: '0', gImp: '0', gOtros: '0',
  reinv: '40',
};
