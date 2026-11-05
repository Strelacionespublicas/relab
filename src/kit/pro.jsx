// Acceso PRO en el Kit: insignia "PRO hasta…", canje de códigos y link con ?codigo= (el del mail).
// El permiso lo decide el servidor (/api/pro/me y /api/pro/redeem); acá solo se muestra.
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';

// El botón "Tengo un código" se muestra recién cuando los módulos PRO estén listos (Paso 3).
// El link con ?codigo= y la insignia funcionan siempre.
export const PRO_ENABLED = import.meta.env.VITE_PRO_ENABLED === '1';
const PENDING = 'relab-kit-feriante:codigo';

export const fecha = ms => new Date(ms).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const ERRORS = {
  invalid_code: 'Ese código no existe o ya no está activo. Revisá que esté bien escrito.',
  expired: 'Este código ya venció.',
  no_uses_left: 'Este código ya alcanzó su cupo.',
  already_redeemed: 'Ya usaste este código.',
  unauthorized: 'Tu sesión venció. Ingresá de nuevo con Google.',
  network: 'No hay conexión. Probá de nuevo en un rato.',
};
export const redeemMessage = r => {
  if (r.status === 200) return { ok: true, text: `¡Listo! Tenés Kit Feriante PRO hasta el ${fecha(r.body.endsAt)}.` };
  if (r.body?.error === 'already_pro') return { ok: true, text: `Ya tenés PRO activo hasta el ${fecha(r.body.endsAt)}. Guardá el código para más adelante.` };
  return { ok: false, text: ERRORS[r.body?.error] || 'No pudimos activar el código. Probá de nuevo.' };
};

// FERIAABCD2345 / feria-abcd-2345 → FERIA-ABCD-2345 (solo para mostrar; el servidor normaliza igual).
const showCode = c => {
  const s = String(c).toUpperCase().replace(/[^0-9A-Z]/g, '');
  return /^FERIA[0-9A-Z]{8}$/.test(s) ? `FERIA-${s.slice(5, 9)}-${s.slice(9)}` : String(c).toUpperCase();
};

const store = {
  get: () => { try { return localStorage.getItem(PENDING) || ''; } catch { return ''; } },
  set: v => { try { localStorage.setItem(PENDING, v); } catch { /* */ } },
  clear: () => { try { localStorage.removeItem(PENDING); } catch { /* */ } },
};

// Estado PRO de la persona + el modal de canje. `ready` = ya se sabe si hay sesión.
export function useProAccess({ user, ready }) {
  const [pro, setPro] = useState(null);
  const [modal, setModal] = useState(null); // null | { code, result? }
  const email = user?.email;

  // Link del mail: /kit-feriante/?codigo=FERIA-XXXX-XXXX. Se guarda (sobrevive al login con Google)
  // y se saca de la barra de direcciones.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const c = params.get('codigo');
    if (!c) return;
    store.set(c.slice(0, 40).toUpperCase().replace(/\s+/g, ''));
    params.delete('codigo');
    const qs = params.toString();
    history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : '') + location.hash);
  }, []);

  useEffect(() => {
    if (!email) { setPro(null); return; }
    let live = true;
    api.proMe().then(r => { if (live) setPro(r); });
    return () => { live = false; };
  }, [email]);

  // Con un código pendiente: si hay sesión, se canjea solo; si no, se pide ingresar.
  const tried = useRef(false);
  useEffect(() => {
    if (!ready || tried.current) return;
    const pending = store.get();
    if (!pending) return;
    tried.current = true;
    if (!user) { setModal({ code: pending }); return; }
    store.clear();
    setModal({ code: pending, busy: true });
    api.proRedeem(pending).then(r => {
      setModal({ code: pending, result: redeemMessage(r) });
      if (r.status === 200 || r.body?.error === 'already_pro') api.proMe().then(setPro);
    });
  }, [ready, user]);

  const redeem = async code => {
    setModal({ code, busy: true });
    const r = await api.proRedeem(code);
    const result = redeemMessage(r);
    setModal({ code, result });
    if (r.status === 200) setPro(await api.proMe());
  };

  return {
    pro, modal,
    openModal: () => setModal({ code: '' }),
    closeModal: () => setModal(null),
    redeem,
    keepForLogin: code => store.set(code),
  };
}

export function ProBadge({ pro }) {
  if (!pro?.pro) return null;
  return <span className="kf-pro" title={pro.label ? `Código: ${pro.label}` : undefined}>PRO <small>hasta {fecha(pro.endsAt)}</small></span>;
}

export function CodeModal({ access, user, onLogin }) {
  const m = access.modal;
  const [code, setCode] = useState('');
  useEffect(() => { if (m) setCode(m.code || ''); }, [m?.code]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!m) return null;
  const close = access.closeModal;
  return (
    <div className="kf-modal-bg" onClick={close}>
      <div className="kf-modal" role="dialog" aria-modal="true" aria-labelledby="kf-code-t" onClick={e => e.stopPropagation()}>
        <p className="kf-kicker">Kit Feriante PRO</p>
        <h2 id="kf-code-t">Activá tu código</h2>
        {m.result ? (
          <>
            <p className={`kf-modal-msg ${m.result.ok ? 'ok' : 'err'}`} role="status">{m.result.text}</p>
            <div className="kf-modal-act">
              {!m.result.ok && <button type="button" className="kf-btn kf-btn--soft kf-btn--sm" onClick={() => access.openModal()}>Probar otro código</button>}
              <button type="button" className="kf-btn kf-btn--coral kf-btn--sm" onClick={close}>Listo</button>
            </div>
          </>
        ) : !user ? (
          <>
            <p>Para activar PRO, ingresá con tu cuenta de Google. Tu código {code && <b>{showCode(code)}</b>} queda guardado y se activa al volver.</p>
            <div className="kf-modal-act">
              <button type="button" className="kf-btn kf-btn--soft kf-btn--sm" onClick={close}>Ahora no</button>
              <button type="button" className="kf-btn kf-btn--coral kf-btn--sm" onClick={() => { if (code) access.keepForLogin(code); onLogin(); }}>Continuar con Google</button>
            </div>
          </>
        ) : (
          <form onSubmit={e => { e.preventDefault(); if (code.trim()) access.redeem(code); }}>
            <label className="kf-field">
              <span>Código</span>
              <span className="kf-input-wrap"><input type="text" value={code} onChange={e => setCode(e.target.value)} placeholder="FERIA-XXXX-XXXX" autoCapitalize="characters" autoComplete="off" autoFocus /></span>
              <small>Lo recibiste por mail o en una capacitación.</small>
            </label>
            <div className="kf-modal-act">
              <button type="button" className="kf-btn kf-btn--soft kf-btn--sm" onClick={close}>Cancelar</button>
              <button type="submit" className="kf-btn kf-btn--coral kf-btn--sm" disabled={m.busy || !code.trim()}>{m.busy ? 'Activando…' : 'Activar'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
