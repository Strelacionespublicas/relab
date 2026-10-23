import { createRoot } from 'react-dom/client';
import './ds/tokens/fonts.css';
import './ds/tokens/colors.css';
import './ds/tokens/typography.css';
import './ds/tokens/spacing.css';
import './app.css';
import App from './App.jsx';

// El diálogo de instalación puede llegar antes de que React monte: se guarda para InstallBanner.
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  window.__installPrompt = e;
  window.dispatchEvent(new Event('installprompt-ready'));
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

createRoot(document.getElementById('root')).render(<App />);
