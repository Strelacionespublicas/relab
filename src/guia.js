// Guía "Qué herramienta usar para crear productos digitales" (recurso de Relab), en formato curso.
// El contenido está en guia-herramientas-digitales/index.html (portado de Canvas.dc.html, proyecto
// de Claude Design "recursos gratis st"), agrupado en módulos (<article class="modulo">). Acá van
// "Mi curso", un módulo por pantalla según el hash, los menús, el PDF (la guía completa), el pie
// común y el avance: módulos terminados, último módulo abierto y checklist. Se guarda en el
// navegador y, con cuenta de Relab, en /api/state/guia-herramientas ({ checked, done, last }).
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
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const pad = n => String(n).padStart(2, '0');

const mods = [...document.querySelectorAll('.modulo')].map((art, i) => ({
  el: art,
  id: art.id,
  num: i + 1,
  title: art.dataset.titulo,
  min: Number(art.dataset.min) || 3,
  sections: [...art.querySelectorAll('section[data-nav]')],
}));
const modById = id => mods.find(m => m.id === id);
document.body.classList.add('curso');

// ---- Avance ----
const RESOURCE = 'guia-herramientas';
const LOCAL_KEY = 'relab-guia';
const OLD_KEY = 'relab-guia-checklist'; // versión anterior: solo el checklist
const AFTER_LOGIN = 'relab-guia-volver';
const boxes = [...document.querySelectorAll('#guiaChecklist input')];

const clean = s => ({
  checked: Array.isArray(s?.checked) ? s.checked.map(Number).filter(Number.isFinite) : [],
  done: Array.isArray(s?.done) ? s.done.filter(id => modById(id)) : [],
  last: modById(s?.last) ? s.last : null,
});
const readLocal = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(LOCAL_KEY));
    if (saved) return clean(saved);
    return clean({ checked: JSON.parse(localStorage.getItem(OLD_KEY)) });
  } catch { return clean(null); }
};
let state = readLocal();
const writeLocal = () => { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(state)); } catch { /* sin almacenamiento */ } };

let user = null;
let saveState = 'idle'; // idle | saving | saved | error
let saveTimer = null;

function saveRemote(now = false) {
  if (!user) return;
  clearTimeout(saveTimer);
  saveState = 'saving';
  renderAccount();
  const run = () => api.saveState(RESOURCE, state)
    .then(() => { saveState = 'saved'; })
    .catch(() => { saveState = 'error'; })
    .finally(renderAccount);
  if (now) run(); else saveTimer = setTimeout(run, 600);
}
const changed = () => { writeLocal(); saveRemote(); renderAll(); };

const isDone = m => state.done.includes(m.id);
const nextUp = () => {
  // Continuar: el último módulo abierto si no está terminado; si no, el primero pendiente desde ahí.
  const from = state.last ? modById(state.last).num - 1 : 0;
  for (let k = 0; k < mods.length; k++) {
    const m = mods[(from + k) % mods.length];
    if (!isDone(m)) return m;
  }
  return null;
};

// ---- Cuenta ----
const loginRoot = createRoot($('loginRoot'));
const renderLogin = open => loginRoot.render(createElement(LoginModal, {
  open,
  onClose: () => renderLogin(false),
  onLogin: () => { try { sessionStorage.setItem(AFTER_LOGIN, location.hash || '#inicio'); } catch { /* */ } api.login(); },
  description: 'Ingresá con Google para guardar tu avance del curso y tus respuestas, y verlos desde cualquier dispositivo. Es la misma cuenta para todos los recursos de Relab.',
}));

// Línea de estado de la cuenta (en Mi curso y debajo del checklist).
function accountMsg() {
  const msg = el('div', 'msg');
  if (user) {
    const name = user.name ? ` · ${user.name.split(' ')[0]}` : '';
    if (saveState === 'error') msg.textContent = 'No se pudo guardar en tu cuenta. Tu avance queda en este navegador.';
    else if (saveState === 'saving') msg.textContent = 'Guardando…';
    else { msg.classList.add('ok'); msg.textContent = `✓ Tu avance se guarda en tu cuenta${name}`; }
  } else {
    const btn = el('button', null, 'Guardar en mi cuenta');
    btn.type = 'button';
    btn.addEventListener('click', () => renderLogin(true));
    msg.append(el('span', null, 'Tu avance queda solo en este navegador.'), btn);
  }
  return msg;
}
const bar = (done, total) => {
  const b = el('span', 'bar');
  const i = el('i');
  i.style.width = `${Math.round((done / total) * 100)}%`;
  b.append(i);
  return b;
};

// ---- Mi curso ----
function renderInicio() {
  const doneN = state.done.length;
  const up = nextUp();
  const res = $('cursoResumen');
  res.replaceChildren();
  const stat = el('div', 'curso-stat');
  stat.append(el('b', null, String(doneN)), el('span', null, `de ${mods.length} módulos terminados`), bar(doneN, mods.length));
  const cta = el('a', 'btn-coral');
  if (!up) {
    cta.href = `#${mods[0].id}`;
    cta.textContent = 'Repasar desde el principio';
    res.append(el('p', 'curso-fin', '🎉 ¡Terminaste el curso! Ya tenés el mapa completo para elegir tus herramientas.'));
  } else {
    cta.href = `#${up.id}`;
    cta.textContent = doneN || state.last ? `Continuar: ${up.title} →` : `Empezar el curso: ${up.title} →`;
  }
  const total = mods.reduce((a, m) => a + m.min, 0);
  res.append(stat, cta, el('p', 'curso-meta', `${mods.length} módulos · unos ${total} minutos de lectura`));
  const acc = el('div', 'curso-cuenta');
  acc.append(accountMsg());
  res.append(acc);

  const list = $('cursoMods');
  list.replaceChildren();
  mods.forEach(m => {
    const a = el('a', 'mod-card');
    a.href = `#${m.id}`;
    const badge = isDone(m) ? ['Terminado', 'ok'] : state.last === m.id ? ['En curso', 'now'] : ['Pendiente', ''];
    a.append(
      el('span', 'mc-kicker', `Módulo ${pad(m.num)}`),
      el('span', 'mc-title', m.title),
      el('span', 'mc-meta', `${m.sections.length} ${m.sections.length === 1 ? 'tema' : 'temas'} · ${m.min} min`),
      el('span', `mc-badge ${badge[1]}`, badge[0]),
    );
    list.append(a);
  });
}

// ---- Menús: lateral (computadora), drawer (celular) y barra del módulo ----
const drawer = $('sideDrawer');
const backdrop = $('drawerBackdrop');
const toggle = $('navToggle');
const toc = $('toc');
const modbar = $('modbar');
let current = null; // módulo abierto (null = Mi curso)
let currentSec = null;

function buildNav(container) {
  container.replaceChildren();
  const home = el('a', 'nav-home', '← Mi curso');
  home.href = '#inicio';
  const prog = el('div', 'nav-prog');
  prog.append(el('span', null, `${state.done.length} de ${mods.length} terminados`), bar(state.done.length, mods.length));
  container.append(home, prog);
  mods.forEach(m => {
    const a = el('a', 'nav-mod');
    a.href = `#${m.id}`;
    a.classList.toggle('done', isDone(m));
    a.classList.toggle('active', m === current);
    a.append(el('span', 'n', isDone(m) ? '✓' : pad(m.num)), el('span', 't', m.title));
    container.append(a);
    if (m === current && m.sections.length > 1) {
      m.sections.forEach(s => {
        const sa = el('a', 'nav-sec', s.dataset.nav);
        sa.href = `#${s.id}`;
        sa.dataset.sec = s.id;
        container.append(sa);
      });
    }
  });
  markSection();
}
function renderModbar() {
  modbar.replaceChildren();
  if (!current) return;
  const back = el('a', 'mb-back', '‹ Mi curso');
  back.href = '#inicio';
  const where = el('span', 'mb-where');
  where.append(el('b', null, `${current.num}/${mods.length}`), document.createTextNode(` · ${current.title}`));
  modbar.append(back, where, bar(state.done.length, mods.length));
}

const setDrawer = open => {
  drawer.classList.toggle('open', open);
  backdrop.classList.toggle('open', open);
  toggle.setAttribute('aria-expanded', String(open));
};
toggle.setAttribute('aria-controls', 'sideDrawer');
toggle.addEventListener('click', () => setDrawer(true));
backdrop.addEventListener('click', () => setDrawer(false));
document.addEventListener('keydown', e => { if (e.key === 'Escape') setDrawer(false); });
drawer.addEventListener('click', e => { if (e.target.closest('a')) setDrawer(false); });

// ---- Pie de cada módulo: terminado + anterior / siguiente ----
mods.forEach(m => { m.foot = el('div', 'mod-foot'); m.el.append(m.foot); });

const go = id => { if (location.hash === `#${id}`) route(); else location.hash = id; };

function renderFoot(m) {
  const prev = mods[m.num - 2];
  const next = mods[m.num];
  m.foot.replaceChildren();
  const card = el('div', `fin-card${isDone(m) ? ' done' : ''}`);
  if (isDone(m)) {
    const undo = el('button', 'link-btn', 'Desmarcar');
    undo.type = 'button';
    undo.addEventListener('click', () => { state.done = state.done.filter(id => id !== m.id); changed(); });
    card.append(el('span', 'fin-ok', '✓ Terminaste este módulo'), undo);
  } else {
    card.append(el('span', 'fin-q', '¿Terminaste este módulo?'));
    const btn = el('button', 'btn-coral', next ? `Terminé · Siguiente: ${next.title} →` : 'Terminé el curso ✓');
    btn.type = 'button';
    btn.addEventListener('click', () => {
      state.done = [...state.done, m.id];
      changed();
      go(next ? next.id : 'inicio');
    });
    card.append(btn);
  }
  const nav = el('div', 'mod-nav');
  const p = el('a', 'prev', prev ? `← ${prev.title}` : '← Mi curso');
  p.href = `#${prev ? prev.id : 'inicio'}`;
  const n = el('a', 'next', next ? `${next.title} →` : 'Mi curso →');
  n.href = `#${next ? next.id : 'inicio'}`;
  nav.append(p, n);
  m.foot.append(card, nav);
}

function renderAccount() {
  renderChecklistStatus();
  const acc = document.querySelector('.curso-cuenta');
  if (acc) acc.replaceChildren(accountMsg());
}
function renderAll() {
  renderInicio();
  buildNav(drawer);
  buildNav(toc);
  renderModbar();
  mods.forEach(renderFoot);
  renderChecklistStatus();
}

// ---- Rutas: #inicio (Mi curso), #m-xxx (módulo) o #sec-xxx (sección dentro de su módulo) ----
function route() {
  const id = decodeURIComponent(location.hash.slice(1));
  const target = id ? document.getElementById(id) : null;
  const art = target?.closest('.modulo');
  const mod = art ? mods.find(m => m.el === art) : null;
  current = mod;
  currentSec = null;
  document.body.classList.toggle('en-inicio', !mod);
  $('inicio').hidden = !!mod;
  mods.forEach(m => { m.el.hidden = m !== mod; });
  if (mod && state.last !== mod.id) { state.last = mod.id; writeLocal(); saveRemote(); }
  renderAll();
  if (mod && target !== art) target.scrollIntoView();
  else window.scrollTo(0, 0);
  onScroll();
}
window.addEventListener('hashchange', route);

// Marca en los menús la sección que se está leyendo dentro del módulo.
function markSection() {
  document.querySelectorAll('.nav-sec').forEach(a => a.classList.toggle('active', a.dataset.sec === currentSec));
}
const seen = new Set();
const io = new IntersectionObserver(entries => {
  entries.forEach(e => (e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id)));
  const next = current?.sections.find(s => seen.has(s.id))?.id || null;
  if (next && next !== currentSec) { currentSec = next; markSection(); }
}, { rootMargin: '-110px 0px -55% 0px' });
mods.forEach(m => m.sections.forEach(s => io.observe(s)));

// ---- Barra de progreso de lectura (del módulo) y "volver arriba" ----
const progress = $('readProgress');
const scrollBtn = $('scrollTopBtn');
scrollBtn.addEventListener('click', e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
function onScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  progress.style.transform = `scaleX(${current && max > 0 ? Math.min(1, scrollY / max) : 0})`;
  scrollBtn.classList.toggle('show', scrollY > 600);
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll);

// El PDF es la guía completa: la hoja de impresión muestra todos los módulos y abre las preguntas frecuentes.
$('pdfBtn').addEventListener('click', () => window.print());
window.addEventListener('beforeprint', () => document.querySelectorAll('.faq-item').forEach(d => { d.dataset.wasOpen = d.open; d.open = true; }));
window.addEventListener('afterprint', () => document.querySelectorAll('.faq-item').forEach(d => { d.open = d.dataset.wasOpen === 'true'; }));

createRoot($('footer')).render(createElement(Footer));

// ---- Checklist "antes de construir" ----
const clStatus = $('clStatus');
const applyChecks = () => boxes.forEach(b => { b.checked = state.checked.includes(Number(b.value)); });
function renderChecklistStatus() {
  const done = boxes.filter(b => b.checked).length;
  clStatus.replaceChildren(el('span', 'count', `${done} de ${boxes.length} respondidas`), bar(done, boxes.length), accountMsg());
}
boxes.forEach(b => b.addEventListener('change', () => {
  state.checked = boxes.filter(x => x.checked).map(x => Number(x.value));
  writeLocal();
  renderChecklistStatus();
  saveRemote();
}));

applyChecks();
route();

api.me().then(async res => {
  if (!res?.user) return;
  user = res.user;
  saveState = 'saved';
  try {
    const { data } = await api.getState(RESOURCE);
    const local = state;
    if (data && (Array.isArray(data.checked) || Array.isArray(data.done))) {
      const remote = clean(data);
      // La cuenta manda; lo que todavía no tiene (por ejemplo, módulos, si guardó con la versión anterior) se completa con lo local.
      state = {
        checked: Array.isArray(data.checked) ? remote.checked : local.checked,
        done: Array.isArray(data.done) ? remote.done : local.done,
        last: current?.id || remote.last || local.last,
      };
      writeLocal();
      applyChecks();
      if (!Array.isArray(data.done) && (local.done.length || local.last)) saveRemote(true);
    } else if (local.checked.length || local.done.length || local.last) {
      saveRemote(true); // primera vez con cuenta: sube lo que ya estaba en el navegador
    }
  } catch {
    saveState = 'error';
  }
  let back = null;
  try { back = sessionStorage.getItem(AFTER_LOGIN); sessionStorage.removeItem(AFTER_LOGIN); } catch { /* */ }
  if (back && back !== location.hash) location.hash = back; // hashchange vuelve a dibujar todo
  else renderAll();
});
