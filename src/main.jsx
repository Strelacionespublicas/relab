import { createRoot } from 'react-dom/client';
import './ds/tokens/fonts.css';
import './ds/tokens/colors.css';
import './ds/tokens/typography.css';
import './ds/tokens/spacing.css';
import './app.css';
import App from './App.jsx';
import { setupInstall } from './lib/install.js';

// Diálogo de instalación y service worker: src/lib/install.js (compartido con el kit).
setupInstall();

createRoot(document.getElementById('root')).render(<App />);
