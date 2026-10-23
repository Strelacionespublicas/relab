// Componentes del design system ST usados por TextoRedes, portados de _ds_bundle.js.
import { useMemo } from 'react';
import logoWhite from './assets/logo-white.png';

const BTN_SIZES = {
  sm: { fontSize: 'var(--fs-sm)', padding: '8px 16px', gap: 8, minHeight: 36 },
  md: { fontSize: 'var(--fs-md)', padding: '11px 22px', gap: 9, minHeight: 44 },
  lg: { fontSize: 'var(--fs-lg)', padding: '14px 30px', gap: 10, minHeight: 52 },
};
const BTN_VARIANTS = {
  primary: { background: 'var(--st-coral)', color: 'var(--st-white)', border: '1.5px solid var(--st-coral)', boxShadow: 'var(--shadow-coral)' },
  secondary: { background: 'var(--st-petroleo)', color: 'var(--st-white)', border: '1.5px solid var(--st-petroleo)', boxShadow: 'var(--shadow-sm)' },
  outline: { background: 'transparent', color: 'var(--st-petroleo)', border: '1.5px solid var(--border-default)' },
  ghost: { background: 'transparent', color: 'var(--st-petroleo)', border: '1.5px solid transparent' },
};

export function Button({ variant = 'primary', size = 'md', fullWidth = false, disabled = false, iconLeft = null, iconRight = null, children, style = {}, ...rest }) {
  const s = BTN_SIZES[size] || BTN_SIZES.md;
  const v = BTN_VARIANTS[variant] || BTN_VARIANTS.primary;
  return (
    <button
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: s.gap,
        fontFamily: 'var(--font-display)', fontWeight: 'var(--fw-semibold)', fontSize: s.fontSize, letterSpacing: '0.01em',
        padding: s.padding, minHeight: s.minHeight, width: fullWidth ? '100%' : 'auto', borderRadius: 'var(--radius-pill)',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        transition: 'transform var(--dur-fast) var(--ease-standard), filter var(--dur-fast) var(--ease-standard)',
        ...v, ...style,
      }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = 'scale(0.97)'; }}
      onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.filter = 'brightness(1.06)'; }}
      onMouseLeave={e => { e.currentTarget.style.filter = 'none'; e.currentTarget.style.transform = 'scale(1)'; }}
      {...rest}
    >
      {iconLeft}{children}{iconRight}
    </button>
  );
}

export function Switch({ label, checked, onChange, disabled = false, style = {} }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 12, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, font: 'var(--type-body)', color: 'var(--text-body)', ...style }}>
      <span style={{ position: 'relative', width: 44, height: 26, borderRadius: 'var(--radius-pill)', background: checked ? 'var(--st-celeste)' : 'var(--st-neutral-300)', transition: 'background var(--dur-base) var(--ease-standard)', flex: 'none' }}>
        <span style={{ position: 'absolute', top: 3, left: checked ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: 'var(--shadow-sm)', transition: 'left var(--dur-base) var(--ease-out)' }} />
        <input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange && onChange(e.target.checked)} style={{ position: 'absolute', inset: 0, opacity: 0, margin: 0, cursor: 'inherit' }} />
      </span>
      {label && <span>{label}</span>}
    </label>
  );
}

// Solo usamos la variante blanca del logo ST en esta herramienta.
export function Logo({ height = 48, style = {} }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1, ...style }}>
      <img src={logoWhite} alt="ST Relaciones Públicas" style={{ height, width: 'auto', display: 'block' }} />
    </span>
  );
}

// Patrón de nodos y líneas de la marca (NetworkBackground del design system). Red determinista
// por semilla, recoloreable con `color`. Pensado como capa decorativa de fondo.
export function NetworkBackground({ color = 'var(--st-celeste)', density = 46, maxDist = 210, opacity = 0.5, seed = 7, width = 1200, height = 600, style = {} }) {
  const { lines, dots } = useMemo(() => {
    let a = seed >>> 0;
    const rnd = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pts = [];
    for (let i = 0; i < density; i++) pts.push({ x: rnd() * width, y: rnd() * height, r: 1.6 + rnd() * 3.2 });
    const lines = [];
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
      if (d < maxDist) lines.push({ ...pts[i], x2: pts[j].x, y2: pts[j].y, o: (1 - d / maxDist) * 0.55 });
    }
    return { lines, dots: pts };
  }, [seed, density, maxDist, width, height]);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ color, opacity, display: 'block', width: '100%', height: '100%', ...style }}>
      {lines.map((l, i) => <line key={i} x1={l.x} y1={l.y} x2={l.x2} y2={l.y2} stroke="currentColor" strokeWidth="1" opacity={l.o} />)}
      {dots.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.r} fill="currentColor" />)}
    </svg>
  );
}
