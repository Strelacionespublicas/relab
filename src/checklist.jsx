// Checklist Cyber Monday (recurso de Relab). Portado de "Checklist Cyber Monday.dc.html"
// del proyecto de Claude Design "Estrategia de oferta para Cyber Monday", con el formato del Kit
// feriante: "Tu checklist" con las siete áreas por momento (prepará, lanzá, medí) y cada área en su
// pantalla según el hash, con un ejemplo que sigue a un mismo caso (Vale, tienda de velas). Usa las
// clases del kit (src/kit-feriante.css). El avance se guarda en el navegador y, con cuenta de Relab,
// también en su cuenta (cifrado, /api/state/checklist-cyber-2026). Las claves de los ítems (s0-0, f-0…)
// y de los campos no cambian: son las del avance que la gente ya guardó.
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './ds/tokens/fonts.css';
import './ds/tokens/colors.css';
import './ds/tokens/typography.css';
import './ds/tokens/spacing.css';
import './app.css';
import './kit-feriante.css';
import './checklist.css';
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
const normalize = s => ({ checks: {}, biz: '', rev: '', camp: '', ...s, plan: [...(s?.plan || []), ...blankPlan()].slice(0, Math.max(7, s?.plan?.length || 0)) });
const initial = () => {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) return normalize(s); } catch (e) {}
  return normalize({});
};
const hasProgress = s => Object.values(s.checks).some(Boolean) || !!(s.biz || s.rev || s.camp) || s.plan.some(r => r.task || r.resp || r.date || r.status);

// Fechas oficiales de la CACE para 2026 (cybermonday.com.ar): del lunes 2 al miércoles 4 de noviembre.
const CYBER_START = new Date(2026, 10, 2);
const CYBER_END = new Date(2026, 10, 5);
const countdown = () => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((CYBER_START - today) / 86400000);
  if (days > 1) return `Faltan ${days} días para el Cyber Monday (2 al 4 de noviembre)`;
  if (days === 1) return 'El Cyber Monday arranca mañana (2 al 4 de noviembre)';
  if (now < CYBER_END) return '¡El Cyber Monday es hoy! (2 al 4 de noviembre)';
  return 'El Cyber Monday 2026 ya pasó: usá el checklist para tu próxima campaña';
};

const Svg = ({ children }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
const ICONS = {
  inicio: <Svg><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" /></Svg>,
  tienda: <Svg><path d="M3 9h18l-1.5-5h-15z" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" /></Svg>,
  promos: <Svg><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.5" /></Svg>,
  comunicacion: <Svg><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></Svg>,
  logistica: <Svg><path d="M1 4h13v11H1z" /><path d="M14 8h4l3 3v4h-7" /><circle cx="5.5" cy="18" r="2" /><circle cx="17.5" cy="18" r="2" /></Svg>,
  plan: <Svg><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 3v2h6V3" /><path d="m8.5 12 2 2 4-4" /><path d="M8.5 17h7" /></Svg>,
  control: <Svg><path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5z" /><path d="m9 12 2 2 4-4" /></Svg>,
  resultados: <Svg><path d="M3 3v18h18" /><path d="M7 16v-5" /><path d="M12 16V8" /><path d="M17 16V5" /></Svg>,
  menu: <Svg><path d="M4 6h16M4 12h16M4 18h16" /></Svg>,
  pdf: <Svg><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></Svg>,
};
const Tick = () => <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>;

const MOMENTS = [
  ['prepara', 'Prepará', 'Tienda, oferta, comunicación y logística'],
  ['lanza', 'Lanzá', 'Organizá el trabajo y revisá antes de publicar'],
  ['medi', 'Medí', 'Sabé si la campaña te sumó'],
];
const momentLabel = Object.fromEntries(MOMENTS.map(m => [m[0], m[1]]));

// Las áreas en el orden del recorrido. `sec` apunta a SECTIONS (sus ítems guardan s{sec}-{n}).
const AREAS = [
  { id: 'tienda', sec: 0, moment: 'prepara', icon: 'tienda', desc: 'Que todo funcione: celular, precios, stock, pagos y políticas.',
    para: ['Que nadie abandone la compra por un error.', 'Llegar con precios, stock y pagos al día.'],
    ejemplo: 'Vale compra en su propia tienda desde el celular y descubre que una billetera no carga en el pago. Lo arregla el jueves, no el lunes a la mañana con el evento en marcha.' },
  { id: 'promociones', sec: 1, moment: 'prepara', icon: 'promos', desc: 'Qué ofrecer sin regalar el margen: descuentos, cuotas, combos y envíos.',
    para: ['Elegir una oferta atractiva que siga siendo rentable.', 'Definir condiciones claras: vigencia, stock y alcance.'],
    ejemplo: 'Vale calcula su margen antes de elegir: un 30% de descuento la dejaba casi sin ganancia. Arma un combo de tres velas con envío gratis desde un monto mínimo, y gana más por venta.' },
  { id: 'comunicacion', sec: 2, moment: 'prepara', icon: 'comunicacion', desc: 'Piezas, mensajes y respuestas listas antes de que lleguen las consultas.',
    para: ['Que la oferta se vea y se entienda.', 'Responder rápido sin improvisar.'],
    ejemplo: 'Vale prepara historias con cuenta regresiva, deja respuestas guardadas para “¿hacen envíos?” y solo les escribe a los clientes que aceptaron recibir novedades.' },
  { id: 'logistica', sec: 3, moment: 'prepara', icon: 'logistica', desc: 'Stock, envíos y pedidos para cumplir todo lo que vendas.',
    para: ['No vender lo que no podés entregar.', 'Tener un plan si algo falla.'],
    ejemplo: 'Vale cuenta su stock real y limita el combo a 40 unidades, con “hasta agotar stock” bien visible. Prefiere cortar antes que demorar pedidos.' },
  { id: 'plan', moment: 'lanza', icon: 'plan', desc: 'Las tareas prioritarias con responsable, fecha y estado.',
    para: ['Pasar del checklist a la acción.', 'Saber quién hace qué y para cuándo.'],
    ejemplo: 'Vale anota “Banner del inicio · Vale · jueves · En curso”. Con siete tareas claras, el lunes solo se dedica a vender y atender.' },
  { id: 'control', moment: 'lanza', icon: 'control', desc: 'La última revisión antes de publicar la oferta.',
    para: ['Evitar promociones engañosas o que te hagan perder plata.', 'Publicar con todo verificado.'],
    ejemplo: 'Antes de publicar, Vale revisa que el precio tachado sea el que cobraba de verdad en octubre. Si no, el descuento no es real y le juega en contra.' },
  { id: 'resultados', sec: 4, moment: 'medi', icon: 'resultados', desc: 'Metas, ventas, conversión y aprendizajes para la próxima.',
    para: ['Saber si el Cyber Monday realmente te sumó.', 'Aprender qué repetir y qué cambiar.'],
    ejemplo: 'Vale anota cuánto vende en una semana normal. Así, el jueves compara con las ventas del evento y sabe si el Cyber Monday le sumó o solo adelantó compras.' },
];
const areaById = id => AREAS.find(a => a.id === id);
const fromHash = () => (areaById(location.hash.slice(1)) ? location.hash.slice(1) : null);
const sectionKeys = si => SECTIONS[si].items.map((_, ii) => `s${si}-${ii}`);
const FINAL_KEYS = FINAL.map((_, i) => `f-${i}`);
const areaKeys = a => (a.id === 'control' ? FINAL_KEYS : a.sec != null ? sectionKeys(a.sec) : []);
const ALL_KEYS = AREAS.flatMap(areaKeys);

function Checklist() {
  const [st, setSt] = useState(initial);
  const [view, setView] = useState(fromHash); // null = Tu checklist
  const [menu, setMenu] = useState(false);
  const [user, setUser] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveT = useRef(null);
  const ready = useRef(false); // no subir nada hasta saber si hay avance guardado en la cuenta

  // Sesión de Relab: si hay avance en la cuenta se usa ese; si no, se sube el de este navegador.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('login')) window.history.replaceState(null, '', window.location.pathname + window.location.hash);
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

  // Un área por pantalla según el hash (#promociones); sin hash, "Tu checklist".
  useEffect(() => {
    const onHash = () => { setView(fromHash()); setMenu(false); window.scrollTo(0, 0); };
    const onKey = e => { if (e.key === 'Escape') setMenu(false); };
    window.addEventListener('hashchange', onHash);
    document.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('hashchange', onHash); document.removeEventListener('keydown', onKey); };
  }, []);

  const logout = () => { api.logout().catch(() => {}); setUser(null); ready.current = false; };
  const toggle = k => setSt(s => ({ ...s, checks: { ...s.checks, [k]: !s.checks[k] } }));
  const setPlan = (i, f, v) => setSt(s => ({ ...s, plan: s.plan.map((r, j) => (j === i ? { ...r, [f]: v } : r)) }));
  const resetAll = () => { if (window.confirm('¿Borrar todo el avance del checklist?')) setSt({ checks: {}, biz: '', rev: '', camp: '', plan: blankPlan() }); };

  const c = st.checks;
  const done = ALL_KEYS.filter(k => c[k]).length;
  const pct = Math.round((done / ALL_KEYS.length) * 100);
  const planDone = st.plan.filter(r => r.task).length;
  const status = a => {
    if (a.id === 'plan') return planDone ? [`${planDone} ${planDone === 1 ? 'tarea' : 'tareas'}`, 'now'] : ['Sin tareas', ''];
    const keys = areaKeys(a);
    const d = keys.filter(k => c[k]).length;
    return [d === keys.length ? 'Completo' : `${d}/${keys.length}`, d === keys.length ? 'ok' : d ? 'now' : ''];
  };

  const area = view && areaById(view);
  const idx = area ? AREAS.indexOf(area) : -1;
  const prev = AREAS[idx - 1];
  const next = AREAS[idx + 1];
  const titleOf = a => (a.sec != null ? SECTIONS[a.sec].title : a.id === 'plan' ? 'Plan de acción' : 'Control final antes de publicar');
  const shortOf = a => (a.sec != null ? SECTIONS[a.sec].short : a.id === 'plan' ? 'Plan de acción' : 'Control final');

  const nav = (
    <nav className="kf-nav" aria-label="Áreas del checklist">
      <a href="#inicio" className={`kf-nav-home${!area ? ' on' : ''}`}><span className="kf-ico">{ICONS.inicio}</span>Tu checklist</a>
      {MOMENTS.map(([m, label]) => (
        <div key={m} className="kf-nav-grp">
          <p>{label}</p>
          {AREAS.filter(a => a.moment === m).map(a => {
            const [txt, cls] = status(a);
            return (
              <a key={a.id} href={'#' + a.id} className={view === a.id ? 'on' : ''} aria-current={view === a.id ? 'page' : undefined}>
                <span className="kf-ico">{ICONS[a.icon]}</span><span className="t">{shortOf(a)}</span>
                <span className={`kf-st kf-st--${cls}`}>{txt}</span>
              </a>
            );
          })}
        </div>
      ))}
      <a href="/" className="kf-nav-relab">Más recursos de Relab →</a>
    </nav>
  );

  const items = keys => keys.map(k => {
    const [si, ii] = k.startsWith('f-') ? [null, Number(k.slice(2))] : k.slice(1).split('-').map(Number);
    const text = si == null ? FINAL[ii] : SECTIONS[si].items[ii];
    return (
      <button key={k} type="button" data-block className={`kf-item${c[k] ? ' on' : ''}`} aria-pressed={!!c[k]} onClick={() => toggle(k)}>
        <span className="kf-box"><Tick /></span><span className="kf-item-t">{text}</span>
      </button>
    );
  });

  return (
    <div className={`kf ck${area ? ' kf--sec' : ''}`}>
      <header className="kf-topbar" data-noprint>
        <div className="kf-topbar-in">
          <a href="#inicio" className="kf-brand"><img src={logoPetrol} alt="ST Relaciones Públicas" /><span>Checklist <b>cyber monday</b></span></a>
          <div className="kf-bar-r">
            <a href="/" className="kf-relab" aria-label="Volver a todos los recursos de Relab"><span className="lg">un recurso <b>relab</b></span><span className="sm">‹ Recursos</span></a>
            {user ? (
              <span className="kf-user"><span className={`kf-saved${saved ? ' ok' : ''}`}>{saved ? '✓ Guardado' : 'Guardando…'}</span><span>{user.name.split(' ')[0]}</span><button type="button" onClick={logout}>Salir</button></span>
            ) : (
              <button type="button" className="kf-btn kf-btn--coral kf-btn--sm" onClick={() => setLoginOpen(true)}>Guardar en mi cuenta</button>
            )}
          </div>
        </div>
      </header>

      {/* En pantalla se ve "Tu checklist" o un área; en el PDF salen todas. */}
      <section className="kf-hero ck-home" hidden={!!area}>
        <div className="kf-wrap kf-hero-in">
          <div>
            <p className="kf-kicker">Checklist interactivo · Cyber Monday 2026</p>
            <h1>Checklist Cyber Monday</h1>
            <p className="kf-lead">Prepará tu tienda, diseñá promociones rentables y organizá tus ventas. Marcá cada tarea y llegá al evento con todo listo.</p>
            <p className="ck-count" data-noprint>{countdown()}</p>
            <div className="ck-hero-btns" data-noprint>
              <a className="kf-btn kf-btn--coral" href="#tienda">{done ? 'Seguir con el checklist →' : 'Empezar por la tienda →'}</a>
              <button type="button" className="kf-btn ck-btn-light" onClick={() => window.print()}><span className="kf-ico">{ICONS.pdf}</span>Descargar PDF</button>
            </div>
            <p className={`kf-save${user ? ' ok' : ''}`} data-noprint>
              {user ? (saved ? `✓ Guardado en tu cuenta · ${user.name.split(' ')[0]}` : 'Guardando en tu cuenta…')
                : <>Tu avance queda en este navegador. <button type="button" onClick={() => setLoginOpen(true)}>Ingresá con Google</button> para tenerlo también en el celular.</>}
            </p>
          </div>
          <div className="kf-hero-stats">
            <div><b>{pct}%</b><span>de tu checklist</span></div>
            <div><b>{done}/{ALL_KEYS.length}</b><span>tareas completas</span></div>
            <div><b>{planDone}</b><span>{planDone === 1 ? 'tarea en tu plan' : 'tareas en tu plan'}</span></div>
          </div>
        </div>
      </section>

      <main className="kf-wrap kf-home ck-home" hidden={!!area}>
        <div className="kf-card ck-campana" data-block>
          <h3 className="kf-card-title">Tu campaña</h3>
          <div className="ck-fields">
            {[['Nombre del negocio', 'biz', 'text', 'Mi tienda'], ['Fecha de revisión', 'rev', 'date'], ['Fecha de la campaña', 'camp', 'date']].map(([lab, key, type, ph]) => (
              <label key={key} className="kf-field"><span>{lab}</span><input type={type} value={st[key]} placeholder={ph} onChange={e => setSt(s => ({ ...s, [key]: e.target.value }))} /></label>
            ))}
          </div>
        </div>
        {MOMENTS.map(([m, label, sub], mi) => (
          <section key={m} className="kf-moment" data-noprint>
            <div className="kf-moment-h"><span>{mi + 1}</span><div><h2>{label}</h2><p>{sub}</p></div></div>
            <div className="kf-cards">
              {AREAS.filter(a => a.moment === m).map(a => {
                const [txt, cls] = status(a);
                return (
                  <a key={a.id} href={'#' + a.id} className="kf-tool">
                    <span className="kf-ico-card">{ICONS[a.icon]}</span>
                    <span className="kf-tool-t">{shortOf(a)}</span>
                    <span className="kf-tool-d">{a.desc}</span>
                    <span className={`kf-st kf-st--${cls}`}>{txt}</span>
                  </a>
                );
              })}
            </div>
          </section>
        ))}
        <div className="kf-rosa" data-noprint>
          <span className="kf-rosa-av">V</span>
          <div>
            <h3>Te presentamos a Vale</h3>
            <p>Tiene una tienda online de velas aromáticas y se prepara para el Cyber Monday. En cada área vas a ver cómo lo resuelve ella.</p>
            <a className="kf-link-inline" href="#promociones">Ver cómo arma su promoción →</a>
          </div>
        </div>
      </main>

      {area && (
        <div className="kf-sub" data-noprint>
          <a href="#inicio">‹ Tu checklist</a>
          <span className="kf-sub-t"><span className="kf-ico">{ICONS[area.icon]}</span>{shortOf(area)}</span>
          <button type="button" onClick={() => setMenu(true)} aria-expanded={menu} aria-controls="kfDrawer"><span className="kf-ico">{ICONS.menu}</span>Áreas</button>
        </div>
      )}
      <div className={`kf-layout${area ? '' : ' ck-print-only'}`}>
        <aside className="kf-side" data-noprint>{nav}</aside>
        <div className="ck-areas">
          {AREAS.map((a, i) => {
            const keys = areaKeys(a);
            const d = keys.filter(k => c[k]).length;
            return (
              <main key={a.id} className="kf-sec ck-area" hidden={view !== a.id}>
                <header className="kf-sec-head">
                  <span className="kf-ico-big">{ICONS[a.icon]}</span>
                  <div><p className="kf-kicker">{momentLabel[a.moment]} · {i + 1} de {AREAS.length}</p><h1>{titleOf(a)}</h1></div>
                </header>
                <div className="kf-intro" data-noprint>
                  <div className="kf-para"><p className="kf-para-t">Para qué sirve</p><ul>{a.para.map(x => <li key={x}>{x}</li>)}</ul></div>
                  <div className="kf-ejemplo"><p className="kf-ejemplo-t"><span>V</span>Ejemplo · Vale, tienda de velas</p><p>{a.ejemplo}</p></div>
                </div>
                {keys.length > 0 && (
                  <div className="kf-progress" data-noprint>
                    <div className="kf-progress-top"><span>Tu avance en esta área</span><b>{d} de {keys.length}</b></div>
                    <div className="kf-bar"><i style={{ width: Math.round((d / keys.length) * 100) + '%' }} className={d === keys.length ? 'full' : ''} /></div>
                  </div>
                )}
                {items(keys)}
                {a.id === 'promociones' && (
                  <div className="ck-ideas" data-block>
                    <h3>Ideas para inspirarte</h3>
                    <div className="ck-ideas-grid">
                      {IDEAS.map(idea => (
                        <div key={idea.type} className="kf-card"><h4>{idea.type}</h4><div className="ck-tags">{idea.tags.map(t => <span key={t}>{t}</span>)}</div></div>
                      ))}
                    </div>
                    <div className="kf-tip kf-tip--ambar"><strong>Importante:</strong> antes de anunciar cuotas, descuentos o envíos bonificados, confirmá las condiciones, comisiones, costos y alcance con tus proveedores. No todas las promociones son convenientes para todos los negocios.</div>
                  </div>
                )}
                {a.id === 'plan' && (
                  <div className="ck-plan">
                    {st.plan.map((row, ri) => (
                      <div key={ri} data-block className="ck-plan-row">
                        <input value={row.task} onChange={e => setPlan(ri, 'task', e.target.value)} placeholder="Tarea prioritaria" aria-label={`Tarea ${ri + 1}`} />
                        <input value={row.resp} onChange={e => setPlan(ri, 'resp', e.target.value)} placeholder="Responsable" aria-label={`Responsable ${ri + 1}`} />
                        <input type="date" value={row.date} onChange={e => setPlan(ri, 'date', e.target.value)} aria-label={`Fecha ${ri + 1}`} />
                        <div className="ck-status">
                          {STATUSES.map((s2, si) => (
                            <button key={s2.label} type="button" onClick={() => setPlan(ri, 'status', si)} className={row.status === si ? 'on' : ''} style={row.status === si ? { background: s2.bg } : undefined}>{s2.label}</button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {a.id === 'control' && (
                  <div className="ck-regla" data-block>
                    <span>“</span>
                    <div><p>Mi regla para Cyber Monday</p><b>Una promoción atractiva no siempre es una promoción rentable. Antes de publicarla, calculá cuánto te queda después de descuentos, comisiones, logística, impuestos y publicidad.</b></div>
                  </div>
                )}
                <nav className="kf-pn" aria-label="Anterior y siguiente" data-noprint>
                  {prev ? <a href={'#' + prev.id} className="prev"><small>Anterior</small><span>← {shortOf(prev)}</span></a> : <a href="#inicio" className="prev"><small>Volver</small><span>← Tu checklist</span></a>}
                  {next ? <a href={'#' + next.id} className="next"><small>Siguiente</small><span>{shortOf(next)} →</span></a> : <a href="#inicio" className="next"><small>Terminaste el recorrido</small><span>Tu checklist →</span></a>}
                </nav>
              </main>
            );
          })}
        </div>
      </div>
      {area && (
        <>
          <div className={`kf-backdrop${menu ? ' open' : ''}`} onClick={() => setMenu(false)} />
          <div id="kfDrawer" className={`kf-drawer${menu ? ' open' : ''}`} onClick={e => e.target.closest('a') && setMenu(false)}>{nav}</div>
        </>
      )}

      <div className="kf-wrap" data-noprint>
        <div className="kf-cta">
          <div>
            <p className="kf-kicker">ST Relaciones Públicas</p>
            <h3>Consultoría en marketing y negocios</h3>
            <p>Consultoría en marketing, RR.PP. e IA, capacitaciones para equipos en ventas, marketing e IA, y cursos online.</p>
          </div>
          <a className="kf-btn kf-btn--coral" href={'https://instagram.com/' + LINKS.ig} target="_blank" rel="noopener noreferrer">Escribinos en Instagram</a>
        </div>
        {done > 0 && <p className="ck-reset"><button type="button" className="kf-link" onClick={resetAll}>Borrar todo el avance</button></p>}
      </div>
      <div data-noprint><Footer /></div>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onLogin={() => api.login()}
        description="Guardá tu avance del checklist y retomalo desde cualquier dispositivo. Funciona igual sin cuenta." />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Checklist />);
