// Guía "Qué herramienta usar para crear productos digitales" (recurso de Relab). El contenido
// está en guia-herramientas-digitales/index.html (portado de Canvas.dc.html, proyecto de Claude
// Design "recursos gratis st"); acá van los menús, "volver arriba", PDF, el pie común y el
// checklist, que se guarda en el navegador y, con cuenta de Relab, en /api/state/guia-herramientas.
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import './ds/tokens/fonts.css';
import './ds/tokens/colors.css';
import './ds/tokens/typography.css';
import './ds/tokens/spacing.css';
import './app.css';
import './guia.css';
import { Footer } from './Footer.jsx';
import LoginModal from './LoginModal.jsx';
import { api } from './lib/api.js';

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

// La franja de secciones (celular) y el índice lateral (computadora) se arman con los links del menú.
const strip = $('strip');
const toc = $('toc');
drawer.querySelectorAll('a[href^="#"]').forEach(a => { strip.append(a.cloneNode(true)); toc.append(a.cloneNode(true)); });

// Barra de progreso de lectura y botón "volver arriba".
const progress = $('readProgress');
scrollBtn.addEventListener('click', e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
const onScroll = () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  progress.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
  scrollBtn.classList.toggle('show', scrollY > 600);
};
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll);
onScroll();

// Para el PDF se abren las preguntas frecuentes, así salen las respuestas.
$('pdfBtn').addEventListener('click', () => window.print());
window.addEventListener('beforeprint', () => document.querySelectorAll('.faq-item').forEach(d => { d.dataset.wasOpen = d.open; d.open = true; }));
window.addEventListener('afterprint', () => document.querySelectorAll('.faq-item').forEach(d => { d.open = d.dataset.wasOpen === 'true'; }));

// Marca en los tres menús la sección que se está leyendo; en la franja la lleva a la vista.
const ids = [...drawer.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href').slice(1));
const allLinks = id => document.querySelectorAll(`#sideDrawer a[href="#${id}"], #strip a[href="#${id}"], #toc a[href="#${id}"]`);
let current = null;
const seen = new Set();
const io = new IntersectionObserver(entries => {
  entries.forEach(e => (e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id)));
  const next = ids.find(id => seen.has(id));
  if (!next || next === current) return;
  if (current) allLinks(current).forEach(a => a.classList.remove('active'));
  current = next;
  allLinks(current).forEach(a => a.classList.add('active'));
  const chip = strip.querySelector(`a[href="#${current}"]`);
  if (chip && getComputedStyle(strip).display !== 'none') {
    strip.scrollTo({ left: chip.offsetLeft - strip.clientWidth / 2 + chip.offsetWidth / 2, behavior: 'smooth' });
  }
}, { rootMargin: '-110px 0px -55% 0px' });
ids.forEach(id => { const el = $(id); if (el) io.observe(el); });

createRoot($('footer')).render(createElement(Footer));

// ---- Checklist "antes de construir" ----
const RESOURCE = 'guia-herramientas';
const LOCAL_KEY = 'relab-guia-checklist';
const AFTER_LOGIN = 'relab-guia-volver-checklist';
const boxes = [...document.querySelectorAll('#guiaChecklist input')];
const status = $('clStatus');
let user = null;
let saveState = 'idle'; // idle | saving | saved | error
let saveTimer = null;

const readLocal = () => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || []; } catch { return []; } };
const writeLocal = checked => { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(checked)); } catch { /* sin almacenamiento */ } };
const checkedNow = () => boxes.filter(b => b.checked).map(b => Number(b.value));
const apply = checked => boxes.forEach(b => { b.checked = checked.includes(Number(b.value)); });

const loginRoot = createRoot($('loginRoot'));
const renderLogin = open => loginRoot.render(createElement(LoginModal, {
  open,
  onClose: () => renderLogin(false),
  onLogin: () => { try { sessionStorage.setItem(AFTER_LOGIN, '1'); } catch { /* */ } api.login(); },
  description: 'Ingresá con Google para guardar tus respuestas y verlas desde cualquier dispositivo. Es la misma cuenta para todos los recursos de Relab.',
}));

function renderStatus() {
  const done = checkedNow().length;
  status.replaceChildren();
  const count = document.createElement('span');
  count.className = 'count';
  count.textContent = `${done} de ${boxes.length} respondidas`;
  const bar = document.createElement('span');
  bar.className = 'bar';
  bar.innerHTML = `<i style="width:${Math.round((done / boxes.length) * 100)}%"></i>`;
  const msg = document.createElement('div');
  msg.className = 'msg';
  if (user) {
    const name = user.name ? ` · ${user.name.split(' ')[0]}` : '';
    if (saveState === 'error') msg.textContent = 'No se pudo guardar en tu cuenta. Tus respuestas quedan en este navegador.';
    else if (saveState === 'saving') msg.textContent = 'Guardando…';
    else { msg.classList.add('ok'); msg.textContent = `✓ Guardado en tu cuenta${name}`; }
  } else {
    const txt = document.createElement('span');
    txt.textContent = 'Tus respuestas quedan solo en este navegador.';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Guardar en mi cuenta';
    btn.addEventListener('click', () => renderLogin(true));
    msg.append(txt, btn);
  }
  status.append(count, bar, msg);
}

function saveRemote(now = false) {
  if (!user) return;
  clearTimeout(saveTimer);
  saveState = 'saving';
  renderStatus();
  const run = () => api.saveState(RESOURCE, { checked: checkedNow() })
    .then(() => { saveState = 'saved'; })
    .catch(() => { saveState = 'error'; })
    .finally(renderStatus);
  if (now) run(); else saveTimer = setTimeout(run, 600);
}

boxes.forEach(b => b.addEventListener('change', () => {
  writeLocal(checkedNow());
  renderStatus();
  saveRemote();
}));

apply(readLocal());
renderStatus();

api.me().then(async res => {
  if (!res?.user) return;
  user = res.user;
  saveState = 'saved';
  try {
    const { data } = await api.getState(RESOURCE);
    if (data && Array.isArray(data.checked)) {
      apply(data.checked);
      writeLocal(data.checked);
    } else if (checkedNow().length) {
      saveRemote(true); // primera vez con cuenta: sube lo que ya estaba marcado en el navegador
    }
  } catch {
    saveState = 'error';
  }
  renderStatus();
  let back = false;
  try { back = sessionStorage.getItem(AFTER_LOGIN) === '1'; sessionStorage.removeItem(AFTER_LOGIN); } catch { /* */ }
  if (back) $('sec-checklist').scrollIntoView();
});
