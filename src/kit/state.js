// Forma del estado del Kit feriante: { checks, ventas, calc, roi, sueldo, propios }. Es la misma que se guarda en la
// cuenta (resource_state 'kit-feriante') y en el navegador; no cambiarla sin migración.

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const blankProduct = () => ({ id: newId(), nombre: '', costo: '', precio: '', unid: '' });
export const blankCalc = () => ({ fijos: {}, productos: [blankProduct()], comision: '3', pctDigital: '70' });
export const blankRoi = () => ({ dias: '1' });
// "Mi sueldo y rentabilidad": f = campos tal cual (texto), hist = jornadas guardadas.
export const blankSueldo = () => ({ f: {}, hist: [] });
export const MAX_HIST = 40; // tope de jornadas guardadas: cada una ocupa ~0,7 KB y el estado completo tiene un límite de 100 KB
// Tareas propias del checklist: { id, grp (bloque del checklist), txt }. Su marca va en checks['p-' + id].
export const MAX_PROPIOS = 60;
const okPropio = p => p && typeof p.id === 'string' && typeof p.grp === 'string' && typeof p.txt === 'string' && p.txt.trim();
const okHist = h => h && typeof h.id === 'string' && h.f && typeof h.f === 'object' && h.r && typeof h.r === 'object';

export const normalize = s => ({
  checks: s?.checks && typeof s.checks === 'object' ? s.checks : {},
  ventas: Array.isArray(s?.ventas) ? s.ventas.filter(v => v && v.id != null && Number.isFinite(v.monto) && Number.isFinite(v.ts)) : [],
  calc: { ...blankCalc(), ...(s?.calc || {}), productos: s?.calc?.productos?.length ? s.calc.productos : [blankProduct()] },
  roi: { ...blankRoi(), ...(s?.roi || {}) },
  sueldo: {
    f: s?.sueldo?.f && typeof s.sueldo.f === 'object' && !Array.isArray(s.sueldo.f) ? s.sueldo.f : {},
    hist: Array.isArray(s?.sueldo?.hist) ? s.sueldo.hist.filter(okHist).slice(0, MAX_HIST) : [],
  },
  propios: Array.isArray(s?.propios) ? s.propios.filter(okPropio).slice(0, MAX_PROPIOS) : [],
});
export const emptyState = () => normalize(null);

export const hasData = s => Object.values(s.checks).some(Boolean) || s.ventas.length > 0
  || Object.values(s.calc.fijos).some(Boolean) || s.calc.productos.some(p => p.nombre || p.costo || p.precio || p.unid)
  || Object.entries(s.roi).some(([k, v]) => k !== 'dias' && v)
  || Object.values(s.sueldo.f).some(v => v !== '' && v != null) || s.sueldo.hist.length > 0 || s.propios.length > 0;
