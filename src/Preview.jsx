// Vista previa de TextoRedes: muestra el copy como se vería en cada red y formato
// (post 4:5, cuadrado, reel 9:16…), con imagen ilustrativa o una foto propia.
import { useEffect, useRef, useState } from 'react';
import { Logo, NetworkBackground } from './ds/components.jsx';
import { NETS, FORMATS } from './lib/core.js';

const pill = on => ({ padding: '5px 10px', borderRadius: 999, border: 'none', background: on ? 'var(--st-coral)' : 'var(--st-neutral-100)', color: on ? 'var(--st-white)' : 'var(--st-neutral-600)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--fs-2xs)', cursor: 'pointer' });
const segBtn = on => ({ flex: '1 0 auto', padding: '6px 10px', borderRadius: 8, border: 'none', background: on ? 'var(--st-white)' : 'transparent', boxShadow: on ? 'var(--shadow-sm)' : 'none', color: 'var(--st-petroleo)', fontFamily: 'var(--font-display)', fontWeight: on ? 700 : 500, fontSize: 'var(--fs-2xs)', cursor: 'pointer' });

// Corta en la última palabra completa antes de `cut` caracteres.
const clip = (cps, cut) => cps.slice(0, cut).join('').replace(/\s+\S*$/, '');

function Avatar({ size = 32 }) {
  return (
    <div style={{ width: size, height: size, flex: 'none', borderRadius: 999, background: 'var(--st-petroleo)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 2px rgba(255,255,255,0.9)' }}>
      <Logo height={Math.round(size * 0.38)} />
    </div>
  );
}

function Media({ ratio, image, fill }) {
  return (
    <div style={{ position: fill ? 'absolute' : 'relative', inset: fill ? 0 : undefined, aspectRatio: fill ? undefined : ratio, width: '100%', overflow: 'hidden', background: 'var(--st-gradient-tech)' }}>
      {image
        ? <img src={image} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        : <>
            <NetworkBackground color="var(--st-white)" opacity={0.35} density={40} seed={11} style={{ position: 'absolute', inset: 0 }} />
            <span style={{ position: 'absolute', left: 12, top: 10, fontFamily: 'var(--font-data)', fontSize: 'var(--fs-3xs)', letterSpacing: 'var(--tracking-wider)', textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)' }}>Imagen ilustrativa</span>
          </>}
    </div>
  );
}

const Icon = ({ d }) => <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
const ICONS = [
  'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z',
  'M21 11.5a8.4 8.4 0 0 1-12.2 7.5L3 21l2-5.6A8.5 8.5 0 1 1 21 11.5z',
  'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z',
];

export default function Preview({ text, weighted, netId, onNetChange }) {
  const net = NETS.find(n => n.id === netId) || NETS[0];
  const [formatBy, setFormatBy] = useState({});
  const [image, setImage] = useState(null);
  const fileRef = useRef(null);
  useEffect(() => () => { if (image) URL.revokeObjectURL(image); }, [image]);

  const fmtId = net.formats.includes(formatBy[net.id]) ? formatBy[net.id] : net.formats[0];
  const fmt = FORMATS[fmtId];
  const cps = [...text];

  const pickImage = e => {
    const f = e.target.files?.[0];
    if (f) setImage(URL.createObjectURL(f));
    e.target.value = '';
  };

  let body;
  if (fmt.overlay) {
    const cut = net.cutReel || 80;
    const truncated = cps.length > cut;
    const shown = (truncated ? clip(cps, cut) : text).replace(/\n+/g, ' ');
    const isStory = fmtId === 'story';
    body = (
      <div style={{ position: 'relative', aspectRatio: '9 / 16', width: 'min(100%, 270px)', margin: '0 auto', borderRadius: 12, overflow: 'hidden', color: 'var(--st-white)' }}>
        <Media fill image={image} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.15) 38%, rgba(0,0,0,0) 60%)' }} />
        {isStory && (
          <div style={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ height: 3, borderRadius: 3, background: 'rgba(255,255,255,0.5)' }}><div style={{ width: '35%', height: '100%', borderRadius: 3, background: 'var(--st-white)' }} /></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar size={28} /><span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13 }}>{net.handle}</span></div>
          </div>
        )}
        {!isStory && (
          <div style={{ position: 'absolute', right: 10, bottom: 70, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
            {ICONS.map(d => <Icon key={d} d={d} />)}
          </div>
        )}
        <div style={{ position: 'absolute', left: 12, right: isStory ? 12 : 52, bottom: 14, display: 'flex', flexDirection: 'column', gap: 8, textAlign: isStory ? 'center' : 'left' }}>
          {!isStory && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar size={28} /><span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13 }}>{net.handle}</span></div>}
          <div style={{ fontSize: 13, lineHeight: 1.4, overflowWrap: 'anywhere', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>
            {text ? <>{shown}{truncated && <span style={{ opacity: 0.75 }}>… {net.more}</span>}</> : <span style={{ opacity: 0.7 }}>Tu texto aparecerá acá.</span>}
          </div>
        </div>
      </div>
    );
  } else {
    const len = net.weighted ? weighted : cps.length;
    const truncated = len > net.cut && net.cut < net.limit;
    const shown = truncated ? clip(cps, net.cut) : text;
    const caption = (
      <div style={{ padding: '10px 12px 14px', fontSize: 14, lineHeight: 1.45, color: 'var(--st-gris-oscuro)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        {net.inline && !!text && <strong style={{ fontWeight: 700 }}>{net.handle} </strong>}
        {shown}
        {truncated && <span style={{ color: 'var(--text-muted)' }}>… {net.more}</span>}
        {!text && <span style={{ color: 'var(--text-subtle)' }}>Tu texto aparecerá acá.</span>}
      </div>
    );
    body = (
      <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 12, background: 'var(--st-white)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
          <Avatar />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--fs-sm)', color: 'var(--st-gris-oscuro)' }}>{net.handle}</span>
            <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--text-muted)' }}>{net.meta}</span>
          </div>
        </div>
        {net.textFirst && caption}
        {fmt.ratio && <Media ratio={fmt.ratio} image={image} />}
        {!net.textFirst && caption}
      </div>
    );
  }

  const note = fmt.overlay
    ? `En ${fmtId === 'story' ? 'estados' : fmtId === 'video' ? 'videos de TikTok' : 'reels'} se leen ~${net.cutReel || 80} caracteres antes de “${net.more}”: poné el gancho al principio.`
    : net.note;

  return (
    <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px 10px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-md)', color: 'var(--st-petroleo)' }}>Vista previa</span>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {NETS.map(n => <button key={n.id} onClick={() => onNetChange(n.id)} style={pill(netId === n.id)}>{n.name}</button>)}
        </div>
        {net.formats.length > 1 && (
          <div role="tablist" aria-label="Formato" style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--surface-sunken)', borderRadius: 10 }}>
            {net.formats.map(f => <button key={f} role="tab" aria-selected={f === fmtId} onClick={() => setFormatBy(s => ({ ...s, [net.id]: f }))} style={segBtn(f === fmtId)}>{FORMATS[f].label}</button>)}
          </div>
        )}
      </div>
      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {body}
        <p style={{ margin: 0, fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', lineHeight: 1.4 }}>{note}</p>
        {fmt.ratio && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => fileRef.current?.click()} style={{ border: 'none', background: 'none', color: 'var(--st-coral)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--fs-xs)', cursor: 'pointer', padding: 0 }}>{image ? 'Cambiar imagen' : 'Usar mi imagen'}</button>
            {image && <button onClick={() => setImage(null)} style={{ border: 'none', background: 'none', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontSize: 'var(--fs-xs)', cursor: 'pointer', padding: 0 }}>Quitar imagen</button>}
            <span style={{ fontSize: 'var(--fs-3xs)', color: 'var(--text-subtle)' }}>Solo para ver cómo queda: no se sube.</span>
            <input ref={fileRef} type="file" accept="image/*" onChange={pickImage} hidden />
          </div>
        )}
      </div>
    </div>
  );
}
