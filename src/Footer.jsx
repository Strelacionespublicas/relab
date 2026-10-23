// Pie común a la vitrina y a todos los recursos de Relab.
export function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--border-subtle)', padding: '20px clamp(16px, 4vw, 40px)', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
      <span>Herramienta diseñada por ST Relaciones Públicas · © 2026 Todos los derechos reservados</span>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <a href="/">Más recursos relab</a>
        <a href="/privacidad/">Privacidad</a>
        <a href="https://www.instagram.com/strelacionespublicas/" target="_blank" rel="noreferrer">@strelacionespublicas</a>
        <a href="https://strelacionespublicas.com.ar/" target="_blank" rel="noreferrer">strelacionespublicas.com.ar</a>
      </div>
    </footer>
  );
}
