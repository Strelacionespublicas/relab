// Instalación como app (PWA), compartida por TextoRedes y el Kit del feriante.
// - El diálogo de instalación de Android/Chrome puede llegar antes de que React monte: se guarda en
//   window.__installPrompt y se avisa con el evento 'installprompt-ready' (lo usa InstallBanner).
// - Registra /sw.js (public/sw.js), que deja abrir las apps sin conexión. Solo en producción.
export function setupInstall() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    window.__installPrompt = e;
    window.dispatchEvent(new Event('installprompt-ready'));
  });
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
}
