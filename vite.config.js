import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo, /api va a `wrangler pages dev` (npm run dev:api) en el puerto 8788.
export default defineConfig({
  plugins: [react()],
  // Un sitio para todo Relab: la vitrina en / y cada recurso en su carpeta.
  build: { rollupOptions: { input: { relab: 'index.html', textoenredes: 'textoenredes/index.html', privacidad: 'privacidad/index.html' } } },
  server: { proxy: { '/api': 'http://localhost:8788' } },
});
