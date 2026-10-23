// Checklist Cyber Monday (recurso de Relab). Portado de "Checklist Cyber Monday.dc.html"
// del proyecto de Claude Design "Estrategia de oferta para Cyber Monday".
// El avance se guarda en el navegador y, si la persona ingresa con su cuenta de Relab, también
// en su cuenta (cifrado, /api/state/checklist-cyber-2026) para verlo desde cualquier dispositivo.
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './ds/tokens/fonts.css';
import './ds/tokens/colors.css';
import './ds/tokens/typography.css';
import './ds/tokens/spacing.css';
import './app.css';
import './checklist.css';
import logoWhite from './ds/assets/logo-white.png';
import logoPetrol from './ds/assets/logo-petrol.png';
import { Footer } from './Footer.jsx';
import LoginModal from './LoginModal.jsx';
import { api } from './lib/api.js';

const SECTIONS = [
  { short: 'Tienda', title: 'Prepará tu tienda online', items: [
    'Revisar que la tienda funcione correctamente desde el celular y la computadora.',
    'Verificar que cada producto o servicio tenga precio, descripción e imágenes actualizadas.',
    'Probar enlaces de compra, botones, carrito y proceso de pago.',
    'Actualizar el stock disponible y los tiempos de entrega.',
    'Revisar que los datos de contacto y canales de atención estén visibles.',
    'Verificar que las políticas de cambios, devoluciones y cancelaciones estén claras.',
    'Comprobar que los medios de pago funcionen correctamente.'] },
  { short: 'Promociones', title: 'Definí promociones y beneficios', ideas: true, items: [
    'Elegir qué productos o servicios van a participar.',
    'Calcular el margen de ganancia antes de establecer descuentos.',
    'Comparar el precio habitual con el precio promocional y verificar que la comunicación sea clara.',
    'Evaluar descuentos por porcentaje o monto fijo.',
    'Analizar si conviene ofrecer envío gratis desde un monto mínimo.',
    'Consultar con el banco o la plataforma de pagos la disponibilidad y el costo de 3, 6 o más cuotas sin interés.',
    'Evaluar promociones 2x1, combos o packs de productos.',
    'Considerar un regalo, muestra o beneficio adicional por compra.',
    'Crear una promoción exclusiva para clientes frecuentes, si tiene sentido para el negocio.',
    'Definir vigencia, stock o cupos disponibles y condiciones de la oferta.'] },
  { short: 'Comunicación', title: 'Prepará la comunicación y las ventas', items: [
    'Diseñar banners y piezas gráficas para la tienda online.',
    'Preparar publicaciones, historias, reels y anuncios.',
    'Organizar una lista de clientes y enviar comunicaciones solo a contactos que hayan autorizado recibirlas.',
    'Preparar respuestas a preguntas frecuentes sobre precios, pagos, stock y envíos.',
    'Configurar mensajes automáticos para consultas y recuperación de carritos, cuando la plataforma lo permita.',
    'Agregar enlaces directos a los productos o servicios promocionados.',
    'Programar las publicaciones y definir quién atenderá las consultas.',
    'Preparar un mensaje de cierre de la promoción y agradecimiento.'] },
  { short: 'Logística', title: 'Organizá la logística y la operación', items: [
    'Calcular el stock o los cupos disponibles y no comprometer ventas que no se puedan cumplir.',
    'Coordinar con proveedores y servicios de logística.',
    'Definir plazos de preparación y entrega.',
    'Calcular el costo real de cada envío bonificado.',
    'Organizar los pedidos por estado: pendiente, pagado, preparado y enviado.',
    'Revisar la capacidad de atención ante un aumento de consultas.',
    'Definir cómo actuar ante falta de stock, demoras o inconvenientes de pago.'] },
  { short: 'Resultados', title: 'Medí los resultados', items: [
    'Registrar las ventas previas al evento como punto de comparación.',
    'Definir una meta de facturación y cantidad de ventas.',
    'Medir visitas a la tienda y tasa de conversión.',
    'Identificar los productos o servicios más vendidos.',
    'Calcular ticket promedio y margen de ganancia.',
    'Registrar la inversión en publicidad y los resultados obtenidos.',
    'Consultar a los compradores por su experiencia y detectar oportunidades de recompra.'] },
];
const FINAL = [
  'El descuento se calculó sobre un precio habitual real y verificable.',
  'El precio final y las condiciones de la promoción son claros.',
  'Los costos de financiación, comisiones y envío están contemplados.',
  'La promoción tiene fecha de inicio y finalización.',
  'El stock o los cupos disponibles son suficientes.',
  'Los anuncios llevan directamente a la oferta.',
  'La promoción no compromete la rentabilidad del negocio.',
];
const IDEAS = [
  { type: 'Productos físicos', tags: ['Descuento', 'Envío gratis desde cierto monto', 'Combos', 'Cuotas disponibles', 'Regalo con la compra'] },
  { type: 'Cursos y productos digitales', tags: ['Precio especial por tiempo limitado', 'Pack de cursos', 'Material descargable de regalo', 'Consulta grupal'] },
  { type: 'Servicios profesionales', tags: ['Descuento en la primera contratación', 'Diagnóstico bonificado', 'Paquete de sesiones', 'Servicio adicional', 'Reserva anticipada'] },
];
const STATUSES = [
  { label: 'Pendiente', bg: 'var(--st-neutral-500)' },
  { label: 'En curso', bg: 'var(--st-warning)' },
  { label: 'Listo', bg: 'var(--st-success)' },
];
const LINKS = { ig: 'strelacionespublicas', li: 'https://www.linkedin.com/in/licstellatorres/', web: 'strelacionespublicas.com.ar' };
const KEY = 'st-checklist-cyber-2026';
const RESOURCE = 'checklist-cyber-2026';
const blankPlan = () => Array.from({ length: 7 }, () => ({ task: '', resp: '', date: '', status: 0 }));
const normalize = s => ({ checks: {}, biz: '', rev: '', camp: '', ...s, plan: s?.plan || blankPlan() });
const initial = () => {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) return normalize(s); } catch (e) {}
  return normalize({});
};
const hasProgress = s => Object.values(s.checks).some(Boolean) || !!(s.biz || s.rev || s.camp) || s.plan.some(r => r.task || r.resp || r.date || r.status);

const label = { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, letterSpacing: '0.14em', color: 'var(--st-coral)' };
const field = { height: 44, padding: '0 14px', border: '1.5px solid var(--st-neutral-300)', borderRadius: 8, background: '#fff', fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--st-gris-oscuro)', outline: 'none' };
const planField = { height: 42, padding: '0 12px', border: '1.5px solid var(--st-neutral-200)', borderRadius: 8, fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--st-gris-oscuro)', outline: 'none', minWidth: 0 };
const h2 = { margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(24px,3.4vw,32px)', lineHeight: 1.15, color: 'var(--st-petroleo)', letterSpacing: '-0.01em' };
const Tick = ({ on }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: on ? 1 : 0 }}><path d="m5 12 5 5 9-10" /></svg>
);
const Ico = ({ children, color = 'var(--st-coral)' }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', marginTop: 2 }}>{children}</svg>
);

function Checklist() {
  const [st, setSt] = useState(initial);
  const [user, setUser] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveT = useRef(null);
  const ready = useRef(false); // no subir nada hasta saber si hay avance guardado en la cuenta

  // Sesión de Relab: si hay avance en la cuenta se usa ese; si no, se sube el de este navegador.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('login')) window.history.replaceState(null, '', window.location.pathname);
    api.me().then(async me => {
      if (!me.user) return;
      setUser(me.user);
      try {
        const { data } = await api.getState(RESOURCE);
        if (data) setSt(normalize(data));
        else if (hasProgress(initial())) await api.saveState(RESOURCE, initial());
        setSaved(true);
      } catch (e) {}
      ready.current = true;
    });
    return () => clearTimeout(saveT.current);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
    if (!user || !ready.current) return;
    setSaved(false);
    clearTimeout(saveT.current);
    saveT.current = setTimeout(() => api.saveState(RESOURCE, st).then(() => setSaved(true)).catch(() => {}), 800);
  }, [st, user]);

  const logout = () => { api.logout().catch(() => {}); setUser(null); ready.current = false; };

  const c = st.checks;
  const toggle = k => setSt(s => ({ ...s, checks: { ...s.checks, [k]: !s.checks[k] } }));
  const setPlan = (i, f, v) => setSt(s => ({ ...s, plan: s.plan.map((r, j) => (j === i ? { ...r, [f]: v } : r)) }));
  const resetAll = () => { if (window.confirm('¿Borrar todo el avance?')) setSt({ checks: {}, biz: '', rev: '', camp: '', plan: blankPlan() }); };

  let done = 0; let total = 0;
  const sections = SECTIONS.map((sec, si) => {
    const items = sec.items.map((text, ii) => { const k = `s${si}-${ii}`; return { text, k, on: !!c[k] }; });
    const d = items.filter(i => i.on).length; done += d; total += items.length;
    return { ...sec, num: si + 1, id: 'sec' + (si + 1), items, done: d, total: items.length, complete: d === items.length };
  });
  const finalItems = FINAL.map((text, i) => { const k = `f-${i}`; return { text, k, on: !!c[k] }; });
  const finalDone = finalItems.filter(i => i.on).length;
  done += finalDone; total += FINAL.length;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="cl-page" style={{ minHeight: '100vh', fontFamily: 'var(--font-body)', color: 'var(--st-gris-oscuro)', background: 'var(--st-gris-claro)' }}>
      <header style={{ background: 'var(--st-petroleo)', color: '#fff', padding: '40px 24px 56px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 40 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <img src={logoWhite} alt="ST Relaciones Públicas" style={{ height: 44, width: 'auto', display: 'block' }} />
              <a data-noprint href="/" style={{ fontFamily: 'var(--font-data)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--st-celeste-300)', textDecoration: 'none', borderLeft: '1px solid var(--border-inverse)', paddingLeft: 16 }}>un recurso <strong style={{ color: '#fff', fontWeight: 800 }}>relab</strong></a>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, letterSpacing: '0.14em', color: 'var(--st-celeste)' }}>GUÍA PRÁCTICA PARA EMPRENDEDORES</div>
              <div data-noprint>
                {user ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-display)', fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>{user.name}</span>
                    <button className="cl-btn-ghost" onClick={logout} style={{ height: 32, padding: '0 12px', border: '1px solid var(--border-inverse)', borderRadius: 999, background: 'transparent', color: '#fff', fontFamily: 'var(--font-display)', fontSize: 12, cursor: 'pointer' }}>Salir</button>
                  </span>
                ) : (
                  <button className="cl-btn-coral" onClick={() => setLoginOpen(true)} style={{ height: 36, padding: '0 16px', border: 'none', borderRadius: 999, background: 'var(--st-coral)', color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Guardar mi avance</button>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 40, alignItems: 'end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, letterSpacing: '0.2em', color: 'var(--st-coral)' }}>CHECKLIST</div>
              <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(48px,8vw,88px)', lineHeight: 0.95, letterSpacing: '-0.03em' }}>Cyber<br />Monday</h1>
              <p style={{ margin: 0, fontSize: 19, lineHeight: 1.5, color: 'var(--st-celeste-100)', maxWidth: 440, textWrap: 'pretty' }}>Prepará tu tienda, diseñá promociones rentables y organizá tus ventas.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, background: 'var(--st-petroleo-700)', borderRadius: 12, padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, letterSpacing: '0.1em', color: 'var(--st-celeste)' }}>TU AVANCE</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 44, lineHeight: 1 }}>{pct}<span style={{ fontSize: 22 }}>%</span></div>
              </div>
              <div style={{ height: 10, borderRadius: 999, background: 'var(--st-petroleo-900)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: pct + '%', background: 'var(--st-coral)', borderRadius: 999, transition: 'width .3s ease' }} />
              </div>
              <div style={{ fontSize: 15, color: 'var(--st-celeste-100)' }}>{done} de {total} tareas completadas</div>
              <div data-noprint style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: user ? 'var(--st-celeste)' : 'var(--st-celeste-100)' }}>
                {user ? (
                  <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>
                    <span>{saved ? 'Guardado en tu cuenta' : 'Guardando en tu cuenta…'} · {user.name}</span></>
                ) : (
                  <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 0 0 4.5 13 3.5 3.5 0 0 0 6 19z" /></svg>
                    <span>Tu avance está solo en este navegador</span></>
                )}
              </div>
              <div data-noprint style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {!user && (
                  <button onClick={() => setLoginOpen(true)} style={{ flexBasis: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, height: 48, border: 'none', borderRadius: 8, background: '#fff', color: 'var(--st-petroleo)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 0 0 4.5 13 3.5 3.5 0 0 0 6 19z" /><path d="M12 16v-5" /><path d="m9.5 13.5 2.5-2.5 2.5 2.5" /></svg>
                    Guardar en mi cuenta
                  </button>
                )}
                <button className="cl-btn-coral" onClick={() => window.print()} style={{ flex: 1, minWidth: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, height: 48, border: 'none', borderRadius: 8, background: 'var(--st-coral)', color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>
                  Descargar PDF
                </button>
                <button className="cl-btn-ghost" onClick={resetAll} style={{ height: 48, padding: '0 18px', border: '1.5px solid var(--st-petroleo-500)', borderRadius: 8, background: 'transparent', color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Reiniciar</button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px 80px', display: 'flex', flexDirection: 'column', gap: 48 }}>
        <div data-block style={{ marginTop: -28, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={label}>OBJETIVO</div>
            <div style={{ fontSize: 16, lineHeight: 1.5, textWrap: 'pretty' }}>Llegar al evento con la tienda lista, una oferta clara y la operación organizada.</div>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={label}>PARA QUIÉN</div>
            <div style={{ fontSize: 16, lineHeight: 1.5, textWrap: 'pretty' }}>Emprendedores, comercios, tiendas online y prestadores de servicios.</div>
          </div>
          <div style={{ background: 'var(--st-celeste-100)', borderRadius: 12, padding: '20px 22px', boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ ...label, color: 'var(--st-petroleo)' }}>IDEA CLAVE</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, lineHeight: 1.4, color: 'var(--st-petroleo)', textWrap: 'pretty' }}>No se trata solo de vender más: se trata de vender con rentabilidad.</div>
          </div>
        </div>

        <div data-block style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6, color: 'var(--st-neutral-600)', maxWidth: 680, textWrap: 'pretty' }}>Usá esta guía para revisar cada área de tu negocio. Marcá las tareas completadas y anotá qué necesitás resolver antes de lanzar la campaña.{' '}
            {user ? 'Tu avance se guarda en tu cuenta de Relab: lo ves desde cualquier dispositivo.' : <>Tu avance se guarda en este navegador. <a data-noprint href="#" onClick={e => { e.preventDefault(); setLoginOpen(true); }}>Ingresá con Google</a> para tenerlo también en el celular y la compu.</>}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
            {[['Nombre del negocio', 'biz', 'text', 'Mi tienda'], ['Fecha de revisión', 'rev', 'date'], ['Fecha de la campaña', 'camp', 'date']].map(([lab, key, type, ph]) => (
              <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, color: 'var(--st-petroleo)' }}>{lab}</span>
                <input className="cl-input" type={type} value={st[key]} placeholder={ph} onChange={e => setSt(s => ({ ...s, [key]: e.target.value }))} style={field} />
              </label>
            ))}
          </div>
        </div>

        <div data-noprint data-sticky style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--st-gris-claro)', padding: '10px 0', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1px solid var(--st-neutral-200)' }}>
        <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, lineHeight: 1, color: 'var(--st-petroleo)', minWidth: 52 }}>{pct}%</span>
          <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--st-neutral-200)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: pct + '%', background: pct === 100 ? 'var(--st-success)' : 'var(--st-coral)', borderRadius: 999, transition: 'width .3s ease' }} />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, color: 'var(--st-neutral-600)', whiteSpace: 'nowrap' }}>{done}/{total} tareas{user && <span style={{ color: 'var(--st-success)' }}>{saved ? ' · guardado' : ' · en tu cuenta'}</span>}</span>
        </div>
        <nav aria-label="Secciones" style={{ display: 'flex', gap: 8, overflowX: 'auto' }} className="cl-nav">
          {sections.map(s => (
            <a key={s.id} href={'#' + s.id} style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 999, background: s.complete ? 'var(--st-petroleo)' : '#fff', color: s.complete ? '#fff' : 'var(--st-petroleo)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
              <span>{s.num}. {s.short}</span><span style={{ opacity: 0.75 }}>{s.done}/{s.total}</span>
            </a>
          ))}
        </nav>
        </div>

        {sections.map(s => (
          <section key={s.id} id={s.id} style={{ display: 'flex', flexDirection: 'column', gap: 20, scrollMarginTop: 72 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', borderBottom: '3px solid var(--st-petroleo)', paddingBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 44, lineHeight: 1, color: 'var(--st-coral)' }}>0{s.num}</span>
                <h2 style={h2}>{s.title}</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 120, height: 8, borderRadius: 999, background: 'var(--st-neutral-200)', overflow: 'hidden' }}><div style={{ height: '100%', width: Math.round((s.done / s.total) * 100) + '%', background: s.complete ? 'var(--st-success)' : 'var(--st-coral)', transition: 'width .3s ease' }} /></div>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--st-petroleo)', minWidth: 44, textAlign: 'right' }}>{s.done}/{s.total}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {s.items.map(it => (
                <button key={it.k} data-block className="cl-item" onClick={() => toggle(it.k)} aria-pressed={it.on} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, width: '100%', textAlign: 'left', padding: '14px 18px', borderRadius: 10, border: `1.5px solid ${it.on ? 'var(--st-celeste-300)' : 'var(--st-neutral-200)'}`, background: it.on ? 'var(--st-celeste-100)' : '#fff', cursor: 'pointer', font: 'inherit', transition: 'background .15s ease, border-color .15s ease' }}>
                  <span style={{ flex: 'none', width: 26, height: 26, marginTop: 1, borderRadius: 6, border: `2px solid ${it.on ? 'var(--st-petroleo)' : 'var(--st-neutral-400)'}`, background: it.on ? 'var(--st-petroleo)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s ease' }}><Tick on={it.on} /></span>
                  <span style={{ fontSize: 17, lineHeight: 1.5, color: it.on ? 'var(--st-neutral-600)' : 'var(--st-gris-oscuro)', textDecoration: it.on ? 'line-through' : 'none', textWrap: 'pretty' }}>{it.text}</span>
                </button>
              ))}
            </div>
            {s.ideas && (
              <div data-block style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: 'var(--st-petroleo)' }}>Ideas para inspirarte</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
                  {IDEAS.map(idea => (
                    <div key={idea.type} style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--st-neutral-200)', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--st-coral)' }}>{idea.type}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {idea.tags.map(tag => <span key={tag} style={{ padding: '5px 10px', borderRadius: 999, background: 'var(--st-celeste-100)', color: 'var(--st-petroleo)', fontSize: 14, lineHeight: 1.3 }}>{tag}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: 'var(--st-warning-bg)', borderRadius: 12, padding: '18px 20px' }}>
                  <Ico color="var(--st-petroleo)"><circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 16.5v.01" /></Ico>
                  <div style={{ fontSize: 16, lineHeight: 1.55, color: 'var(--st-petroleo)', textWrap: 'pretty' }}><strong>Importante:</strong> antes de anunciar cuotas, descuentos o envíos bonificados, confirmá las condiciones, comisiones, costos y alcance con tus proveedores. No todas las promociones son convenientes para todos los negocios.</div>
                </div>
              </div>
            )}
          </section>
        ))}

        <section id="plan" style={{ display: 'flex', flexDirection: 'column', gap: 20, scrollMarginTop: 72 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '3px solid var(--st-petroleo)', paddingBottom: 14 }}>
            <h2 style={h2}>Plan de acción: del checklist a la ejecución</h2>
            <p style={{ margin: 0, fontSize: 16, color: 'var(--st-neutral-600)' }}>Completá las tareas prioritarias para que la guía se convierta en un plan de trabajo.</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {st.plan.map((row, i) => (
              <div key={i} data-block style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, alignItems: 'center', background: '#fff', border: '1px solid var(--st-neutral-200)', borderRadius: 10, padding: 12 }}>
                <input className="cl-input" value={row.task} onChange={e => setPlan(i, 'task', e.target.value)} placeholder="Tarea prioritaria" aria-label={`Tarea ${i + 1}`} style={planField} />
                <input className="cl-input" value={row.resp} onChange={e => setPlan(i, 'resp', e.target.value)} placeholder="Responsable" aria-label={`Responsable ${i + 1}`} style={planField} />
                <input className="cl-input" type="date" value={row.date} onChange={e => setPlan(i, 'date', e.target.value)} aria-label={`Fecha ${i + 1}`} style={planField} />
                <div style={{ display: 'flex', gap: 4, background: 'var(--st-neutral-100)', borderRadius: 8, padding: 3 }}>
                  {STATUSES.map((s2, si) => (
                    <button key={s2.label} onClick={() => setPlan(i, 'status', si)} style={{ flex: 1, height: 36, border: 'none', borderRadius: 6, background: row.status === si ? s2.bg : 'transparent', color: row.status === si ? '#fff' : 'var(--st-neutral-600)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', padding: '0 6px' }}>{s2.label}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="control" style={{ display: 'flex', flexDirection: 'column', gap: 20, background: 'var(--st-petroleo)', borderRadius: 16, padding: 'clamp(24px,4vw,40px)', scrollMarginTop: 72 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <h2 style={{ ...h2, color: '#fff', letterSpacing: 0 }}>Control final antes de publicar</h2>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--st-celeste)' }}>{finalDone}/{FINAL.length} · {finalDone === FINAL.length ? 'Listo para publicar' : 'Revisá antes de lanzar'}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {finalItems.map(it => (
              <button key={it.k} data-block onClick={() => toggle(it.k)} aria-pressed={it.on} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, width: '100%', textAlign: 'left', padding: '14px 18px', borderRadius: 10, border: `1.5px solid ${it.on ? 'var(--st-celeste)' : 'var(--st-petroleo-600)'}`, background: it.on ? 'var(--st-petroleo-600)' : 'var(--st-petroleo-700)', cursor: 'pointer', font: 'inherit', transition: 'background .15s ease' }}>
                <span style={{ flex: 'none', width: 26, height: 26, marginTop: 1, borderRadius: 6, border: `2px solid ${it.on ? 'var(--st-coral)' : 'var(--st-celeste-300)'}`, background: it.on ? 'var(--st-coral)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Tick on={it.on} /></span>
                <span style={{ fontSize: 17, lineHeight: 1.5, color: '#fff', textWrap: 'pretty' }}>{it.text}</span>
              </button>
            ))}
          </div>
        </section>

        <div data-block style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20, alignItems: 'start', background: 'var(--st-coral)', color: '#fff', borderRadius: 16, padding: 'clamp(24px,4vw,36px)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 56, lineHeight: 0.8 }}>“</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, letterSpacing: '0.14em' }}>MI REGLA PARA CYBER MONDAY</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(19px,2.4vw,24px)', lineHeight: 1.35, textWrap: 'pretty' }}>Una promoción atractiva no siempre es una promoción rentable. Antes de publicarla, calculá cuánto te queda después de descuentos, comisiones, logística, impuestos y publicidad.</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', paddingTop: 24, borderTop: '1px solid var(--st-neutral-300)' }}>
          <img src={logoPetrol} alt="ST Relaciones Públicas" style={{ height: 36, width: 'auto', display: 'block' }} />
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13, letterSpacing: '0.08em', color: 'var(--st-neutral-600)' }}>MARKETING ESTRATÉGICO PARA EMPRENDEDORES Y PYMES</div>
          <div style={{ flexBasis: '100%', display: 'flex', flexDirection: 'column', gap: 14, background: '#fff', border: '1px solid var(--st-neutral-200)', borderRadius: 12, padding: '20px 22px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: 'var(--st-petroleo)' }}>Consultoría en Marketing y Negocios</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><Ico><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></Ico><span style={{ fontSize: 16, lineHeight: 1.45 }}>Consultoría en Marketing, RR.PP. e IA</span></div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><Ico><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 7h1" /><path d="M14 7h1" /><path d="M9 11h1" /><path d="M14 11h1" /><path d="M10 21v-4h4v4" /></Ico><span style={{ fontSize: 16, lineHeight: 1.45 }}>Capacitamos a tu equipo en ventas, marketing e IA</span></div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><Ico><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M2 20h20" /></Ico><span style={{ fontSize: 16, lineHeight: 1.45 }}>Cursos online</span></div>
            </div>
          </div>
          <div style={{ flexBasis: '100%', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a className="cl-social" href={'https://instagram.com/' + LINKS.ig} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 16px', borderRadius: 999, background: 'var(--st-petroleo)', color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5v.01" /></svg>
              <span>@{LINKS.ig}</span>
            </a>
            <a className="cl-social" href={LINKS.li} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 16px', borderRadius: 999, background: 'var(--st-petroleo)', color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 10v7" /><path d="M8 7v.01" /><path d="M12 17v-4a2 2 0 0 1 4 0v4" /><path d="M12 10v7" /></svg>
              <span>LinkedIn</span>
            </a>
            <a className="cl-social-outline" href={'https://' + LINKS.web} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 16px', borderRadius: 999, border: '1.5px solid var(--st-petroleo)', color: 'var(--st-petroleo)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18" /></svg>
              <span>{LINKS.web}</span>
            </a>
          </div>
        </div>
      </main>
      <div data-noprint><Footer /></div>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onLogin={() => api.login()}
        description="Guardá tu avance del checklist y retomalo desde cualquier dispositivo. Funciona igual sin cuenta." />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Checklist />);
