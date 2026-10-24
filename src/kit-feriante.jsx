// Kit del emprendedor feriante (recurso de Relab). Portado del "Kit Feriante — Festival del Poncho"
// de Stella y generalizado para cualquier feria. "Tu kit" muestra las siete herramientas por momento
// (antes, durante y después de la feria) y cada una se abre en su pantalla según el hash, con un
// ejemplo que sigue a un mismo caso (Rosa, tejedora de Belén). Todo lo que se carga
// se guarda en el navegador y, con cuenta de Relab, en /api/state/kit-feriante (cifrado).
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './ds/tokens/fonts.css';
import './ds/tokens/colors.css';
import './ds/tokens/typography.css';
import './ds/tokens/spacing.css';
import './app.css';
import './kit-feriante.css';
import logoPetrol from './ds/assets/logo-petrol.png';
import { Footer } from './Footer.jsx';
import LoginModal from './LoginModal.jsx';
import { api } from './lib/api.js';

const KEY = 'relab-kit-feriante';
const RESOURCE = 'kit-feriante';

// Los ids de los ítems se guardan: no cambiarlos al editar el texto.
const CHECKLIST = [
  { id: 'pre', color: 'celeste', title: 'Antes de la feria · Estrategia', items: [
    ['pre-1', 'Objetivos SMART definidos para el evento', 'Específicos, medibles, alcanzables, realistas y con fecha'],
    ['pre-2', 'Propuesta de valor definida y ensayada', '¿Por qué elegirme a mí y no a la competencia?'],
    ['pre-3', 'Competencia relevada antes del evento', '¿Qué ofrecen? ¿A qué precio? ¿Cómo me diferencio?'],
    ['pre-4', 'Comunicación en redes programada', 'Anunciá tu participación al menos 5 días antes'],
    ['pre-5', 'Presupuesto de gastos completo', 'Stand, traslado, decoración, viáticos y personal de apoyo'],
  ] },
  { id: 'stand', color: 'petroleo', title: 'Stand · Armado y apertura diaria', items: [
    ['stand-1', 'Stand organizado por tipo de producto', 'Exhibición clara, acogedora y sin amontonar'],
    ['stand-2', 'Imagen de marca visible y coherente', 'Logo, colores y cartelería que reflejen tu identidad'],
    ['stand-3', 'Ficha técnica y lista de precios impresa', 'Para mostrar y para que el visitante se la lleve'],
    ['stand-4', 'Productos revisados antes de abrir', 'Estado, funcionamiento y stock, cada mañana'],
    ['stand-5', 'Hoja de ruta del evento lista', 'Horarios de apertura y cierre, y tareas por jornada'],
    ['stand-6', 'Una novedad o lanzamiento exclusivo de la feria', 'Algo especial genera urgencia de compra'],
  ] },
  { id: 'durante', color: 'violeta', title: 'Durante la feria · Buenas prácticas', items: [
    ['dur-1', 'Lenguaje corporal abierto: sonreír y mirar a los ojos', 'Nunca cruzar los brazos ni dar la espalda al visitante'],
    ['dur-2', 'Sin celular ni comida a la vista del público', 'Transmite descuido y falta de interés'],
    ['dur-3', 'El stand nunca queda solo', 'Turnarse con el equipo de apoyo'],
    ['dur-4', 'Datos de visitantes capturados', 'WhatsApp, Instagram o mail para el seguimiento'],
    ['dur-5', 'Evaluación de resultados al cierre de cada día', '¿Qué funcionó? ¿Qué ajusto para mañana?'],
    ['dur-6', 'No desarmar el stand antes del cierre oficial', 'Daña seriamente la imagen del emprendimiento'],
  ] },
  { id: 'cobros', color: 'coral', title: 'Cobros · Herramientas digitales', items: [
    ['cob-1', 'Al menos 2 billeteras virtuales probadas y activas', 'Si una falla, la otra es tu respaldo inmediato'],
    ['cob-2', 'QR impreso, plastificado y visible', 'Tamaño legible, en soporte fijo y bien iluminado'],
    ['cob-3', 'Efectivo para dar cambio', 'Siempre hay quien paga en efectivo'],
  ] },
  { id: 'post', color: 'ambar', title: 'Después de la feria · Balance y seguimiento', items: [
    ['post-1', 'Balance de ventas y costos cerrado', '¿Cuánto vendí? ¿Cuánto gasté? ¿Fue rentable?'],
    ['post-2', 'Seguimiento de contactos en las primeras 48 horas', 'Mensaje cálido y una propuesta concreta'],
    ['post-3', 'Contenido del evento publicado en redes', 'Fotos, videos y resultados para la semana siguiente'],
    ['post-4', 'ROI calculado y decisión sobre la próxima edición', 'Usá la herramienta ROI post feria'],
  ] },
];
const CHECK_IDS = CHECKLIST.flatMap(s => s.items.map(i => i[0]));

const MEDIOS = [
  ['mp', 'Mercado Pago'], ['modo', 'MODO'], ['uala', 'Ualá'], ['bna', 'BNA+'], ['transf', 'Transferencia'], ['efect', 'Efectivo'],
];
const medioLabel = Object.fromEntries(MEDIOS);
const FIJOS = [
  ['alquiler', 'Alquiler o inscripción'], ['traslado', 'Traslado o flete'], ['deco', 'Decoración y cartelería'],
  ['viaticos', 'Comidas y viáticos'], ['personal', 'Personal de apoyo'], ['otros', 'Otros gastos'],
];

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const blankProduct = () => ({ id: newId(), nombre: '', costo: '', precio: '', unid: '' });
const blankCalc = () => ({ fijos: {}, productos: [blankProduct()], comision: '3', pctDigital: '70' });
const blankRoi = () => ({ dias: '1' });
const normalize = s => ({
  checks: s?.checks && typeof s.checks === 'object' ? s.checks : {},
  ventas: Array.isArray(s?.ventas) ? s.ventas.filter(v => v && Number.isFinite(v.monto) && Number.isFinite(v.ts)) : [],
  calc: { ...blankCalc(), ...(s?.calc || {}), productos: s?.calc?.productos?.length ? s.calc.productos : [blankProduct()] },
  roi: { ...blankRoi(), ...(s?.roi || {}) },
});
const initial = () => {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) return normalize(s); } catch (e) {}
  return normalize(null);
};
const hasData = s => Object.values(s.checks).some(Boolean) || s.ventas.length > 0
  || Object.values(s.calc.fijos).some(Boolean) || s.calc.productos.some(p => p.nombre || p.costo || p.precio || p.unid)
  || Object.entries(s.roi).some(([k, v]) => k !== 'dias' && v);

// Los campos guardan el texto tal cual; para calcular, vacío es 0 y se acepta coma decimal.
const num = v => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const fmt = n => (n < 0 ? '−$' : '$') + Math.round(Math.abs(n)).toLocaleString('es-AR');
const dayKey = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dayLabel = key => {
  const [y, m, d] = key.split('-').map(Number);
  const s = new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const hora = ts => new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

const Tick = () => <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>;
const Tip = ({ tone = 'ambar', children }) => <div className={`kf-tip kf-tip--${tone}`}>{children}</div>;
const Card = ({ title, children, className = '' }) => (
  <div className={`kf-card ${className}`}>{title && <h3 className="kf-card-title">{title}</h3>}{children}</div>
);
const Field = ({ label, value, onChange, placeholder = '0', hint, suffix }) => (
  <label className="kf-field">
    <span>{label}</span>
    <span className="kf-input-wrap">
      <input type="text" inputMode="decimal" value={value ?? ''} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
      {suffix && <em>{suffix}</em>}
    </span>
    {hint && <small>{hint}</small>}
  </label>
);

const MOMENTS = [
  ['antes', 'Antes de la feria', 'Preparate y hacé las cuentas'],
  ['durante', 'Durante la feria', 'Atendé, vendé y registrá'],
  ['despues', 'Después de la feria', 'Medí y decidí'],
];
const momentLabel = Object.fromEntries(MOMENTS.map(m => [m[0], m[1]]));
const Svg = ({ children }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
const ICONS = {
  inicio: <Svg><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" /></Svg>,
  checklist: <Svg><path d="m3 17 2 2 4-4" /><path d="m3 7 2 2 4-4" /><path d="M13 6h8" /><path d="M13 12h8" /><path d="M13 18h8" /></Svg>,
  calculadora: <Svg><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M8 6h8" /><path d="M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" /></Svg>,
  cobros: <Svg><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /><path d="M6 15h4" /></Svg>,
  pitch: <Svg><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></Svg>,
  visitantes: <Svg><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Svg>,
  tracker: <Svg><path d="M3 3v18h18" /><path d="M7 16v-5" /><path d="M12 16V8" /><path d="M17 16V5" /></Svg>,
  roi: <Svg><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></Svg>,
  menu: <Svg><path d="M4 6h16M4 12h16M4 18h16" /></Svg>,
};

// Las herramientas del kit, en el orden del recorrido. El ejemplo sigue a un mismo caso: Rosa.
const SECTIONS = [
  { id: 'checklist', label: 'Checklist', moment: 'antes', desc: 'Todo lo que tenés que tener listo, de la estrategia al balance.',
    para: ['Llegar a la feria sin olvidarte de nada.', 'Ordenar las tareas de antes, durante y después.'],
    ejemplo: 'Cinco días antes del festival, Rosa anuncia en Instagram el número de su stand y adelanta un poncho nuevo que va a presentar allá: su novedad exclusiva de la feria.' },
  { id: 'calculadora', label: 'Calculadora', moment: 'antes', desc: 'Cuánto vas a ganar y cuántas unidades necesitás vender para cubrir el stand.',
    para: ['Saber si la feria te conviene antes de pagar el stand.', 'Conocer tu punto de equilibrio: cuánto vender para no perder.'],
    ejemplo: 'Rosa paga $120.000 de stand, $30.000 de flete, $25.000 de cartelería y $40.000 de viáticos. Lleva ponchos, mantas y caminos de mesa. Con 10 unidades cubre los costos fijos; todo lo que vende después es ganancia.' },
  { id: 'cobros', label: 'Cobros', moment: 'antes', desc: 'Billeteras, QR y efectivo: qué conviene y cuánto cobra cada uno.',
    para: ['Elegir cómo cobrar sin perder ventas.', 'Saber cuánto se lleva cada medio de pago.'],
    ejemplo: 'Rosa cobra con QR de Mercado Pago, tiene Ualá Bis como respaldo y lleva cambio para quien paga en efectivo. Antes del festival hizo una compra de prueba con cada uno.' },
  { id: 'pitch', label: 'Pitch y ventas', moment: 'durante', desc: 'Qué decir en 20 segundos, cómo cerrar y cómo responder objeciones.',
    para: ['Presentar tu producto en pocas palabras.', 'Vender más a quien ya compra y responder las objeciones de siempre.'],
    ejemplo: '“Tejemos ponchos en telar con lana de oveja de Belén, para quienes buscan una prenda que dure toda la vida. Cada uno lleva tres semanas de trabajo. ¿Querés ver cómo se teje?”' },
  { id: 'visitantes', label: 'Visitantes', moment: 'durante', desc: 'Los tipos de clientes que vas a encontrar y cómo atender a cada uno.',
    para: ['Reconocer qué busca cada visitante.', 'Atender bien incluso a los clientes difíciles.'],
    ejemplo: 'Un visitante toca una manta y dice “después vuelvo”. Rosa no insiste: le da una tarjeta con su Instagram y le cuenta que hace envíos a todo el país.' },
  { id: 'tracker', label: 'Ventas del día', moment: 'durante', desc: 'Registrá cada venta y mirá el balance del día y de toda la feria.',
    para: ['Tener el balance del día sin papeles ni cuentas.', 'Ver qué se vende más y con qué medio de pago.'],
    ejemplo: 'Rosa anota cada venta en el momento. Al cierre del sábado ve que vendió más caminos de mesa que ponchos, y el domingo los pone adelante en el stand.' },
  { id: 'roi', label: 'ROI post feria', moment: 'despues', desc: 'El balance final: ganancia real, retorno y si te conviene volver.',
    para: ['Saber si la feria fue rentable.', 'Decidir con números si volvés el año que viene.'],
    ejemplo: 'Al terminar el festival, Rosa trae sus ventas del tracker, carga lo que gastó en stand, viaje y lana, y decide con números si vuelve el año que viene.' },
];
const secById = id => SECTIONS.find(s => s.id === id);
const fromHash = () => (secById(location.hash.slice(1)) ? location.hash.slice(1) : null);

const ROSA_CALC = () => ({
  fijos: { alquiler: '120000', traslado: '30000', deco: '25000', viaticos: '40000' },
  productos: [
    { id: newId(), nombre: 'Poncho de telar', costo: '45000', precio: '95000', unid: '8' },
    { id: newId(), nombre: 'Manta', costo: '30000', precio: '65000', unid: '10' },
    { id: newId(), nombre: 'Camino de mesa', costo: '6000', precio: '15000', unid: '25' },
  ],
  comision: '3', pctDigital: '70',
});

function Kit() {
  const [st, setSt] = useState(initial);
  const [view, setView] = useState(fromHash); // null = Tu kit
  const [menu, setMenu] = useState(false);
  const [user, setUser] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveT = useRef(null);
  const ready = useRef(false); // no subir nada hasta saber si la cuenta ya tiene datos

  // Sesión de Relab: si la cuenta tiene datos se usan esos; si no, se suben los de este navegador.
  useEffect(() => {
    api.me().then(async me => {
      if (!me.user) return;
      setUser(me.user);
      try {
        const { data } = await api.getState(RESOURCE);
        if (data) setSt(normalize(data));
        else if (hasData(initial())) await api.saveState(RESOURCE, initial());
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

  // Una herramienta por pantalla según el hash (#calculadora); sin hash, "Tu kit".
  useEffect(() => {
    const onHash = () => { setView(fromHash()); setMenu(false); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const open = id => { location.hash = id || 'inicio'; };
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const logout = () => { api.logout().catch(() => {}); setUser(null); ready.current = false; };
  const set = (key, fn) => setSt(s => ({ ...s, [key]: fn(s[key]) }));

  const checksDone = CHECK_IDS.filter(id => st.checks[id]).length;
  const pct = Math.round((checksDone / CHECK_IDS.length) * 100);
  const calcOn = Object.values(st.calc.fijos).some(Boolean) || st.calc.productos.some(p => p.precio && p.unid);
  const roiOn = Object.entries(st.roi).some(([k, v]) => k !== 'dias' && v);
  const status = id => ({
    checklist: [`${checksDone}/${CHECK_IDS.length}`, pct === 100 ? 'ok' : checksDone ? 'now' : ''],
    calculadora: calcOn ? ['Con tus datos', 'now'] : ['Sin empezar', ''],
    tracker: st.ventas.length ? [`${st.ventas.length} ${st.ventas.length === 1 ? 'venta' : 'ventas'}`, 'now'] : ['Sin ventas', ''],
    roi: roiOn ? ['Con tus datos', 'now'] : ['Sin empezar', ''],
  }[id] || ['Para leer', 'read']);

  const sec = view && secById(view);
  const idx = sec ? SECTIONS.indexOf(sec) : -1;
  const prev = SECTIONS[idx - 1];
  const next = SECTIONS[idx + 1];

  const saveLine = (
    <p className={`kf-save${user ? ' ok' : ''}`}>
      {user ? (saved ? `✓ Guardado en tu cuenta · ${user.name.split(' ')[0]}` : 'Guardando en tu cuenta…')
        : <>Lo que cargues queda en este navegador. <button type="button" onClick={() => setLoginOpen(true)}>Ingresá con Google</button> para tenerlo también en el celular.</>}
    </p>
  );
  const nav = (
    <nav className="kf-nav" aria-label="Herramientas del kit">
      <a href="#inicio" className={`kf-nav-home${!sec ? ' on' : ''}`}><span className="kf-ico">{ICONS.inicio}</span>Tu kit</a>
      {MOMENTS.map(([m, label]) => (
        <div key={m} className="kf-nav-grp">
          <p>{label}</p>
          {SECTIONS.filter(s => s.moment === m).map(s => {
            const [txt, cls] = status(s.id);
            return (
              <a key={s.id} href={'#' + s.id} className={view === s.id ? 'on' : ''} aria-current={view === s.id ? 'page' : undefined}>
                <span className="kf-ico">{ICONS[s.id]}</span><span className="t">{s.label}</span>
                {cls !== 'read' && <span className={`kf-st kf-st--${cls}`}>{txt}</span>}
              </a>
            );
          })}
        </div>
      ))}
    </nav>
  );

  return (
    <div className={`kf${sec ? ' kf--sec' : ''}`}>
      <header className="kf-topbar">
        <div className="kf-topbar-in">
          <a href="#inicio" className="kf-brand"><img src={logoPetrol} alt="ST Relaciones Públicas" /><span>Kit <b>feriante</b></span></a>
          <div className="kf-bar-r">
            <a href="/" className="kf-relab">un recurso <b>relab</b></a>
            {user ? (
              <span className="kf-user"><span className={`kf-saved${saved ? ' ok' : ''}`}>{saved ? '✓ Guardado' : 'Guardando…'}</span><span>{user.name.split(' ')[0]}</span><button type="button" onClick={logout}>Salir</button></span>
            ) : (
              <button type="button" className="kf-btn kf-btn--coral kf-btn--sm" onClick={() => setLoginOpen(true)}>Guardar en mi cuenta</button>
            )}
          </div>
        </div>
      </header>

      {!sec ? (
        <Home status={status} pct={pct} st={st} saveLine={saveLine} open={open} />
      ) : (
        <>
          <div className="kf-sub">
            <a href="#inicio">‹ Tu kit</a>
            <span className="kf-sub-t"><span className="kf-ico">{ICONS[sec.id]}</span>{sec.label}</span>
            <button type="button" onClick={() => setMenu(true)} aria-expanded={menu} aria-controls="kfDrawer"><span className="kf-ico">{ICONS.menu}</span>Herramientas</button>
          </div>
          <div className="kf-layout">
            <aside className="kf-side">{nav}</aside>
            <main className="kf-sec">
              <header className="kf-sec-head">
                <span className="kf-ico-big">{ICONS[sec.id]}</span>
                <div><p className="kf-kicker">{momentLabel[sec.moment]} · {idx + 1} de {SECTIONS.length}</p><h1>{sec.label}</h1></div>
              </header>
              <div className="kf-intro">
                <div className="kf-para"><p className="kf-para-t">Para qué sirve</p><ul>{sec.para.map(x => <li key={x}>{x}</li>)}</ul></div>
                <div className="kf-ejemplo">
                  <p className="kf-ejemplo-t"><span>R</span>Ejemplo · Rosa, tejedora de Belén</p>
                  <p>{sec.ejemplo}</p>
                  {sec.id === 'calculadora' && (
                    <button type="button" className="kf-btn kf-btn--soft kf-btn--sm" onClick={() => (!calcOn || window.confirm('Esto reemplaza lo que cargaste en la calculadora. ¿Seguimos?')) && set('calc', () => ROSA_CALC())}>Probar con los números de Rosa</button>
                  )}
                </div>
              </div>
              {sec.id === 'checklist' && <Checklist st={st} set={set} done={checksDone} pct={pct} />}
              {sec.id === 'calculadora' && <Calculadora calc={st.calc} set={set} />}
              {sec.id === 'cobros' && <Cobros />}
              {sec.id === 'pitch' && <Pitch />}
              {sec.id === 'visitantes' && <Visitantes />}
              {sec.id === 'tracker' && <Tracker ventas={st.ventas} set={set} />}
              {sec.id === 'roi' && <Roi roi={st.roi} ventas={st.ventas} set={set} openTab={open} />}
              <nav className="kf-pn" aria-label="Anterior y siguiente">
                {prev ? <a href={'#' + prev.id} className="prev"><small>Anterior</small><span>← {prev.label}</span></a> : <a href="#inicio" className="prev"><small>Volver</small><span>← Tu kit</span></a>}
                {next ? <a href={'#' + next.id} className="next"><small>Siguiente</small><span>{next.label} →</span></a> : <a href="#inicio" className="next"><small>Terminaste el recorrido</small><span>Tu kit →</span></a>}
              </nav>
            </main>
          </div>
          <div className={`kf-backdrop${menu ? ' open' : ''}`} onClick={() => setMenu(false)} />
          <div id="kfDrawer" className={`kf-drawer${menu ? ' open' : ''}`} onClick={e => e.target.closest('a') && setMenu(false)}>{nav}</div>
        </>
      )}

      <div className="kf-wrap"><Cta /></div>
      <Footer />
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onLogin={() => api.login()}
        description="Guardá tu checklist, tus ventas y tus cálculos, y retomalos desde cualquier dispositivo. Funciona igual sin cuenta." />
    </div>
  );
}

function Home({ status, pct, st, saveLine, open }) {
  const hoy = dayKey(Date.now());
  const hoyTotal = st.ventas.filter(v => dayKey(v.ts) === hoy).reduce((a, v) => a + v.monto, 0);
  return (
    <>
      <section className="kf-hero">
        <div className="kf-wrap kf-hero-in">
          <div>
            <p className="kf-kicker">Kit gratuito · 7 herramientas</p>
            <h1>Kit del emprendedor feriante</h1>
            <p className="kf-lead">Para el Festival del Poncho, ferias navideñas, mercados y expos: prepará tu stand, vendé mejor, registrá tus ventas y medí si te conviene volver.</p>
            <a className="kf-btn kf-btn--coral" href="#checklist">Empezar por el checklist →</a>
            {saveLine}
          </div>
          <div className="kf-hero-stats">
            <div><b>{pct}%</b><span>de tu checklist</span></div>
            <div><b>{st.ventas.length}</b><span>{st.ventas.length === 1 ? 'venta registrada' : 'ventas registradas'}</span></div>
            <div><b>{fmt(hoyTotal)}</b><span>vendido hoy</span></div>
          </div>
        </div>
      </section>
      <main className="kf-wrap kf-home">
        {MOMENTS.map(([m, label, sub], mi) => (
          <section key={m} className="kf-moment">
            <div className="kf-moment-h"><span>{mi + 1}</span><div><h2>{label}</h2><p>{sub}</p></div></div>
            <div className="kf-cards">
              {SECTIONS.filter(s => s.moment === m).map(s => {
                const [txt, cls] = status(s.id);
                return (
                  <a key={s.id} href={'#' + s.id} className="kf-tool">
                    <span className="kf-ico-card">{ICONS[s.id]}</span>
                    <span className="kf-tool-t">{s.label}</span>
                    <span className="kf-tool-d">{s.desc}</span>
                    <span className={`kf-st kf-st--${cls}`}>{txt}</span>
                  </a>
                );
              })}
            </div>
          </section>
        ))}
        <div className="kf-rosa">
          <span className="kf-rosa-av">R</span>
          <div>
            <h3>Te presentamos a Rosa</h3>
            <p>Teje ponchos y mantas en telar en Belén, Catamarca, y vende en el Festival del Poncho. En cada herramienta vas a ver cómo la usa ella, y en la calculadora podés probar con sus números.</p>
            <button type="button" className="kf-link-inline" onClick={() => open('calculadora')}>Ver la calculadora con el ejemplo de Rosa →</button>
          </div>
        </div>
      </main>
    </>
  );
}

const Cta = () => (
  <div className="kf-cta">
    <div>
      <p className="kf-kicker">ST Relaciones Públicas</p>
      <h3>¿Querés preparar tu próxima feria con acompañamiento?</h3>
      <p>Consultoría en marketing y ventas, capacitaciones para equipos y cursos online.</p>
    </div>
    <a className="kf-btn kf-btn--coral" href="https://instagram.com/strelacionespublicas" target="_blank" rel="noopener noreferrer">Escribinos en Instagram</a>
  </div>
);

function Checklist({ st, set, done, pct }) {
  const toggle = id => set('checks', c => ({ ...c, [id]: !c[id] }));
  return (
    <>
      <div className="kf-progress">
        <div className="kf-progress-top"><span>Tu preparación</span><b>{done} de {CHECK_IDS.length} ítems</b></div>
        <div className="kf-topbar"><i style={{ width: pct + '%' }} className={pct === 100 ? 'full' : ''} /></div>
      </div>
      {CHECKLIST.map(sec => (
        <section key={sec.id} className="kf-cl-sec">
          <h2 className={`kf-cl-head kf-c-${sec.color}`}>{sec.title}<span>{sec.items.filter(i => st.checks[i[0]]).length}/{sec.items.length}</span></h2>
          {sec.items.map(([id, text, sub]) => (
            <button key={id} type="button" className={`kf-item${st.checks[id] ? ' on' : ''}`} aria-pressed={!!st.checks[id]} onClick={() => toggle(id)}>
              <span className="kf-box"><Tick /></span>
              <span><span className="kf-item-t">{text}</span><span className="kf-item-s">{sub}</span></span>
            </button>
          ))}
        </section>
      ))}
      <Tip><strong>Recordá:</strong> la feria empieza una semana antes en tus redes y termina una semana después, con el contenido que generaste adentro.</Tip>
      {done > 0 && <button type="button" className="kf-link" onClick={() => window.confirm('¿Desmarcar todo el checklist?') && set('checks', () => ({}))}>Desmarcar todo</button>}
    </>
  );
}

function Pitch() {
  return (
    <>
      <div className="kf-formula">
        <span className="kf-formula-l">Fórmula de éxito en una feria</span>
        <div className="kf-eq"><b>Alcance</b><i>×</i><b>Contactos</b><i>×</i><b>Reuniones</b><i>×</i><b>Seguimiento</b></div>
      </div>
      <h2 className="kf-cl-head kf-c-petroleo">Modelo AIDA</h2>
      <div className="kf-aida">
        {[['A', 'Atención', 'Stand, cartelería y presencia que frenan al visitante'], ['I', 'Interés', 'Producto y propuesta de valor que despiertan curiosidad'],
          ['D', 'Deseo', 'Historia, origen y calidad que conectan emocionalmente'], ['A', 'Acción', 'Precio claro y cobro simple para cerrar sin fricción']].map(([l, w, d], i) => (
          <div key={i} className="kf-aida-s"><b>{l}</b><span>{w}</span><small>{d}</small></div>
        ))}
      </div>
      <Card title="Pitch de 20 segundos">
        <div className="kf-speech">
          <div><span>Mensaje clave (10 segundos)</span><p><em>“Hacemos [producto] con [diferencial único] para [público].”</em></p></div>
          <div><span>Apoyo 1 · Origen e historia</span><p>¿De dónde viene? ¿Quién lo hace? La historia vende más que el precio.</p></div>
          <div><span>Apoyo 2 · Calidad y proceso</span><p>Materiales, técnica y tiempo de elaboración: detalles que generan confianza.</p></div>
          <div><span>Apoyo 3 · Llamado a la acción</span><p><em>“Lo podés ver acá y también hacemos envíos. ¿Te paso el Instagram?”</em></p></div>
        </div>
      </Card>
      <Card title="Cómo atender a cada visitante">
        <div className="kf-speech">
          <div><span>1 · Iniciar</span><p>Saludá primero. No esperes que el visitante hable: un “buen día” cálido abre todo.</p></div>
          <div><span>2 · Preguntar</span><p><em>“¿Buscás algo en particular?”</em> o <em>“¿Es para regalo o para vos?”</em> Identificá la necesidad rápido.</p></div>
          <div><span>3 · Informar</span><p>Información útil para esa persona, no un discurso genérico. Corto y simple.</p></div>
          <div><span>4 · Influir</span><p>Mostrá beneficios concretos, ofrecé algo complementario o superior y facilitá el cierre sin presionar.</p></div>
        </div>
      </Card>
      <h2 className="kf-cl-head kf-c-violeta">Vender más a quien ya compra</h2>
      <div className="kf-grid2">
        <Card><span className="kf-tag kf-tag--violeta">Upselling</span><h4>Una versión mejor del mismo producto</h4><p className="kf-muted">El cliente elige algo y le mostrás una opción superior. Funciona cuando ya hay intención de compra.</p><p className="kf-example">“Este modelo es genial, pero si te interesa el tejido premium te dura el doble. Está $X más.”</p></Card>
        <Card><span className="kf-tag kf-tag--celeste">Venta cruzada</span><h4>Un producto complementario</h4><p className="kf-muted">El cliente compra algo y le ofrecés lo que lo acompaña. Sube el ticket sin esfuerzo extra.</p><p className="kf-example">“Con esa bolsa va perfecto este portatermo. También es artesanal, mirá.”</p></Card>
      </div>
      <h2 className="kf-cl-head kf-c-coral">Objeciones frecuentes</h2>
      <div className="kf-obj">
        {[['“Es muy caro”', <><em>“Entiendo. Te cuento por qué tiene ese precio…”</em> Explicá el valor, el proceso o el origen. No bajes el precio: subí la percepción de valor.</>],
          ['“Lo pienso”', <><em>“Claro, tomate tu tiempo. ¿Qué te genera duda?”</em> Buscá la objeción real detrás de la frase.</>],
          ['“Después vuelvo”', <><em>“Perfecto, llevate mi Instagram así me encontrás fácil.”</em> Quedate con un contacto: la mayoría no vuelve si no se lleva un dato tuyo.</>],
          ['“En otro stand vi algo igual más barato”', <>No te defiendas. <em>“Puede ser; la diferencia está en [material, proceso u origen].”</em> Mostrá tu diferencial sin hablar mal de nadie.</>],
          ['“No tengo efectivo”', <><em>“No hay problema: aceptamos QR, transferencia y tarjeta.”</em> Nunca pierdas una venta por el medio de pago.</>],
          ['“¿Me hacés descuento?”', <>Ofrecé valor en lugar de descuento: <em>“Descuento no, pero si llevás dos te incluyo el packaging de regalo.”</em></>],
        ].map(([q, a]) => <div key={q} className="kf-obj-c"><b>{q}</b><p>{a}</p></div>)}
      </div>
      <Tip tone="celeste"><strong>Regla de oro:</strong> cada objeción es una oportunidad para mostrar el valor de lo que vendés. Nunca la tomes como un rechazo.</Tip>
    </>
  );
}

function Visitantes() {
  return (
    <>
      <Card title="Dos tipos de visitantes según su intención">
        <div className="kf-speech">
          <div><span>No piensa en comprar</span><p>Tu tarea es despertar el interés: atracción, historia y un efecto sorpresa. Es el más difícil, pero el más valioso si lo convertís.</p></div>
          <div><span>Ya quiere comprar algo parecido</span><p>Tu tarea es reforzar esa intención y mostrar por qué tu producto es la mejor opción. Acá entran la versión superior y las objeciones.</p></div>
        </div>
      </Card>
      <h2 className="kf-cl-head kf-c-petroleo">10 tipos de clientes y cómo atenderlos</h2>
      <div className="kf-clients">
        {[['Enojado', 'Escuchá sin interrumpir. Calma y empatía antes que justificaciones.'], ['Discutidor', 'No entres en el debate. Redirigí con preguntas sobre lo que necesita.'],
          ['Conversador', 'Sé amable y llevá la charla al producto con naturalidad.'], ['Quejoso', 'Validá brevemente y pasá a soluciones concretas.'],
          ['Indeciso', 'Reducí opciones: dos alternativas como máximo, y guiá la decisión.'], ['Tímido', 'Dale espacio, no presiones. Preguntas abiertas y amables.'],
          ['Impulsivo', 'Actuá rápido. Confirmá la compra sin demoras ni detalles de más.'], ['Sabelotodo', 'Respetá lo que sabe. Sumá información en lugar de contradecir.'],
          ['Opositor', 'Tomá cada objeción como una oportunidad para mostrar el valor.'], ['Grosero', 'Mantené la calma. Límite firme y profesional; no respondas igual.'],
        ].map(([t, a], i) => <div key={t} className="kf-client"><b><span>{i + 1}</span>{t}</b><p>{a}</p></div>)}
      </div>
      <Card title="Calidad de servicio">
        <div className="kf-eq kf-eq--left"><b>Lo que el cliente recibe</b><i>−</i><b>Lo que esperaba</b><i>=</i><b>Calidad percibida</b></div>
        <div className="kf-speech">
          <div><span>Lo mínimo</span><p>Saludo cordial, buena predisposición, agilidad y cero distracciones.</p></div>
          <div><span>Lo que sorprende</span><p>Saludar primero, interesarte de verdad, facilitar la decisión, ofrecer sin presionar y atender de forma personalizada.</p></div>
        </div>
      </Card>
      <Tip><strong>Recordá:</strong> no le va mejor al que más ruido hace, sino al que mejor eligió a su público y actuó en consecuencia.</Tip>
    </>
  );
}

function Tracker({ ventas, set }) {
  const [prod, setProd] = useState('');
  const [monto, setMonto] = useState('');
  const [medio, setMedio] = useState('mp');
  const [vista, setVista] = useState('hoy');
  const [err, setErr] = useState('');
  const hoy = dayKey(Date.now());

  const add = e => {
    e.preventDefault();
    const m = num(monto);
    if (m <= 0) { setErr('Ingresá un monto mayor a 0.'); return; }
    set('ventas', v => [...v, { id: newId(), prod: prod.trim() || 'Sin nombre', monto: m, medio, ts: Date.now() }]);
    setProd(''); setMonto(''); setErr('');
  };
  const del = id => set('ventas', v => v.filter(x => x.id !== id));
  const delHoy = () => window.confirm('¿Borrar todas las ventas de hoy?') && set('ventas', v => v.filter(x => dayKey(x.ts) !== hoy));

  const lista = vista === 'hoy' ? ventas.filter(v => dayKey(v.ts) === hoy) : ventas;
  const total = lista.reduce((a, v) => a + v.monto, 0);
  const freq = {};
  lista.forEach(v => { freq[v.prod] = (freq[v.prod] || 0) + 1; });
  const best = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
  const porMedio = MEDIOS.map(([k, l]) => [l, lista.filter(v => v.medio === k).reduce((a, v) => a + v.monto, 0)]).filter(x => x[1] > 0);
  const dias = [...new Set(lista.map(v => dayKey(v.ts)))].sort().reverse();

  const exportar = () => {
    const rows = [['Fecha', 'Hora', 'Producto', 'Monto', 'Medio de pago']].concat(
      [...ventas].sort((a, b) => a.ts - b.ts).map(v => [dayKey(v.ts), hora(v.ts), v.prod, Math.round(v.monto), medioLabel[v.medio] || v.medio]));
    const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `ventas-feria-${hoy}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <>
      <div className="kf-seg" role="group" aria-label="Período">
        <button type="button" className={vista === 'hoy' ? 'on' : ''} onClick={() => setVista('hoy')}>Hoy</button>
        <button type="button" className={vista === 'todo' ? 'on' : ''} onClick={() => setVista('todo')}>Toda la feria</button>
      </div>
      <div className="kf-metrics">
        <div><span>Ventas</span><b>{lista.length}</b><small>{vista === 'hoy' ? 'hoy' : `en ${dias.length} ${dias.length === 1 ? 'día' : 'días'}`}</small></div>
        <div><span>Total recaudado</span><b>{fmt(total)}</b><small>bruto</small></div>
        <div><span>Ticket promedio</span><b>{lista.length ? fmt(total / lista.length) : '$0'}</b><small>por venta</small></div>
        <div><span>Más vendido</span><b className="kf-sm">{best ? best[0] : '—'}</b><small>{best ? `${best[1]} ${best[1] === 1 ? 'venta' : 'ventas'}` : 'producto'}</small></div>
      </div>
      {porMedio.length > 0 && <div className="kf-medios">{porMedio.map(([l, t]) => <span key={l}>{l} <b>{fmt(t)}</b></span>)}</div>}

      <form className="kf-card kf-venta" onSubmit={add}>
        <h3 className="kf-card-title">Registrar venta</h3>
        <div className="kf-venta-row">
          <label className="kf-field"><span>Producto</span><input type="text" value={prod} onChange={e => setProd(e.target.value)} placeholder="Ej.: poncho de vicuña" maxLength={80} /></label>
          <label className="kf-field"><span>Monto</span><span className="kf-input-wrap"><em className="pre">$</em><input type="text" inputMode="decimal" value={monto} onChange={e => setMonto(e.target.value)} placeholder="0" /></span></label>
          <label className="kf-field"><span>Medio de pago</span><select value={medio} onChange={e => setMedio(e.target.value)}>{MEDIOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <button type="submit" className="kf-btn kf-btn--coral">+ Registrar</button>
        </div>
        {err && <p className="kf-err" role="alert">{err}</p>}
      </form>

      <div className="kf-ventas">
        {lista.length === 0 && <p className="kf-empty">{vista === 'hoy' ? 'Todavía no registraste ventas hoy. ¡A vender!' : 'Todavía no hay ventas registradas.'}</p>}
        {dias.map(d => {
          const delDia = lista.filter(v => dayKey(v.ts) === d).sort((a, b) => b.ts - a.ts);
          return (
            <div key={d}>
              {vista === 'todo' && <div className="kf-dia"><span>{d === hoy ? 'Hoy' : dayLabel(d)}</span><b>{fmt(delDia.reduce((a, v) => a + v.monto, 0))}</b></div>}
              {delDia.map(v => (
                <div key={v.id} className="kf-venta-i">
                  <span className="p">{v.prod}</span>
                  <span className="m">{fmt(v.monto)}</span>
                  <span className={`kf-medio kf-medio--${v.medio}`}>{medioLabel[v.medio] || v.medio}</span>
                  <span className="h">{hora(v.ts)}</span>
                  <button type="button" aria-label={`Borrar venta de ${v.prod}`} onClick={() => del(v.id)}>×</button>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div className="kf-actions">
        {ventas.length > 0 && <button type="button" className="kf-btn kf-btn--outline" onClick={exportar}>Descargar ventas (Excel / CSV)</button>}
        {ventas.some(v => dayKey(v.ts) === hoy) && <button type="button" className="kf-link" onClick={delHoy}>Borrar ventas de hoy</button>}
      </div>
      <Tip tone="celeste"><strong>Registrá cada venta en el momento.</strong> Al cierre tenés el balance del día sin buscar papeles, y al final de la feria lo llevás directo al ROI.</Tip>
    </>
  );
}

function Calculadora({ calc, set }) {
  const upd = fn => set('calc', fn);
  const setFijo = (k, v) => upd(c => ({ ...c, fijos: { ...c.fijos, [k]: v } }));
  const setProd = (id, f, v) => upd(c => ({ ...c, productos: c.productos.map(p => (p.id === id ? { ...p, [f]: v } : p)) }));

  const fijos = FIJOS.reduce((a, [k]) => a + num(calc.fijos[k]), 0);
  const cp = num(calc.comision) / 100;
  const pd = Math.min(100, num(calc.pctDigital)) / 100;
  const ing = calc.productos.reduce((a, p) => a + num(p.precio) * num(p.unid), 0);
  const cv = calc.productos.reduce((a, p) => a + num(p.costo) * num(p.unid), 0);
  const unid = calc.productos.reduce((a, p) => a + num(p.unid), 0);
  const com = ing * pd * cp;
  const gan = ing - cv - fijos - com;
  const margen = ing > 0 ? Math.round((gan / ing) * 100) : 0;
  // Punto de equilibrio con la mezcla de productos estimada: cuántas unidades cubren los costos fijos.
  const pProm = unid > 0 ? ing / unid : 0;
  const mu = unid > 0 ? pProm - cv / unid - pProm * pd * cp : 0;
  const eq = mu > 0 ? Math.ceil(fijos / mu) : null;
  const show = ing > 0 || fijos > 0;

  let tip = '';
  if (gan < 0) tip = 'Con estos números la feria no cubre los costos. Revisá precios, reducí gastos fijos o pensá cómo vender más unidades.';
  else if (margen < 15) tip = 'Margen bajo. Considerá ajustar precios o bajar los costos del stand.';
  else if (margen >= 30) tip = 'Muy buen margen. Estás bien posicionado para la feria.';
  else tip = 'Buen resultado. Enfocate en superar el punto de equilibrio lo antes posible cada día.';

  return (
    <>
      <div className="kf-calc">
        <Card title="Costos fijos del stand">
          {FIJOS.map(([k, l]) => <Field key={k} label={l} value={calc.fijos[k]} onChange={v => setFijo(k, v)} suffix="$" />)}
        </Card>
        <Card title="Cobros">
          <Field label="Comisión promedio de los cobros digitales" value={calc.comision} onChange={v => upd(c => ({ ...c, comision: v }))} suffix="%" hint="Mezcla de débito y crédito, con IVA. Mirá la sección Cobros." />
          <Field label="Ventas que esperás cobrar en digital" value={calc.pctDigital} onChange={v => upd(c => ({ ...c, pctDigital: v }))} suffix="%" hint="El resto, en efectivo (sin comisión)." />
        </Card>
      </div>
      <Card title="Tus productos" className="kf-prods">
        <div className="kf-prod kf-prod--head"><span>Producto</span><span>Costo</span><span>Precio</span><span>Unidades estimadas</span><span /></div>
        {calc.productos.map(p => (
          <div key={p.id} className="kf-prod">
            <input type="text" aria-label="Producto" placeholder="Nombre" value={p.nombre} onChange={e => setProd(p.id, 'nombre', e.target.value)} />
            <input type="text" inputMode="decimal" aria-label="Costo por unidad" placeholder="Costo $" value={p.costo} onChange={e => setProd(p.id, 'costo', e.target.value)} />
            <input type="text" inputMode="decimal" aria-label="Precio de venta" placeholder="Precio $" value={p.precio} onChange={e => setProd(p.id, 'precio', e.target.value)} />
            <input type="text" inputMode="decimal" aria-label="Unidades que esperás vender" placeholder="Unid." value={p.unid} onChange={e => setProd(p.id, 'unid', e.target.value)} />
            <button type="button" aria-label="Quitar producto" onClick={() => upd(c => ({ ...c, productos: c.productos.length > 1 ? c.productos.filter(x => x.id !== p.id) : [blankProduct()] }))}>×</button>
          </div>
        ))}
        <button type="button" className="kf-btn kf-btn--soft" onClick={() => upd(c => ({ ...c, productos: [...c.productos, blankProduct()] }))}>+ Agregar producto</button>
      </Card>

      {show ? (
        <div className="kf-results">
          <h3>Resultado estimado</h3>
          <div className="kf-res-grid">
            <div><span>Ingresos</span><b>{fmt(ing)}</b></div>
            <div><span>Costo de lo vendido</span><b className="neg">{fmt(cv)}</b></div>
            <div><span>Costos fijos</span><b className="neg">{fmt(fijos)}</b></div>
            <div><span>Comisiones</span><b className="neg">{fmt(com)}</b></div>
            <div className="hi"><span>Ganancia neta</span><b className={gan < 0 ? 'neg' : 'pos'}>{fmt(gan)}</b></div>
            <div><span>Margen neto</span><b>{margen}%</b></div>
          </div>
          <p className="kf-eqline">
            {fijos === 0 ? 'Cargá los costos fijos para calcular el punto de equilibrio.'
              : eq == null ? (unid > 0 ? 'Con estos precios no llegás al equilibrio: cada unidad deja menos de lo que cuesta.' : 'Cargá las unidades que esperás vender para calcular el punto de equilibrio.')
              : <>Punto de equilibrio: <b>{eq} unidades</b> (unos {fmt(eq * pProm)}) para cubrir los costos fijos.{unid > 0 && unid < eq ? ' Tu estimación de ventas no llega.' : ''}</>}
          </p>
          <Tip tone="oscuro">{tip}</Tip>
        </div>
      ) : <p className="kf-empty">Cargá tus costos y productos para ver el resultado.</p>}
      <button type="button" className="kf-link" onClick={() => window.confirm('¿Limpiar la calculadora?') && upd(() => blankCalc())}>Limpiar calculadora</button>
    </>
  );
}

const COBROS = [
  ['Mercado Pago', 'Muy usado en ferias', 'verde', 'QR, link de pago y lector Point. La comisión depende de cómo paga tu cliente (débito, crédito o dinero en cuenta) y de cuándo querés el dinero: al instante cuesta más que a unos días. Con QR, por ejemplo, la página oficial muestra 1,35% + IVA en débito y 5,99% + IVA en crédito con acreditación al instante.', 'https://www.mercadopago.com.ar/herramientas-para-vender/cobrar-con-qr'],
  ['MODO', 'Billetera de los bancos', 'celeste', 'No suma una comisión propia: pagás la de la procesadora con la que cobrás (Payway, Fiserv u otra). Te conviene si ya tenés terminal o cuenta para comercios en tu banco.', 'https://www.modo.com.ar/blog/como-aceptar-pagos-con-qr-con-modo-en-tu-comercio'],
  ['Ualá Bis', 'Lector propio', 'ambar', 'Con su lector POS Mini, la página oficial informa 2,9% + IVA con débito y 4,9% + IVA con crédito, con el dinero acreditado en el momento.', 'https://www.ualabis.com.ar/pos-mini'],
  ['BNA+', 'Banco Nación', 'celeste', 'La billetera del Banco Nación. Útil si tus clientes tienen cuenta en el banco. Consultá en tu sucursal las condiciones para comercios.', null],
  ['Transferencia', 'Por alias o CBU', 'verde', 'Por lo general, sin comisión. Pedí el comprobante y confirmá que el dinero entró antes de entregar el producto.', null],
  ['Efectivo', 'Tené cambio', 'ambar', 'Sin comisión, pero exige control. Llevá cambio suficiente y nunca lo descartes como opción.', null],
];

function Cobros() {
  return (
    <>
      <div className="kf-cobros">
        {COBROS.map(([n, tag, color, desc, url]) => (
          <div key={n} className="kf-card kf-cobro">
            <h4>{n}</h4><span className={`kf-tag kf-tag--${color}`}>{tag}</span>
            <p>{desc}</p>
            {url && <a href={url} target="_blank" rel="noopener noreferrer">Ver tarifas vigentes →</a>}
          </div>
        ))}
      </div>
      <p className="kf-revisado">Revisado en octubre 2026. Las comisiones cambian seguido y se les suma IVA (21%): verificalas en la app o en la ayuda oficial antes de la feria.</p>
      <Card title="Efectivo o digital: qué cambia en tu balance">
        <div className="kf-speech">
          <div><span>Efectivo</span><p>Sin comisión y con el dinero en la mano. Exige cambio y control manual, y con mucha gente es fácil equivocarse con el vuelto.</p></div>
          <div><span>Digital (QR, billetera o tarjeta)</span><p>Tiene comisión, que varía según la plataforma y el medio de pago. A cambio, no hay errores de vuelto y cada venta queda registrada. La acreditación va de inmediata a algunos días.</p></div>
          <div><span>Recomendación</span><p>Tené al menos dos opciones digitales distintas, más efectivo. Si un QR falla, la otra es tu respaldo.</p></div>
        </div>
      </Card>
      <Tip><strong>Antes de la feria:</strong> hacé una compra de prueba con cada billetera. Un QR que no funciona el día del evento te puede costar ventas importantes.</Tip>
    </>
  );
}

function Roi({ roi, ventas, set, openTab }) {
  const upd = (k, v) => set('roi', r => ({ ...r, [k]: v }));
  const traer = () => {
    const ef = ventas.filter(v => v.medio === 'efect').reduce((a, v) => a + v.monto, 0);
    const dig = ventas.filter(v => v.medio !== 'efect').reduce((a, v) => a + v.monto, 0);
    set('roi', r => ({ ...r, ef: String(Math.round(ef)), dig: String(Math.round(dig)), dias: String(new Set(ventas.map(v => dayKey(v.ts))).size || 1) }));
  };
  const ing = num(roi.ef) + num(roi.dig) - num(roi.com);
  const costo = num(roi.stand) + num(roi.tras) + num(roi.ins) + num(roi.otros);
  const gan = ing - costo;
  const dias = Math.max(1, num(roi.dias));
  const cont = num(roi.cont);
  const obj = num(roi.obj);
  const pctRoi = costo > 0 ? Math.round((gan / costo) * 100) : null;
  const show = ing !== 0 || costo > 0;

  let dec = null;
  if (show && costo === 0) dec = ['maybe', 'Cargá los costos del evento para calcular el ROI.', ''];
  else if (show && gan > 0 && pctRoi >= 20) dec = ['go', '✓ Feria rentable: vale la pena repetirla', `ROI del ${pctRoi}%: por cada $1 invertido volvieron $${(1 + pctRoi / 100).toFixed(2).replace('.', ',')}.${obj > 0 ? ` Llegaste al ${Math.round((ing / obj) * 100)}% de tu objetivo de ventas.` : ''}${cont ? ` Además, los ${cont} contactos y ${num(roi.seg)} seguidores nuevos son un retorno que no se ve en la caja.` : ''}`];
  else if (show && gan > 0) dec = ['maybe', '~ Feria positiva pero con margen bajo: optimizá costos', `ROI del ${pctRoi}%. Cubriste los costos y ganaste, pero el margen es ajustado. Para la próxima: bajá gastos fijos o trabajá el ticket promedio.${cont ? ` Cada contacto nuevo te costó ${fmt(costo / cont)}.` : ''}`];
  else if (show) dec = ['no', '✗ Feria con pérdida: revisá la estrategia antes de repetir', `Perdiste ${fmt(Math.abs(gan))}. Antes de volver, revisá precios, costos del stand y la comunicación previa.${cont ? ` Los ${cont} contactos que conseguiste pueden ser una inversión a largo plazo si les hacés seguimiento.` : ''}`];

  return (
    <>
      {ventas.length > 0 && (
        <div className="kf-traer">
          <span>Tenés {ventas.length} ventas en <b>Ventas del día</b>.</span>
          <button type="button" className="kf-btn kf-btn--soft" onClick={traer}>Traer ventas del tracker</button>
        </div>
      )}
      {ventas.length === 0 && <p className="kf-muted kf-mb">¿Registraste tus ventas en <button type="button" className="kf-link-inline" onClick={() => openTab('tracker')}>Ventas del día</button>? Desde acá las traés con un clic.</p>}
      <div className="kf-calc kf-calc--3">
        <Card title="Ingresos reales">
          <Field label="Vendido en efectivo" value={roi.ef} onChange={v => upd('ef', v)} suffix="$" />
          <Field label="Vendido en digital" value={roi.dig} onChange={v => upd('dig', v)} suffix="$" />
          <Field label="Comisiones pagadas" value={roi.com} onChange={v => upd('com', v)} suffix="$" hint="Las ves en el resumen de cada billetera." />
        </Card>
        <Card title="Costos reales">
          <Field label="Stand e inscripción" value={roi.stand} onChange={v => upd('stand', v)} suffix="$" />
          <Field label="Traslado y viáticos" value={roi.tras} onChange={v => upd('tras', v)} suffix="$" />
          <Field label="Mercadería e insumos" value={roi.ins} onChange={v => upd('ins', v)} suffix="$" />
          <Field label="Otros costos" value={roi.otros} onChange={v => upd('otros', v)} suffix="$" />
        </Card>
        <Card title="Más allá de la caja">
          <Field label="Contactos nuevos" value={roi.cont} onChange={v => upd('cont', v)} />
          <Field label="Seguidores nuevos en redes" value={roi.seg} onChange={v => upd('seg', v)} />
          <Field label="Días de feria" value={roi.dias} onChange={v => upd('dias', v)} placeholder="1" />
          <Field label="Objetivo de ventas que tenías" value={roi.obj} onChange={v => upd('obj', v)} suffix="$" />
        </Card>
      </div>
      {show && (
        <div className="kf-results">
          <h3>Análisis de resultados</h3>
          <div className="kf-res-grid">
            <div><span>Ingreso neto</span><b>{fmt(ing)}</b></div>
            <div><span>Costos totales</span><b className="neg">{fmt(costo)}</b></div>
            <div className="hi"><span>Ganancia real</span><b className={gan < 0 ? 'neg' : 'pos'}>{fmt(gan)}</b></div>
            <div><span>ROI de la feria</span><b>{pctRoi == null ? '—' : pctRoi + '%'}</b></div>
            <div><span>Venta por día</span><b>{fmt(ing / dias)}</b></div>
            <div><span>Costo por contacto</span><b>{cont > 0 && costo > 0 ? fmt(costo / cont) : '—'}</b></div>
          </div>
          <div className={`kf-dec kf-dec--${dec[0]}`}>{dec[1]}</div>
          {dec[2] && <p className="kf-analisis">{dec[2]}</p>}
        </div>
      )}
      <Tip><strong>Más allá del dinero:</strong> los contactos, los seguidores y el reconocimiento de tu marca también son retorno. Medí todo.</Tip>
      <button type="button" className="kf-link" onClick={() => window.confirm('¿Limpiar el ROI?') && set('roi', () => blankRoi())}>Limpiar ROI</button>
    </>
  );
}

createRoot(document.getElementById('root')).render(<Kit />);
