// Panel de administración de Relab: códigos de acceso a Kit Feriante PRO.
// Solo para los emails de ADMIN_EMAILS (lo controla el servidor). Muestra cantidades, nunca datos
// ni contenido de las personas.
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './ds/tokens/fonts.css';
import './ds/tokens/colors.css';
import './ds/tokens/typography.css';
import './ds/tokens/spacing.css';
import './app.css';
import './kit-feriante.css';
import logoPetrol from './ds/assets/logo-petrol.png';
import { api } from './lib/api.js';
import { fecha } from './kit/pro.jsx';

const KIT_URL = `${location.origin}/kit-feriante/`;
const copy = async (text, setMsg) => {
  try { await navigator.clipboard.writeText(text); setMsg('Copiado'); } catch { setMsg('No se pudo copiar: seleccioná el texto y copialo a mano'); }
  setTimeout(() => setMsg(''), 2500);
};
// Fecha del formulario (AAAA-MM-DD) → fin de ese día en hora argentina (UTC-3).
const endOfDayAR = d => (d ? Date.parse(`${d}T23:59:59-03:00`) : null);

function Admin() {
  const [state, setState] = useState('cargando'); // cargando | sin-sesion | sin-acceso | ok | error
  const [codes, setCodes] = useState([]);
  const [form, setForm] = useState({ label: '', maxUses: '100', days: '365', until: '' });
  const [nuevo, setNuevo] = useState(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [reg, setReg] = useState(null);

  const load = async () => {
    const r = await api.adminCodes();
    if (r.status === 401) return setState('sin-sesion');
    if (r.status === 403) return setState('sin-acceso');
    if (r.status !== 200) return setState('error');
    setCodes(r.body.codes);
    setState('ok');
    const g = await api.adminRegistros();
    if (g.status === 200) setReg(g.body);
  };
  useEffect(() => { load(); }, []);

  const crear = async e => {
    e.preventDefault();
    setErr('');
    const data = { label: form.label.trim(), maxUses: Number(form.maxUses), days: Number(form.days), redeemUntil: endOfDayAR(form.until) };
    const r = await api.adminCreateCode(data);
    if (r.status !== 200) return setErr('Revisá los datos: nombre de la campaña, cupo (1 a 100.000), días (1 a 1095) y una fecha límite futura.');
    setNuevo(r.body);
    setForm(f => ({ ...f, label: '', until: '' }));
    load();
  };
  const toggle = async c => {
    if (c.active && !window.confirm(`¿Desactivar "${c.label}"? Nadie más va a poder canjearlo. Quien ya lo canjeó sigue con PRO.`)) return;
    await api.adminSetCode(c.id, !c.active);
    load();
  };

  const totalUses = codes.reduce((n, c) => n + c.uses, 0);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="kf">
      <header className="kf-topbar">
        <div className="kf-topbar-in">
          <a href="/" className="kf-brand"><img src={logoPetrol} alt="ST Relaciones Públicas" /><span>Relab · <b>admin</b></span></a>
        </div>
      </header>
      <main className="kf-wrap" style={{ paddingTop: 24, paddingBottom: 48, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <p className="kf-kicker">Kit Feriante PRO</p>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', color: 'var(--st-petroleo)' }}>Registros y códigos</h1>
        </div>

        {state === 'cargando' && <p>Cargando…</p>}
        {state === 'sin-sesion' && <p>Ingresá con tu cuenta de Google. <button type="button" className="kf-btn kf-btn--coral kf-btn--sm" onClick={api.login}>Ingresar</button></p>}
        {state === 'sin-acceso' && <p>Esta cuenta no tiene acceso al panel.</p>}
        {state === 'error' && <p>No se pudo cargar el panel. Si la base todavía no tiene la migración 0004, hay que aplicarla. <button type="button" className="kf-btn kf-btn--soft kf-btn--sm" onClick={load}>Reintentar</button></p>}

        {state === 'ok' && (
          <>
            {nuevo && (
              <div className="kf-card" style={{ borderColor: 'var(--st-success)' }}>
                <h3 className="kf-card-title">Código creado: {nuevo.label}</h3>
                <p><b>Copialo ahora:</b> por seguridad no se vuelve a mostrar.</p>
                <p style={{ fontFamily: 'var(--font-data)', fontSize: 22, letterSpacing: '.08em', margin: '8px 0' }}>{nuevo.code}</p>
                <p style={{ wordBreak: 'break-all', fontSize: 13 }}>{KIT_URL}?codigo={nuevo.code}</p>
                <div className="kf-modal-act" style={{ justifyContent: 'flex-start' }}>
                  <button type="button" className="kf-btn kf-btn--coral kf-btn--sm" onClick={() => copy(nuevo.code, setMsg)}>Copiar código</button>
                  <button type="button" className="kf-btn kf-btn--soft kf-btn--sm" onClick={() => copy(`${KIT_URL}?codigo=${nuevo.code}`, setMsg)}>Copiar link para el mail</button>
                  <button type="button" className="kf-btn kf-btn--soft kf-btn--sm" onClick={() => setNuevo(null)}>Ya lo guardé</button>
                  {msg && <span role="status">{msg}</span>}
                </div>
              </div>
            )}

            <div className="kf-card">
              <h3 className="kf-card-title">Registros desde /pro (lanzamiento gratis)</h3>
              {!reg ? <p>Todavía no hay datos (o falta la migración 0006).</p> : (
                <>
                  <div className="kf-pro-nums" style={{ fontSize: 15 }}>
                    <span>Registradas <b>{reg.total}</b></span>
                    <span>Aceptaron novedades <b>{reg.acepta}</b></span>
                    <span>Cuentas PRO con productos <b>{reg.conProductos}</b></span>
                    <span>Cuentas PRO con ventas <b>{reg.conVentas}</b></span>
                  </div>
                  {reg.campanas.length > 0 && <p style={{ fontSize: 14 }}>Por campaña: {reg.campanas.map(c => `${c.campana} (${c.n})`).join(' · ')}</p>}
                  {reg.rubros.length > 0 && <p style={{ fontSize: 14 }}>Rubros: {reg.rubros.map(c => `${c.rubro} (${c.n})`).join(' · ')}</p>}
                  <div className="kf-modal-act" style={{ justifyContent: 'flex-start' }}>
                    {reg.acepta > 0 && <a className="kf-btn kf-btn--coral kf-btn--sm" href="/api/admin/registros?formato=csv">Descargar contactos (Excel / CSV)</a>}
                    <button type="button" className="kf-btn kf-btn--soft kf-btn--sm" onClick={() => copy(`${location.origin}/pro/?campana=`, setMsg)}>Copiar link de la landing</button>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>La descarga incluye solo a quienes aceptaron recibir novedades. Para saber de dónde vino cada persona, agregá el nombre de la campaña al final del link, por ejemplo <b>/pro/?campana=charla-nov</b>.</p>
                </>
              )}
            </div>

            <form className="kf-card" onSubmit={crear} style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', alignItems: 'end' }}>
              <h3 className="kf-card-title" style={{ gridColumn: '1 / -1' }}>Nuevo código</h3>
              <label className="kf-field"><span>Campaña</span><span className="kf-input-wrap"><input value={form.label} onChange={set('label')} placeholder="Charla noviembre 2026" maxLength={80} required /></span></label>
              <label className="kf-field"><span>Cupo (personas)</span><span className="kf-input-wrap"><input type="number" min="1" max="100000" value={form.maxUses} onChange={set('maxUses')} required /></span></label>
              <label className="kf-field"><span>Días de PRO</span><span className="kf-input-wrap"><input type="number" min="1" max="1095" value={form.days} onChange={set('days')} required /></span><small>365 = 12 meses desde el canje</small></label>
              <label className="kf-field"><span>Se puede canjear hasta</span><span className="kf-input-wrap"><input type="date" value={form.until} onChange={set('until')} /></span><small>Vacío = sin fecha límite</small></label>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="submit" className="kf-btn kf-btn--coral kf-btn--sm">Crear código</button>
                {err && <small className="kf-err" role="alert">{err}</small>}
              </div>
            </form>

            <div className="kf-card">
              <h3 className="kf-card-title">Campañas · {totalUses} {totalUses === 1 ? 'canje' : 'canjes'} en total</h3>
              {!codes.length ? <p>Todavía no hay códigos.</p> : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead><tr style={{ textAlign: 'left' }}><th>Campaña</th><th>Canjes</th><th>Días</th><th>Canje hasta</th><th>Creado</th><th>Estado</th><th /></tr></thead>
                    <tbody>
                      {codes.map(c => (
                        <tr key={c.id} style={{ borderTop: '1px solid var(--st-neutral-200)', opacity: c.active ? 1 : 0.55 }}>
                          <td style={{ padding: '8px 6px 8px 0' }}>{c.label}</td>
                          <td>{c.uses} / {c.maxUses}</td>
                          <td>{c.days}</td>
                          <td>{c.redeemUntil ? fecha(c.redeemUntil) : '—'}</td>
                          <td>{fecha(c.createdAt)}</td>
                          <td>{c.active ? 'Activo' : 'Desactivado'}</td>
                          <td><button type="button" className="kf-btn kf-btn--soft kf-btn--sm" onClick={() => toggle(c)}>{c.active ? 'Desactivar' : 'Reactivar'}</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12 }}>Por privacidad, el panel muestra solo cantidades: no quién canjeó ni nada de lo que cargan en el Kit.</p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Admin />);
