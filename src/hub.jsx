// Vitrina de Relab. La lista de recursos está en src/resources.jsx.
import { createRoot } from 'react-dom/client';
import './ds/tokens/fonts.css';
import './ds/tokens/colors.css';
import './ds/tokens/typography.css';
import './ds/tokens/spacing.css';
import './app.css';
import { Logo } from './ds/components.jsx';
import { Footer } from './Footer.jsx';
import { RESOURCES } from './resources.jsx';


const soon = { boxShadow: 'none', background: 'transparent', border: '1.5px dashed var(--border-default)' };
const card = { background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 16, boxShadow: 'var(--shadow-sm)', padding: 24, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 200 };

function Hub() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: 'var(--st-petroleo)', color: 'var(--st-white)', padding: '14px clamp(16px, 4vw, 40px)', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Logo height={30} />
        <div style={{ width: 1, height: 28, background: 'var(--border-inverse)' }} />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, letterSpacing: '-0.035em', lineHeight: 1 }}>relab</span>
      </header>

      <main style={{ flex: 1, padding: 'clamp(28px, 5vw, 56px) clamp(16px, 4vw, 40px) 48px', maxWidth: 1120, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
        <section>
          <span style={{ fontFamily: 'var(--font-data)', fontSize: 'var(--fs-2xs)', letterSpacing: 'var(--tracking-wider)', textTransform: 'uppercase', color: 'var(--st-coral)', fontWeight: 700 }}>Recursos de ST Relaciones Públicas</span>
          <h1 style={{ margin: '10px 0 0', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(30px, 5vw, 48px)', lineHeight: 1.08, letterSpacing: '-0.02em', color: 'var(--st-petroleo)', textWrap: 'balance' }}>Herramientas para comunicar <span style={{ color: 'var(--st-coral)' }}>mejor y más rápido</span></h1>
          <p style={{ margin: '12px 0 0', maxWidth: 620, fontSize: 'var(--fs-lg)', lineHeight: 1.5, color: 'var(--text-muted)', textWrap: 'pretty' }}>Gratis y sin vueltas. Usalas sin cuenta, o entrá con Google para guardar tu avance en todos los recursos.</p>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {RESOURCES.map(r => (r.status === 'proximamente' ? (
            <div key={r.href} style={{ ...card, ...soon }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 24, letterSpacing: '-0.035em', color: 'var(--st-petroleo)' }}>{r.name}</span>
              <span style={{ flex: 1, fontSize: 'var(--fs-sm)', lineHeight: 1.5, color: 'var(--text-muted)' }}>{r.desc}</span>
              <span style={{ fontFamily: 'var(--font-data)', fontSize: 'var(--fs-3xs)', letterSpacing: 'var(--tracking-wider)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Próximamente</span>
            </div>
          ) : (
            <a key={r.href} href={r.href} className="hv-card" style={{ ...card, textDecoration: 'none', color: 'inherit' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 28, letterSpacing: '-0.035em', color: 'var(--st-petroleo)', display: 'flex', gap: 6, alignItems: 'baseline' }}>{r.name}</span>
              <span style={{ flex: 1, fontSize: 'var(--fs-md)', lineHeight: 1.5, color: 'var(--text-body)' }}>{r.desc}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--fs-sm)', color: 'var(--st-coral)' }}>{r.cta || 'Abrir herramienta'} →</span>
            </a>
          )))}
          <div style={{ ...card, ...soon, justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-lg)', color: 'var(--st-petroleo)' }}>Próximamente</span>
            <span style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.5, color: 'var(--text-muted)' }}>Estamos preparando nuevos recursos. Con tu cuenta de Relab vas a poder usarlos todos.</span>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Hub />);
