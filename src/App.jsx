import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button, Switch, Logo } from './ds/components.jsx';
import { Footer } from './Footer.jsx';
import RichEditor from './RichEditor.jsx';
import HashtagPanel from './HashtagPanel.jsx';
import Preview from './Preview.jsx';
import InstallBanner from './InstallBanner.jsx';
import LoginModal from './LoginModal.jsx';
import { NET_ICONS } from './lib/icons.js';
import { api, newId } from './lib/api.js';
import {
  REV, toPlain, applyStyle, NETS, EMOJIS, EMOJI_KW, CAT_ICON, appleUrl, normQ,
  TEMPLATES, TAG_RULES, DEFAULT_TAGS, LS, load, save, fmtDate,
} from './lib/core.js';

const DEFAULT_RECENT = ['✨', '🔥', '💡', '📌', '✅', '👉', '📣', '🚀', '💬', '📅', '📍', '🙌'];
// 503 = falta TEXT_KEY en Cloudflare: el servidor no guarda nada sin cifrar.
const saveError = err => (err?.status === 503 ? 'No se pudo guardar: falta configurar el cifrado' : 'No se pudo guardar. Revisá tu conexión');
const LOGIN_MSG = { denied: 'Esa cuenta no tiene acceso a TextoRedes', error: 'No pudimos iniciar sesión. Probá de nuevo', config: 'El login todavía no está configurado' };

const eyebrow = { fontFamily: 'var(--font-data)', fontSize: 'var(--fs-3xs)', letterSpacing: 'var(--tracking-wider)', textTransform: 'uppercase', color: 'var(--text-muted)' };
const linkBtn = { border: 'none', background: 'none', color: 'var(--st-coral)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--fs-xs)', cursor: 'pointer', padding: '4px 0' };
const fmtBtn = { width: 40, height: 36, border: 'none', borderRadius: 8, background: 'var(--st-white)', boxShadow: 'var(--shadow-sm)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--st-petroleo)' };
const toolBtn = { height: 34, padding: '0 10px', borderRadius: 999, border: '1.5px solid var(--border-default)', background: 'transparent', color: 'var(--st-petroleo)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--fs-xs)', cursor: 'pointer', whiteSpace: 'nowrap' };
const panelBox = { borderBottom: '1px solid var(--border-subtle)', background: 'var(--st-neutral-50)' };
const card = { background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, boxShadow: 'var(--shadow-sm)' };
const deleteBtn = { border: 'none', background: 'none', color: 'var(--text-subtle)', fontSize: 16, cursor: 'pointer', padding: 4 };

function NetIcon({ id }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" style={{ flex: 'none', fill: 'var(--st-petroleo)' }}>
      <path d={NET_ICONS[id]} />
    </svg>
  );
}


// Emoji estilo iPhone: si la imagen falla, reintenta sin FE0F y si no, muestra el emoji del sistema.
function AppleEmoji({ ch }) {
  const [step, setStep] = useState(0);
  if (step > 1) return ch;
  return <img src={appleUrl(ch, step === 1)} alt={ch} loading="lazy" onError={() => setStep(s => s + 1)} style={{ width: 26, height: 26, display: 'block' }} />;
}

// Contenedor de los paneles: compacto, con scroll propio y "Listo" para volver al texto.
function PanelShell({ title, onClose, scroll = true, children }) {
  return (
    <div style={panelBox}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 12px 0' }}>
        <span style={eyebrow}>{title}</span>
        <button onMouseDown={e => e.preventDefault()} onClick={onClose} style={{ ...linkBtn, padding: '4px 2px' }}>Listo ✓</button>
      </div>
      <div style={{ padding: '8px 12px 12px', maxHeight: scroll ? 240 : undefined, overflowY: scroll ? 'auto' : undefined }}>{children}</div>
    </div>
  );
}

export default function App() {
  const [text, setTextState] = useState('');
  const [panel, setPanel] = useState(null);
  const [emojiCat, setEmojiCat] = useState('Caras');
  const [emojiQ, setEmojiQ] = useState('');
  const [appleStyle, setAppleStyle] = useState(true);
  const [recent, setRecent] = useState(() => load(LS.recent, DEFAULT_RECENT));
  const [netId, setNetId] = useState('ig');
  const [user, setUser] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [tagSets, setTagSets] = useState([]);
  const [loginOpen, setLoginOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  const [undoLen, setUndoLen] = useState(0);

  const taRef = useRef(null);
  const editorWrap = useRef(null);
  const textRef = useRef('');
  const userRef = useRef(null);
  const past = useRef([]);
  const lastPush = useRef(0);
  const pendingSel = useRef(null);
  const saveT = useRef(null);
  const toastT = useRef(null);
  userRef.current = user;

  const flash = (msg, ok = true) => { clearTimeout(toastT.current); setToast((ok ? '✓ ' : '') + msg); toastT.current = setTimeout(() => setToast(''), 1800); };

  const scheduleSave = next => {
    if (!userRef.current) return;
    clearTimeout(saveT.current);
    saveT.current = setTimeout(() => {
      api.saveCurrent(next).then(() => setSavedAt(Date.now())).catch(err => flash(saveError(err), false));
    }, 600);
  };

  const setText = (next, sel, force) => {
    const now = Date.now();
    if (force || now - lastPush.current > 900) {
      past.current.push(textRef.current);
      if (past.current.length > 100) past.current.shift();
      lastPush.current = now;
    }
    textRef.current = next;
    pendingSel.current = sel || null;
    setTextState(next);
    setUndoLen(past.current.length);
    scheduleSave(next);
  };

  useLayoutEffect(() => {
    const sel = pendingSel.current; const ta = taRef.current;
    if (sel && ta) { ta.focus(); ta.setSelectionRange(sel[0], sel[1]); }
    pendingSel.current = null;
  }, [text]);

  // Sesión: carga la cuenta y, si se volvió del login de Google, recupera el texto que había antes.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loginResult = params.get('login');
    if (loginResult) window.history.replaceState(null, '', window.location.pathname);
    let pending = null;
    try { pending = sessionStorage.getItem(LS.pending); sessionStorage.removeItem(LS.pending); } catch (e) {}

    api.me().then(me => {
      if (me.user) {
        setUser(me.user); userRef.current = me.user;
        setDrafts(me.drafts); setTagSets(me.tagSets);
        const start = pending || me.current || '';
        textRef.current = start; setTextState(start);
        if (pending) api.saveCurrent(pending).then(() => setSavedAt(Date.now())).catch(() => {});
        if (loginResult === 'ok') flash(`Hola, ${me.user.name}`);
      } else {
        if (pending) { textRef.current = pending; setTextState(pending); }
        if (LOGIN_MSG[loginResult]) flash(LOGIN_MSG[loginResult], false);
      }
    });
    return () => { clearTimeout(saveT.current); clearTimeout(toastT.current); };
  }, []);

  const getSel = () => { const ta = taRef.current; return ta ? [ta.selectionStart, ta.selectionEnd] : [text.length, text.length]; };
  const format = k => {
    const [s, e] = getSel();
    if (s === e) { flash('Seleccioná el texto que querés formatear'); return; }
    const out = applyStyle(text.slice(s, e), k);
    setText(text.slice(0, s) + out + text.slice(e), [s, s + out.length], true);
  };
  const insert = str => {
    const [s, e] = getSel();
    setText(text.slice(0, s) + str + text.slice(e), [s + str.length, s + str.length], true);
  };
  const appendTag = tag => {
    const sep = !text ? '' : /\n\s*#[^\n]*$/.test(text) || /#\S+$/.test(text) ? ' ' : '\n\n';
    const next = text + sep + tag; setText(next, [next.length, next.length], true);
  };
  const preventBlur = e => e.preventDefault();

  const undo = () => {
    if (!past.current.length) return;
    const prev = past.current.pop(); lastPush.current = 0;
    textRef.current = prev; setTextState(prev); setUndoLen(past.current.length); scheduleSave(prev);
  };
  const clearFormat = () => {
    const [s, e] = getSel();
    if (s !== e) { const out = toPlain(text.slice(s, e)); setText(text.slice(0, s) + out + text.slice(e), [s, s + out.length], true); }
    else { const out = toPlain(text); if (out !== text) setText(out, null, true); }
    flash(s !== e ? 'Formato quitado de la selección' : 'Formato quitado de todo el texto');
  };
  const copy = () => {
    if (!text) { flash('No hay texto para copiar'); return; }
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).catch(() => {
      const tmp = document.createElement('textarea'); tmp.value = text; document.body.append(tmp); tmp.select(); document.execCommand('copy'); tmp.remove();
    });
    flash('Copiado al portapapeles');
  };

  const startLogin = () => {
    try { if (text) sessionStorage.setItem(LS.pending, text); } catch (e) {}
    api.login();
  };
  const logout = () => {
    api.logout().catch(() => {});
    clearTimeout(saveT.current);
    setUser(null); userRef.current = null; setDrafts([]); setTagSets([]); setSavedAt(null);
    flash('Sesión cerrada');
  };
  const sync = promise => promise.catch(err => flash(saveError(err), false));
  const deleteAccount = async () => {
    if (!window.confirm('¿Borrar tu cuenta? Se eliminan tus borradores, tus grupos de hashtags y el texto guardado.')) return;
    if (!window.confirm('Esto no se puede deshacer. ¿Confirmás que querés borrar todo?')) return;
    try {
      await api.deleteAccount();
      clearTimeout(saveT.current);
      setUser(null); userRef.current = null; setDrafts([]); setTagSets([]); setSavedAt(null); setPanel(null);
      flash('Tu cuenta y tus datos se borraron');
    } catch (e) { flash('No se pudo borrar la cuenta. Probá de nuevo', false); }
  };

  // ---- Datos derivados ----
  const loggedIn = !!user;
  const cps = [...text];
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const tagsInText = (text.match(/#[\p{L}\p{N}_]+/gu) || []).map(toPlain);
  const tagSetLower = new Set(tagsInText.map(t => t.toLowerCase()));
  const emojiCount = (text.match(/\p{Extended_Pictographic}/gu) || []).length;
  const styled = cps.filter(c => REV[c]).length;
  const weighted = cps.reduce((n, c) => n + (c.codePointAt(0) > 0xFFFF || /\p{Extended_Pictographic}/u.test(c) ? 2 : 1), 0);

  const plainText = toPlain(text);
  const sugg = []; TAG_RULES.forEach(([re, tags]) => { if (re.test(plainText)) sugg.push(...tags); });
  DEFAULT_TAGS.forEach(t => sugg.push(t));
  const suggestedTags = [...new Set(sugg)].slice(0, 10);

  const lines = text ? text.split('\n').length : 0;
  const paras = text.split(/\n\s*\n/).filter(p => p.trim()).length;
  const mentions = (text.match(/@[\w.]+/g) || []).length;
  const breakdown = [
    [lines, 'Líneas'], [paras, 'Párrafos'], [tagsInText.length, 'Hashtags'],
    [mentions, 'Menciones'], [emojiCount, 'Emojis'], [styled, 'Con formato'],
  ];

  const q = normQ(emojiQ);
  const emojiList = q
    ? Object.keys(EMOJI_KW).filter(ch => EMOJI_KW[ch].split(' ').some(w => w.startsWith(q)) || EMOJI_KW[ch].includes(q)).slice(0, 120)
    : emojiCat === 'Recientes' ? recent : EMOJIS[emojiCat];
  const noEmojiResults = !!emojiQ.trim() && !Object.keys(EMOJI_KW).some(ch => EMOJI_KW[ch].includes(q));
  const pickEmoji = ch => {
    insert(ch);
    const next = [ch, ...recent.filter(x => x !== ch)].slice(0, 32);
    save(LS.recent, next); setRecent(next);
  };

  const appendTags = list => appendTag(list.join(' '));
  const saveSet = set => {
    const full = { id: set.id || newId(), title: set.title, text: set.text };
    setTagSets(set.id ? tagSets.map(x => (x.id === set.id ? full : x)) : [full, ...tagSets]);
    sync(api.addTagSet(full)); flash(set.id ? 'Grupo actualizado' : 'Grupo guardado');
  };
  const deleteSet = id => { setTagSets(tagSets.filter(x => x.id !== id)); sync(api.deleteTagSet(id)); };
  const closePanel = () => {
    setPanel(null);
    const el = editorWrap.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    taRef.current?.focus();
  };
  const clearAll = () => {
    if (!text) return;
    if (!window.confirm('¿Borrar todo el texto?')) return;
    setText('', null, true);
    flash('Texto borrado. Tocá Deshacer para recuperarlo');
  };
  const saveDraft = () => {
    if (!text.trim()) { flash('No hay texto para guardar'); return; }
    const first = toPlain(text).split('\n').find(l => l.trim()) || 'Sin título';
    const d = { id: newId(), text, title: first.slice(0, 70), at: Date.now() };
    setDrafts([d, ...drafts].slice(0, 50)); sync(api.addDraft(d)); flash('Borrador guardado');
  };

  const panelTabs = [['emoji', '😊 Emojis'], ['templates', 'Plantillas'], ['hashtags', '# Hashtags'], ['history', 'Historial']];

  return (
    <>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header style={{ background: 'var(--st-petroleo)', color: 'var(--st-white)', padding: '14px clamp(16px, 4vw, 40px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Logo height={30} />
            <div style={{ width: 1, height: 28, background: 'var(--border-inverse)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: 1, letterSpacing: '-0.035em', color: 'var(--st-white)', display: 'flex', alignItems: 'baseline', gap: 5 }}>
                <span style={{ fontWeight: 800 }}>texto</span><span style={{ fontWeight: 400, fontStyle: 'italic', color: 'var(--st-coral)' }}>en</span><span style={{ fontWeight: 300 }}>redes</span>
              </div>
              <a href="/" style={{ fontFamily: 'var(--font-data)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--st-celeste-300)', textDecoration: 'none' }}>un recurso <strong style={{ color: 'var(--st-white)', fontWeight: 800 }}>relab</strong></a>
            </div>
          </div>
          {loggedIn ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 999, background: 'var(--st-celeste)', color: 'var(--st-petroleo)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-sm)' }}>{(user.name || '?').charAt(0).toUpperCase()}</div>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--fs-sm)' }}>{user.name}</span>
              <button className="hv-inverse" onClick={logout} style={{ background: 'transparent', border: '1px solid var(--border-inverse)', color: 'var(--st-white)', borderRadius: 999, padding: '7px 14px', fontFamily: 'var(--font-display)', fontSize: 'var(--fs-xs)', cursor: 'pointer' }}>Salir</button>
            </div>
          ) : (
            <Button size="sm" onClick={() => setLoginOpen(true)}>Guardar mi avance</Button>
          )}
        </header>

        <section style={{ padding: 'clamp(28px, 5vw, 48px) clamp(16px, 4vw, 40px) 24px', maxWidth: 1280, width: '100%', margin: '0 auto' }}>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(30px, 5vw, 48px)', lineHeight: 1.08, letterSpacing: '-0.02em', color: 'var(--st-petroleo)', textWrap: 'balance' }}>Formato que <span style={{ color: 'var(--st-coral)' }}>sí funciona</span> en las redes</h1>
          <p style={{ margin: '12px 0 0', maxWidth: 620, fontSize: 'var(--fs-lg)', lineHeight: 1.5, color: 'var(--text-muted)', textWrap: 'pretty' }}>Escribí o pegá tu texto, aplicá negrita y cursiva, sumá emojis y hashtags, y copialo listo para publicar.</p>
        </section>

        <main style={{ flex: 1, padding: '0 clamp(16px, 4vw, 40px) 48px', maxWidth: 1280, width: '100%', margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'stretch' }}>
          <div style={{ flex: '1 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <InstallBanner />
            <div style={{ ...card, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--surface-sunken)', borderRadius: 10 }}>
                  <button className="hv-fmt" onMouseDown={preventBlur} onClick={() => format('bold')} title="Negrita" style={{ ...fmtBtn, fontWeight: 800 }}>N</button>
                  <button className="hv-fmt" onMouseDown={preventBlur} onClick={() => format('italic')} title="Cursiva" style={{ ...fmtBtn, fontStyle: 'italic', fontWeight: 500 }}>K</button>
                  <button className="hv-fmt" onMouseDown={preventBlur} onClick={() => format('bolditalic')} title="Negrita + cursiva" style={{ ...fmtBtn, width: 44, fontStyle: 'italic', fontWeight: 800 }}>NK</button>
                </div>

                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <button onClick={undo} disabled={undoLen === 0} title="Deshacer" style={toolBtn}>↶ Deshacer</button>
                  <button onClick={clearFormat} title="Quitar negrita y cursiva (de la selección o de todo)" style={toolBtn}>Sin formato</button>
                  <button onClick={clearAll} disabled={!text} title="Borrar todo el texto" style={{ ...toolBtn, color: 'var(--st-coral-700)' }}>Borrar</button>
                </div>

                <div className="tr-tabs" style={{ display: 'flex', gap: 4, flexBasis: '100%', overflowX: 'auto', paddingBottom: 2 }}>
                  {panelTabs.map(([id, label]) => {
                    const on = panel === id;
                    return (
                      <button key={id} onClick={() => setPanel(p => (p === id ? null : id))} style={{ flex: 'none', height: 34, padding: '0 12px', borderRadius: 999, border: `1.5px solid ${on ? 'var(--st-petroleo)' : 'var(--border-default)'}`, background: on ? 'var(--st-petroleo)' : 'transparent', color: on ? 'var(--st-white)' : 'var(--st-petroleo)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--fs-xs)', cursor: 'pointer' }}>{label}</button>
                    );
                  })}
                </div>
              </div>

              {panel === 'emoji' && (
                <PanelShell title="Emojis" onClose={closePanel} scroll={false}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 220px', display: 'flex', alignItems: 'center', gap: 8, height: 36, padding: '0 14px', background: 'var(--st-white)', border: '1.5px solid var(--border-default)', borderRadius: 999 }}>
                      <span aria-hidden="true" style={{ fontSize: 14, color: 'var(--text-subtle)' }}>🔍</span>
                      <input value={emojiQ} onChange={e => setEmojiQ(e.target.value)} placeholder="Buscar emoji: corazón, fiesta, mate…" style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)', fontSize: 'var(--fs-sm)', color: 'var(--st-gris-oscuro)' }} />
                    </div>
                    <Switch label="Estilo iPhone" checked={appleStyle} onChange={setAppleStyle} />
                  </div>
                  <div style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--surface-sunken)', borderRadius: 10, overflowX: 'auto' }}>
                    {['Recientes', ...Object.keys(EMOJIS)].map(k => {
                      const on = !emojiQ && emojiCat === k;
                      return <button key={k} onClick={() => { setEmojiCat(k); setEmojiQ(''); }} title={k} style={{ flex: '1 0 36px', height: 34, border: 'none', borderRadius: 8, background: on ? 'var(--st-white)' : 'transparent', boxShadow: on ? 'var(--shadow-sm)' : 'none', opacity: on ? 1 : 0.55, fontSize: 18, cursor: 'pointer' }}>{CAT_ICON[k]}</button>;
                    })}
                  </div>
                  <span style={eyebrow}>{emojiQ ? 'Resultados' : emojiCat}</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))', gap: 2, maxHeight: 160, overflowY: 'auto' }}>
                    {emojiList.map(ch => (
                      <button key={ch} className="hv-emoji" onMouseDown={preventBlur} onClick={() => pickEmoji(ch)} style={{ height: 40, border: 'none', background: 'transparent', borderRadius: 8, fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                        {appleStyle ? <AppleEmoji ch={ch} /> : ch}
                      </button>
                    ))}
                  </div>
                  {noEmojiResults && <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>No encontramos emojis con esa palabra. Probá con otra.</p>}
                </div>
                </PanelShell>
              )}

              {panel === 'templates' && (
                <PanelShell title="Plantillas" onClose={closePanel}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                  {TEMPLATES.map(t => (
                    <button key={t.name} className="hv-card" onClick={() => { setText(text ? text + '\n\n' + t.body : t.body, null, true); setPanel(null); flash('Plantilla agregada — reemplazá los [corchetes]'); }} style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--st-white)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--fs-sm)', color: 'var(--st-petroleo)' }}>{t.name}</span>
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', lineHeight: 1.4 }}>{t.desc}</span>
                    </button>
                  ))}
                </div>
                </PanelShell>
              )}

              {panel === 'hashtags' && (
                <PanelShell title="Hashtags" onClose={closePanel}>
                  <HashtagPanel loggedIn={loggedIn} tagSets={tagSets} onSaveSet={saveSet} onDeleteSet={deleteSet} tagsInText={tagsInText} usedTags={tagSetLower} suggestedTags={suggestedTags} onAddTags={appendTags} onLogin={() => setLoginOpen(true)} flash={flash} />
                </PanelShell>
              )}

              {panel === 'history' && (
                <PanelShell title="Historial" onClose={closePanel}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {!loggedIn && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '4px 2px' }}>
                      <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-body)' }}>Ingresá para guardar borradores y retomarlos cuando quieras.</p>
                      <Button variant="secondary" size="sm" onClick={() => setLoginOpen(true)}>Ingresar</Button>
                    </div>
                  )}
                  {loggedIn && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <span style={eyebrow}>Borradores guardados</span>
                      <button onClick={saveDraft} style={linkBtn}>+ Guardar texto actual</button>
                    </div>
                  )}
                  {loggedIn && !drafts.length && <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>No hay borradores todavía.</p>}
                  {loggedIn && drafts.map(d => (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--st-white)', border: '1px solid var(--border-subtle)', borderRadius: 10 }}>
                      <button onClick={() => { setText(d.text, null, true); flash('Borrador cargado'); }} style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--fs-sm)', color: 'var(--st-petroleo)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.title}</span>
                        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{fmtDate(d.at)} · {[...d.text].length} caracteres</span>
                      </button>
                      <button onClick={() => { setDrafts(drafts.filter(x => x.id !== d.id)); sync(api.deleteDraft(d.id)); }} title="Eliminar" style={deleteBtn}>✕</button>
                    </div>
                  ))}
                  {loggedIn && (
                    <button onClick={deleteAccount} style={{ ...linkBtn, alignSelf: 'flex-start', marginTop: 8, color: 'var(--text-muted)', fontWeight: 500, textDecoration: 'underline' }}>Borrar mi cuenta y mis datos</button>
                  )}
                </div>
                </PanelShell>
              )}

              <div ref={editorWrap} style={{ scrollMarginTop: 12, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <RichEditor ref={taRef} value={text} onChange={setText} placeholder="Escribí o pegá tu texto acá. Seleccioná una parte y tocá N, K o NK para darle formato." style={{ minHeight: 320, padding: 20, fontFamily: 'var(--font-body)', fontSize: 17, lineHeight: 1.6, color: 'var(--st-gris-oscuro)', background: 'var(--st-white)' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', background: 'var(--st-neutral-50)' }}>
                <div style={{ display: 'flex', gap: 16, fontFamily: 'var(--font-data)', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
                  <span><strong style={{ color: 'var(--st-petroleo)', fontWeight: 700 }}>{cps.length.toLocaleString('es-AR')}</strong> caracteres</span>
                  <span><strong style={{ color: 'var(--st-petroleo)', fontWeight: 700 }}>{words.toLocaleString('es-AR')}</strong> palabras</span>
                  {loggedIn && <span style={{ color: 'var(--st-success)' }}>{savedAt ? 'Guardado automáticamente' : 'Se guarda en tu cuenta'}</span>}
                </div>
                <Button onClick={copy}>Copiar texto</Button>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', lineHeight: 1.5 }}>Tip: las letras con formato son caracteres especiales. Usalas para destacar, no en todo el texto: los lectores de pantalla y los buscadores las leen distinto.</p>
          </div>

          <aside style={{ flex: '1 1 340px', minWidth: 0, maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Preview text={text} weighted={weighted} netId={netId} onNetChange={setNetId} />

            <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-md)', color: 'var(--st-petroleo)' }}>Conteo por red social</span>
              {NETS.map(n => {
                const c = n.weighted ? weighted : cps.length; const r = c / n.limit; const over = c > n.limit;
                return (
                  <div key={n.id} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 'var(--fs-sm)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--st-gris-oscuro)' }}><NetIcon id={n.id} />{n.name}</span>
                      <span style={{ fontFamily: 'var(--font-data)', fontSize: 'var(--fs-xs)', color: over ? 'var(--st-coral-700)' : 'var(--text-muted)' }}>
                        {over ? `${(c - n.limit).toLocaleString('es-AR')} de más` : `${c.toLocaleString('es-AR')} / ${n.limit.toLocaleString('es-AR')}`}
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: 'var(--st-neutral-100)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: Math.min(100, Math.max(c ? 1.5 : 0, r * 100)) + '%', background: over ? 'var(--st-coral)' : r > 0.85 ? 'var(--st-warning)' : 'var(--st-celeste)', borderRadius: 999, transition: 'width 200ms ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ background: 'var(--st-petroleo)', color: 'var(--st-white)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-md)' }}>Desglose del texto</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px 8px' }}>
                {breakdown.map(([value, label]) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-xl)', color: 'var(--st-white)' }}>{value}</span>
                    <span style={{ fontFamily: 'var(--font-data)', fontSize: 'var(--fs-3xs)', letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase', color: 'var(--st-celeste-300)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </main>

        <Footer />
      </div>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onLogin={startLogin}
        description="Guardá borradores, retomá textos y reutilizá tus hashtags. La herramienta funciona igual sin cuenta." />

      {toast && (
        <div style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', background: 'var(--st-petroleo)', color: 'var(--st-white)', padding: '12px 20px', borderRadius: 999, boxShadow: 'var(--shadow-lg)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--fs-sm)', zIndex: 60, whiteSpace: 'nowrap' }}>{toast}</div>
      )}
    </>
  );
}
