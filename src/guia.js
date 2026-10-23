// Guía "Qué herramienta usar para crear productos digitales" (recurso de Relab). El contenido
// está en guia-herramientas-digitales/index.html (portado de Canvas.dc.html, proyecto de Claude
// Design "recursos gratis st"); acá solo van el menú lateral, "volver arriba", PDF y el pie común.
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import './ds/tokens/fonts.css';
import './ds/tokens/colors.css';
import './ds/tokens/typography.css';
import './ds/tokens/spacing.css';
import './app.css';
import './guia.css';
import { Footer } from './Footer.jsx';

const $ = id => document.getElementById(id);
const drawer = $('sideDrawer');
const backdrop = $('drawerBackdrop');
const toggle = $('navToggle');
const scrollBtn = $('scrollTopBtn');

const setDrawer = open => {
  drawer.classList.toggle('open', open);
  backdrop.classList.toggle('open', open);
  toggle.setAttribute('aria-expanded', String(open));
};
toggle.setAttribute('aria-controls', 'sideDrawer');
toggle.addEventListener('click', () => setDrawer(true));
backdrop.addEventListener('click', () => setDrawer(false));
document.addEventListener('keydown', e => { if (e.key === 'Escape') setDrawer(false); });
drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setDrawer(false)));

scrollBtn.addEventListener('click', e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
const onScroll = () => scrollBtn.classList.toggle('show', window.scrollY > 600);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Para el PDF se abren las preguntas frecuentes, así salen las respuestas.
$('pdfBtn').addEventListener('click', () => window.print());
window.addEventListener('beforeprint', () => document.querySelectorAll('.faq-item').forEach(d => { d.dataset.wasOpen = d.open; d.open = true; }));
window.addEventListener('afterprint', () => document.querySelectorAll('.faq-item').forEach(d => { d.open = d.dataset.wasOpen === 'true'; }));

// Marca en el menú la sección que se está leyendo.
const links = new Map([...drawer.querySelectorAll('a[href^="#"]')].map(a => [a.getAttribute('href').slice(1), a]));
const seen = new Set();
const io = new IntersectionObserver(entries => {
  entries.forEach(e => (e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id)));
  const current = [...links.keys()].find(id => seen.has(id));
  if (current) links.forEach((a, id) => a.classList.toggle('active', id === current));
}, { rootMargin: '-60px 0px -55% 0px' });
links.forEach((_, id) => { const el = $(id); if (el) io.observe(el); });

createRoot($('footer')).render(createElement(Footer));
