// Forma del estado del Kit feriante: { checks, ventas, calc, roi }. Es la misma que se guarda en la
// cuenta (resource_state 'kit-feriante') y en el navegador; no cambiarla sin migración.

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const blankProduct = () => ({ id: newId(), nombre: '', costo: '', precio: '', unid: '' });
export const blankCalc = () => ({ fijos: {}, productos: [blankProduct()], comision: '3', pctDigital: '70' });
export const blankRoi = () => ({ dias: '1' });

export const normalize = s => ({
  checks: s?.checks && typeof s.checks === 'object' ? s.checks : {},
  ventas: Array.isArray(s?.ventas) ? s.ventas.filter(v => v && v.id != null && Number.isFinite(v.monto) && Number.isFinite(v.ts)) : [],
  calc: { ...blankCalc(), ...(s?.calc || {}), productos: s?.calc?.productos?.length ? s.calc.productos : [blankProduct()] },
  roi: { ...blankRoi(), ...(s?.roi || {}) },
});
export const emptyState = () => normalize(null);

export const hasData = s => Object.values(s.checks).some(Boolean) || s.ventas.length > 0
  || Object.values(s.calc.fijos).some(Boolean) || s.calc.productos.some(p => p.nombre || p.costo || p.precio || p.unid)
  || Object.entries(s.roi).some(([k, v]) => k !== 'dias' && v);
