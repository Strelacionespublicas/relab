// Aviso para instalar una app de Relab (TextoRedes, Kit del feriante). En Android/Chrome usa el
// diálogo de instalación (capturado en src/lib/install.js); en iPhone explica el paso de "Agregar a
// inicio", que Safari no permite disparar. Sin props es el aviso de TextoRedes.
import { useEffect, useState } from 'react';
import { load, save } from './lib/core.js';

const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export default function InstallBanner({
  name = 'TextoRedes',
  title = 'Tené TextoRedes a un toque',
  text = 'Instalala como app y abrila directo desde tu pantalla de inicio.',
  iosNote = null, // aviso extra solo para iPhone (la app instalada no comparte los datos de Safari)
  icon = '/icons/icon-192.png',
  storageKey = 'textoredes_install_dismissed',
} = {}) {
  const KEY = storageKey;
  const [prompt, setPrompt] = useState(() => window.__installPrompt || null);
  const [hidden, setHidden] = useState(() => isStandalone() || load(KEY, false));

  useEffect(() => {
    const onReady = () => setPrompt(window.__installPrompt);
    const onInstalled = () => setHidden(true);
    window.addEventListener('installprompt-ready', onReady);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('installprompt-ready', onReady); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  const ios = isIOS();
  if (hidden || (!prompt && !ios)) return null;

  const dismiss = () => { save(KEY, true); setHidden(true); };
  const install = async () => {
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    window.__installPrompt = null; setPrompt(null);
    if (outcome === 'accepted') setHidden(true);
  };

  return (
    <div role="region" aria-label={`Instalar ${name}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, boxShadow: 'var(--shadow-sm)' }}>
      <img src={icon} alt="" width="40" height="40" style={{ borderRadius: 10, flex: 'none' }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-sm)', color: 'var(--st-petroleo)' }}>{title}</span>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          {prompt ? text : <>Tocá <strong>Compartir</strong> <span aria-hidden="true">⎋</span> y elegí <strong>Agregar a inicio</strong>.</>}
          {!prompt && iosNote && <> {iosNote}</>}
        </span>
      </div>
      {prompt && <button onClick={install} style={{ flex: 'none', height: 34, padding: '0 14px', borderRadius: 999, border: 'none', background: 'var(--st-coral)', color: 'var(--st-white)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--fs-xs)', cursor: 'pointer' }}>Instalar</button>}
      <button onClick={dismiss} aria-label="Cerrar aviso" title="No mostrar más" style={{ flex: 'none', border: 'none', background: 'none', color: 'var(--text-subtle)', fontSize: 16, cursor: 'pointer', padding: 4 }}>✕</button>
    </div>
  );
}
