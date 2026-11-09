// Aviso de versión nueva. Si el navegador (o una caché de Cloudflare) muestra una copia vieja de la
// página, /version.json —pedido siempre sin caché— trae un id distinto al de este código y aparece una
// barra "Hay una versión nueva · Actualizar". Nunca recarga sola: no corta una venta a la mitad.
// "Actualizar" recarga con ?v=<id>, que también esquiva la caché del HTML.
const BUILD = import.meta.env.VITE_BUILD;
let shown = false;

async function check() {
  if (shown || !import.meta.env.PROD || !BUILD) return;
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const { build } = await res.json();
    if (build && build !== BUILD) show(build);
  } catch { /* sin señal: se prueba en la próxima */ }
}

function show(build) {
  shown = true;
  const bar = document.createElement('div');
  bar.setAttribute('role', 'status');
  bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:300;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:space-between;max-width:560px;margin:0 auto;padding:12px 14px;border-radius:14px;background:#012C3D;color:#fff;font:600 14px/1.35 Karla,Inter,system-ui,sans-serif;box-shadow:0 8px 24px rgba(1,44,61,.35)';
  const txt = document.createElement('span');
  txt.textContent = 'Hay una versión nueva disponible.';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Actualizar';
  btn.style.cssText = 'border:none;border-radius:999px;padding:8px 16px;background:#F8444F;color:#fff;font:inherit;font-weight:700;cursor:pointer';
  btn.onclick = () => {
    const u = new URL(location.href);
    u.searchParams.set('v', build);
    location.replace(u.toString());
  };
  bar.append(txt, btn);
  document.body.appendChild(bar);
}

// Sacar ?v= de la barra de direcciones después de recargar (queda más limpio para compartir el link).
function cleanUrl() {
  const u = new URL(location.href);
  if (!u.searchParams.has('v')) return;
  u.searchParams.delete('v');
  history.replaceState(null, '', u.pathname + u.search + u.hash);
}

export function watchVersion() {
  cleanUrl();
  check();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
}
