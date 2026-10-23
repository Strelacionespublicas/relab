// Recursos que muestra la vitrina de Relab (src/hub.jsx). Para sumar uno, agregá un objeto:
//   href:   ruta del recurso, con barra final ('/nombre/'). Debe existir nombre/index.html.
//   name:   texto o JSX con el nombre (puede ser el wordmark del recurso).
//   desc:   una o dos líneas: qué resuelve, no cómo funciona.
//   cta:    texto del link (opcional, por defecto "Abrir herramienta").
//   status: 'activo' (con link) o 'proximamente' (tarjeta punteada, sin link).
export const RESOURCES = [
  {
    href: '/textoenredes/',
    name: <><span style={{ fontWeight: 800 }}>texto</span><span style={{ fontWeight: 400, fontStyle: 'italic', color: 'var(--st-coral)' }}>en</span><span style={{ fontWeight: 300 }}>redes</span></>,
    desc: 'Negrita y cursiva que se ven en todas las redes, emojis, hashtags, vista previa del post y conteo de caracteres para 7 redes.',
    status: 'activo',
  },
];
