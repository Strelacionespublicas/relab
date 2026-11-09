import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Id de esta publicación: el commit (Cloudflare Pages lo da en CF_PAGES_COMMIT_SHA) o, si no hay, la hora.
// Va dentro del código (import.meta.env.VITE_BUILD) y en /version.json: si no coinciden, la página
// avisa que hay una versión nueva (src/lib/version.js). Así una copia vieja en caché se detecta.
const BUILD = (() => {
  if (process.env.CF_PAGES_COMMIT_SHA) return process.env.CF_PAGES_COMMIT_SHA.slice(0, 12);
  try { return execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() + '-' + Date.now().toString(36); } catch { return Date.now().toString(36); }
})();
const versionFile = () => ({
  name: 'relab-version',
  generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD }) }); },
});

// En desarrollo, /api va a `wrangler pages dev` (npm run dev:api) en el puerto 8788.
export default defineConfig({
  plugins: [react(), versionFile()],
  define: { 'import.meta.env.VITE_BUILD': JSON.stringify(BUILD) },
  // Un sitio para todo Relab: la vitrina en / y cada recurso en su carpeta.
  build: { rollupOptions: { input: { relab: 'index.html', textoenredes: 'textoenredes/index.html', privacidad: 'privacidad/index.html', checklist: 'checklist-cyber-monday/index.html', guia: 'guia-herramientas-digitales/index.html', kit: 'kit-feriante/index.html', admin: 'admin/index.html', pro: 'pro/index.html' } } },
  server: { proxy: { '/api': 'http://localhost:8788' } },
});
