// Landing de Kit Feriante PRO (/pro): gratis por 12 meses durante el lanzamiento.
// Entrar con Google → contar del emprendimiento (localidad, rubro, WhatsApp opcional, consentimiento)
// → PRO activo solo (POST /api/pro/join). El Kit gratis sigue abierto sin cuenta.
// ?campana=charla-nov (o ?c=) guarda de dónde vino la persona; sobrevive al login con Google.
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './ds/tokens/fonts.css';
import './ds/tokens/colors.css';
import './ds/tokens/typography.css';
import './ds/tokens/spacing.css';
import './app.css';
import './kit-feriante.css';
import logoPetrol from './ds/assets/logo-petrol.png';
import { Footer } from './Footer.jsx';
import { api } from './lib/api.js';
import { fecha } from './kit/pro.jsx';
import { watchVersion } from './lib/version.js';

const CAMPANA = 'relab-pro:campana';
const RUBROS = ['Textiles', 'Indumentaria', 'Accesorios y bijou', 'Cerámica', 'Madera', 'Cuero', 'Cosmética natural', 'Velas y aromas', 'Alimentos', 'Plantas', 'Arte e ilustración', 'Juguetes'];
const FERIAS = [['ocasional', 'Cada tanto'], ['1', '1 por mes'], ['2-3', '2 o 3 por mes'], ['4+', '4 o más']];
const store = {
  get: () => { try { return localStorage.getItem(CAMPANA) || ''; } catch { return ''; } },
  set: v => { try { localStorage.setItem(CAMPANA, v); } catch { /* */ } },
};

const MODULOS = [
  ['Mis ferias', 'Cada feria con sus fechas, sus gastos y su resultado: cuánto cobraste y cuánto te quedó.'],
  ['Mis productos', 'Tu catálogo con costos, precios, variantes y el margen de cada producto.'],
  ['Ventas PRO', 'Vendé con un toque: cantidades, descuentos y lo que te queda después de las comisiones.'],
  ['Stock', 'Cada venta descuenta sola y el kit te avisa antes de que te quedes sin un producto.'],
];
const FAQ = [
  ['¿Tiene costo?', 'No. Durante el lanzamiento, Kit Feriante PRO es gratis por 12 meses. No te pedimos tarjeta ni datos de pago.'],
  ['¿Qué pasa cuando terminan los 12 meses?', 'No se borra nada. Tus ferias, productos y ventas quedan guardados y los podés ver y descargar. Te vamos a avisar antes con las opciones para seguir.'],
  ['¿Quién ve mis ventas?', 'Nadie más que vos. Lo que cargás se guarda cifrado y no lo leemos ni lo usamos para nada más que mostrártelo a vos.'],
  ['¿Funciona sin señal?', 'Sí. Si en la feria no hay señal, las ventas quedan en el celular y se suben solas cuando vuelve.'],
  ['¿Y las herramientas gratis?', 'Siguen gratis y abiertas, como siempre: checklist, calculadora, cobros, pitch, visitantes, ventas del día y ROI.'],
];

function Landing() {
  const [estado, setEstado] = useState('cargando'); // cargando | anonimo | form | listo | cerrado
  const [user, setUser] = useState(null);
  const [pro, setPro] = useState(null);
  const [f, setForm] = useState({ whatsapp: '', localidad: '', rubro: '', feriasMes: '', acepta: false });
  const [err, setErr] = useState('');
  const setF = v => { setForm(v); setErr(''); };
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const c = q.get('campana') || q.get('c');
    if (c && /^[\w-]{1,40}$/.test(c)) store.set(c.toLowerCase());
    if (c) history.replaceState(null, '', location.pathname + location.hash);
    (async () => {
      const m = await api.me();
      if (!m.user) return setEstado('anonimo');
      setUser(m.user);
      const p = await api.proMe();
      setPro(p);
      setEstado(p.pro ? 'listo' : 'form');
    })();
  }, []);

  const enviar = async e => {
    e.preventDefault();
    setErr('');
    if (!f.localidad.trim()) return setErr('Contanos tu localidad.');
    if (!f.rubro.trim()) return setErr('Contanos qué vendés.');
    if (f.whatsapp.trim() && !/^\+?[\d\s()-]{6,30}$/.test(f.whatsapp.trim())) return setErr('Revisá el WhatsApp: solo números, por ejemplo 383 412 3456.');
    setBusy(true);
    const r = await api.proJoin({ ...f, campana: store.get() || null });
    setBusy(false);
    if (r.status === 200 && r.body.pro) { setPro({ pro: true, endsAt: r.body.endsAt }); setEstado('listo'); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (r.body?.error === 'launch_closed') return setEstado('cerrado');
    if (r.status === 401) return setEstado('anonimo');
    setErr(r.body?.field ? 'Revisá los datos marcados.' : r.status === 0 ? 'No hay conexión. Probá de nuevo en un rato.' : 'No pudimos activar PRO. Probá de nuevo en un rato.');
  };

  const nombre = user?.name ? user.name.split(' ')[0] : '';
  const cta = (
    <div className="kf-pl-cta">
      {estado === 'cargando' && <p>Cargando…</p>}
      {estado === 'anonimo' && (
        <>
          <button type="button" className="kf-btn kf-btn--coral" onClick={api.login}>Activar PRO gratis con Google</button>
          <small>Usamos tu cuenta de Google solo para identificarte. No publicamos nada en tu nombre.</small>
        </>
      )}
      {estado === 'listo' && (
        <div className="kf-pl-ok">
          <p><b>¡Listo{nombre ? `, ${nombre}` : ''}!</b> Tenés Kit Feriante PRO hasta el {fecha(pro.endsAt)}.</p>
          <a className="kf-btn kf-btn--coral" href="/kit-feriante/#ferias">Empezar: cargá tu próxima feria →</a>
        </div>
      )}
      {estado === 'cerrado' && <p>El lanzamiento gratis de Kit Feriante PRO ya cerró. Escribinos y te contamos cómo seguir.</p>}
    </div>
  );

  return (
    <div className="kf">
      <header className="kf-topbar">
        <div className="kf-topbar-in">
          <a href="/kit-feriante/" className="kf-brand"><img src={logoPetrol} alt="ST Relaciones Públicas" /><span>Kit <b>feriante</b> PRO</span></a>
          <div className="kf-bar-r"><a href="/" className="kf-relab"><span className="lg">un recurso <b>relab</b></span><span className="sm">‹ Recursos</span></a></div>
        </div>
      </header>

      <section className="kf-hero">
        <div className="kf-wrap kf-pl-hero">
          <p className="kf-kicker">Kit Feriante PRO · gratis por lanzamiento</p>
          <h1>Tu feria, ordenada en el celular</h1>
          <p className="kf-lead">Cargá tus productos una vez, vendé con un toque, llevá el stock al día y sabé cuánto te dejó cada feria. <b>Gratis por 12 meses.</b></p>
          {estado !== 'form' && cta}
          {estado === 'form' && <a className="kf-btn kf-btn--coral" href="#activar">Completar y activar PRO ↓</a>}
        </div>
      </section>

      <main className="kf-wrap kf-pl">
        {estado === 'form' && (
          <form className="kf-card kf-pro-form kf-pl-form" id="activar" onSubmit={enviar}>
            <h2>{nombre ? `${nombre}, contanos` : 'Contanos'} de tu emprendimiento</h2>
            <p>Son 30 segundos. Nos sirve para mejorar el kit y avisarte novedades.</p>
            <div className="kf-pro-grid">
              <label className="kf-field"><span>Localidad</span><input value={f.localidad} onChange={e => setF({ ...f, localidad: e.target.value })} placeholder="Belén, Catamarca" maxLength={80} autoComplete="address-level2" /></label>
              <label className="kf-field"><span>¿Qué vendés?</span><input value={f.rubro} onChange={e => setF({ ...f, rubro: e.target.value })} placeholder="Textiles" maxLength={60} list="kf-rubros" /><datalist id="kf-rubros">{RUBROS.map(r => <option key={r} value={r} />)}</datalist></label>
              <label className="kf-field"><span>WhatsApp <small>(opcional)</small></span><input type="tel" value={f.whatsapp} onChange={e => setF({ ...f, whatsapp: e.target.value })} placeholder="383 412 3456" maxLength={30} autoComplete="tel" /></label>
            </div>
            <fieldset className="kf-pl-radios">
              <legend>¿En cuántas ferias participás?</legend>
              {FERIAS.map(([k, l]) => <label key={k}><input type="radio" name="ferias" checked={f.feriasMes === k} onChange={() => setF({ ...f, feriasMes: k })} />{l}</label>)}
            </fieldset>
            <label className="kf-pl-check"><input type="checkbox" checked={f.acepta} onChange={e => setF({ ...f, acepta: e.target.checked })} />
              <span>Quiero recibir novedades, capacitaciones y servicios de ST Relaciones Públicas por mail o WhatsApp. Me puedo dar de baja cuando quiera.</span></label>
            {err && <p className="kf-err" role="alert">{err}</p>}
            <button type="submit" className="kf-btn kf-btn--coral" disabled={busy}>{busy ? 'Activando…' : 'Activar Kit Feriante PRO gratis'}</button>
            <small>Al activar aceptás la <a href="/privacidad/" target="_blank" rel="noopener">política de privacidad</a>. Entraste como {user?.email}.</small>
          </form>
        )}

        <section className="kf-moment">
          <div className="kf-moment-h"><span>✦</span><div><h2>Qué incluye</h2><p>Además de las 7 herramientas gratis del kit</p></div></div>
          <div className="kf-cards">
            {MODULOS.map(([t, d]) => <div key={t} className="kf-tool kf-pl-mod"><span className="kf-tool-t">{t}</span><span className="kf-tool-d">{d}</span><span className="kf-st kf-st--pro">PRO</span></div>)}
          </div>
        </section>

        <section className="kf-moment">
          <div className="kf-moment-h"><span>✓</span><div><h2>Cómo se activa</h2><p>Sin tarjeta y sin códigos</p></div></div>
          <ol className="kf-pl-steps">
            <li><b>Entrás con tu cuenta de Google.</b> Es la misma para todos los recursos de Relab.</li>
            <li><b>Nos contás de tu emprendimiento.</b> Localidad, qué vendés y, si querés, tu WhatsApp.</li>
            <li><b>Listo.</b> Tenés PRO por 12 meses en el celular y en la compu.</li>
          </ol>
        </section>

        <section className="kf-moment">
          <div className="kf-moment-h"><span>?</span><div><h2>Preguntas frecuentes</h2></div></div>
          <div className="kf-pl-faq">{FAQ.map(([q, a]) => <details key={q} className="kf-card"><summary>{q}</summary><p>{a}</p></details>)}</div>
        </section>

        {estado !== 'form' && <div className="kf-pl-end">{cta}</div>}
      </main>
      <Footer />
    </div>
  );
}

watchVersion();
createRoot(document.getElementById('root')).render(<Landing />);
