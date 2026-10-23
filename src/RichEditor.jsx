// Editor de TextoRedes: muestra negrita y cursiva reales (Karla) en lugar de las letras
// Unicode, que en Android se ven con cajitas cuando llevan tilde. El valor sigue siendo el
// string Unicode de siempre: lo que se copia, cuenta y guarda no cambia.
//
// Expone por ref la misma interfaz que usaba App.jsx con el <textarea>:
// selectionStart, selectionEnd, setSelectionRange(s, e) y focus().
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { REV, styleChar } from './lib/core.js';

const isMark = cp => cp >= 0x300 && cp <= 0x36f;
const STYLE_OF = { '10': 'bold', '01': 'italic', '11': 'bolditalic' };

// Texto visible → Unicode con formato (misma lógica que applyStyle en core.js).
const toStyled = (str, style) => (style ? [...str.normalize('NFD')].map(c => styleChar(c, style)).join('') : str);

// Unicode con formato → tramos { style, display } para dibujar.
function segments(text) {
  const segs = [];
  const push = (style, str) => {
    const last = segs[segs.length - 1];
    if (last && last.style === style) last.raw += str;
    else segs.push({ style, raw: str });
  };
  const cps = [...text];
  for (let i = 0; i < cps.length; i++) {
    const rev = REV[cps[i]];
    if (!rev) { push(null, cps[i]); continue; }
    let cluster = rev[0];
    while (i + 1 < cps.length && isMark(cps[i + 1].codePointAt(0))) cluster += cps[++i];
    push(rev[1], cluster.normalize('NFC'));
  }
  return segs;
}

function renderInto(root, text) {
  root.textContent = '';
  for (const { style, raw } of segments(text)) {
    let node = document.createTextNode(raw);
    if (style === 'italic' || style === 'bolditalic') { const em = document.createElement('em'); em.append(node); node = em; }
    if (style === 'bold' || style === 'bolditalic') { const b = document.createElement('strong'); b.append(node); node = b; }
    root.append(node);
  }
  // Sin este <br> el cursor no puede pararse en la última línea vacía.
  if (text.endsWith('\n')) root.append(document.createElement('br'));
}

// Estilo de un elemento: etiquetas o el estilo en línea que a veces agrega el navegador.
function elementStyle(el, [b, i]) {
  const tag = el.tagName;
  const fw = el.style?.fontWeight;
  if (tag === 'STRONG' || tag === 'B' || fw === 'bold' || Number(fw) >= 600) b = 1;
  if (tag === 'EM' || tag === 'I' || el.style?.fontStyle === 'italic') i = 1;
  return [b, i];
}

// DOM (o fragmento) → string Unicode. Los <div>/<p> que pueda crear el navegador cuentan como salto.
function serialize(root, dropTrailingBr = true) {
  const out = [];
  const walk = (node, flags) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) out.push({ s: toStyled(child.data, STYLE_OF[flags.join('')]) });
      else if (child.nodeName === 'BR') out.push({ s: '\n', br: true });
      else if (child.nodeType === 1) {
        const block = child.nodeName === 'DIV' || child.nodeName === 'P';
        if (block && out.length && !out[out.length - 1].s.endsWith('\n')) out.push({ s: '\n' });
        walk(child, elementStyle(child, flags));
      }
    }
  };
  walk(root, [0, 0]);
  if (dropTrailingBr && out.length && out[out.length - 1].br) out.pop();
  return out.map(o => o.s).join('');
}

function styleAt(node, root) {
  let flags = [0, 0];
  const chain = [];
  for (let el = node.parentNode; el && el !== root; el = el.parentNode) chain.unshift(el);
  for (const el of chain) flags = elementStyle(el, flags);
  return STYLE_OF[flags.join('')];
}

const RichEditor = forwardRef(function RichEditor({ value, onChange, placeholder, style }, ref) {
  const rootRef = useRef(null);
  const shown = useRef(null); // valor que refleja el DOM ahora mismo
  const lastSel = useRef(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;

  const indexAt = (node, offset) => {
    const root = rootRef.current;
    const range = document.createRange();
    range.setStart(root, 0);
    range.setEnd(node, offset);
    const frag = document.createElement('div');
    frag.append(range.cloneContents());
    return Math.min(serialize(frag, false).length, shown.current.length);
  };

  const liveSel = () => {
    const root = rootRef.current; const sel = window.getSelection();
    if (!root || !sel || !sel.rangeCount || !root.contains(sel.anchorNode) || !root.contains(sel.focusNode)) return null;
    const a = indexAt(sel.anchorNode, sel.anchorOffset);
    const f = indexAt(sel.focusNode, sel.focusOffset);
    return a <= f ? [a, f] : [f, a];
  };

  const currentSel = () => liveSel() || lastSel.current || [valueRef.current.length, valueRef.current.length];

  const positionOf = idx => {
    const root = rootRef.current;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let acc = 0;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeType === 3) {
        const st = styleAt(n, root);
        const len = toStyled(n.data, st).length;
        if (idx <= acc + len) {
          let d = 0;
          for (const ch of n.data) {
            if (acc >= idx) break;
            acc += toStyled(ch, st).length; d += ch.length;
          }
          return [n, d];
        }
        acc += len;
      } else if (n.nodeName === 'BR') {
        if (idx <= acc) return [n.parentNode, [...n.parentNode.childNodes].indexOf(n)];
        acc += 1;
      }
    }
    const last = root.lastChild;
    return [root, last && last.nodeName === 'BR' ? root.childNodes.length - 1 : root.childNodes.length];
  };

  useImperativeHandle(ref, () => ({
    get selectionStart() { return currentSel()[0]; },
    get selectionEnd() { return currentSel()[1]; },
    focus() { rootRef.current?.focus({ preventScroll: true }); },
    setSelectionRange(s, e) {
      const root = rootRef.current; if (!root) return;
      const [sn, so] = positionOf(s); const [en, eo] = positionOf(e);
      const range = document.createRange();
      range.setStart(sn, so); range.setEnd(en, eo);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
      lastSel.current = [s, e];
    },
  }));

  // Redibuja solo ante cambios que no vienen del teclado (formato, emojis, deshacer…).
  useLayoutEffect(() => {
    if (value !== shown.current) { renderInto(rootRef.current, value); shown.current = value; }
  }, [value]);

  useEffect(() => {
    const root = rootRef.current;
    const onSelChange = () => { const s = liveSel(); if (s) lastSel.current = s; };
    // beforeinput nativo: el onBeforeInput de React no trae inputType.
    const onBeforeInput = e => {
      const t = e.inputType;
      if (t === 'insertParagraph' || t === 'insertLineBreak') { e.preventDefault(); splice('\n'); }
      else if (t === 'insertFromDrop' || t.startsWith('format')) e.preventDefault();
    };
    document.addEventListener('selectionchange', onSelChange);
    root.addEventListener('beforeinput', onBeforeInput);
    return () => { document.removeEventListener('selectionchange', onSelChange); root.removeEventListener('beforeinput', onBeforeInput); };
  }, []);

  const emit = () => {
    const next = serialize(rootRef.current);
    shown.current = next;
    onChangeRef.current(next);
  };

  // Cambios armados acá (Enter, pegar): se aplican sobre el valor y se redibuja.
  const splice = str => {
    const [s, e] = currentSel();
    const v = valueRef.current;
    onChangeRef.current(v.slice(0, s) + str + v.slice(e), [s + str.length, s + str.length], true);
  };

  const onPaste = e => {
    e.preventDefault();
    const str = (e.clipboardData.getData('text/plain') || '').replace(/\r\n?/g, '\n');
    if (str) splice(str);
  };

  // Si el navegador dejó una estructura rara (divs, spans), se ordena al salir del editor.
  const onBlur = () => {
    const root = rootRef.current;
    const clean = document.createElement('div');
    renderInto(clean, shown.current);
    if (clean.innerHTML !== root.innerHTML) renderInto(root, shown.current);
  };

  // Ctrl/Cmd+B e I del navegador meterían etiquetas propias: se anulan.
  const onKeyDown = e => {
    if ((e.ctrlKey || e.metaKey) && ['b', 'i', 'u'].includes(e.key.toLowerCase())) e.preventDefault();
  };

  return (
    <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
      {!value && <div aria-hidden="true" className="re-placeholder" style={{ ...style, position: 'absolute', inset: 0, pointerEvents: 'none', color: 'var(--text-subtle)' }}>{placeholder}</div>}
      <div
        ref={rootRef}
        className="re-editor"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder}
        spellCheck
        onInput={emit}
        onPaste={onPaste}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        onDrop={e => e.preventDefault()}
        style={{ ...style, flex: 1, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', outline: 'none' }}
      />
    </div>
  );
});

export default RichEditor;
