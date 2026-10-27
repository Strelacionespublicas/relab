// Recursos que muestra la vitrina de Relab (src/hub.jsx). Para sumar uno, agregá un objeto:
//   href:   ruta del recurso, con barra final ('/nombre/'). Debe existir nombre/index.html.
//   name:   texto o JSX con el nombre (puede ser el wordmark del recurso).
//   desc:   una o dos líneas: qué resuelve, no cómo funciona.
//   cta:    texto del link (opcional, por defecto "Abrir herramienta").
//   status: 'activo' (con link) o 'proximamente' (tarjeta punteada, sin link).
//   badge:  etiqueta opcional arriba a la derecha: 'Nuevo' o 'Recomendado'. Usar pocas para que no pierdan fuerza.
//   external: true si el recurso vive en otro sitio (se abre en una pestaña nueva).
export const RESOURCES = [
  {
    href: 'https://guia.strelacionespublicas.com.ar/',
    external: true,
    badge: 'Recomendado',
    name: <span><span style={{ fontWeight: 800 }}>guía</span> <span style={{ fontWeight: 400, fontStyle: 'italic', color: 'var(--st-coral)' }}>prompting</span></span>,
    desc: 'Curso gratuito para pedirle a la IA lo que necesitás y crear tus propias herramientas con Claude y Codex: método, ejercicios y certificado.',
    cta: 'Ir al curso',
    status: 'activo',
  },
  {
    href: '/textoenredes/',
    name: <><span style={{ fontWeight: 800 }}>texto</span><span style={{ fontWeight: 400, fontStyle: 'italic', color: 'var(--st-coral)' }}>en</span><span style={{ fontWeight: 300 }}>redes</span></>,
    desc: 'Negrita y cursiva que se ven en todas las redes, emojis, hashtags, vista previa del post y conteo de caracteres para 7 redes.',
    status: 'activo',
  },
  {
    href: '/checklist-cyber-monday/',
    name: <span><span style={{ fontWeight: 800 }}>checklist</span> <span style={{ fontWeight: 400, fontStyle: 'italic', color: 'var(--st-coral)' }}>cyber monday</span></span>,
    desc: 'Checklist interactivo en 7 áreas: tienda, promociones, comunicación, logística, plan de acción y resultados. Con ejemplos y descarga en PDF.',
    cta: 'Abrir checklist',
    status: 'activo',
  },
  {
    href: '/guia-herramientas-digitales/',
    name: <span><span style={{ fontWeight: 800 }}>guía</span> <span style={{ fontWeight: 400, fontStyle: 'italic', color: 'var(--st-coral)' }}>herramientas digitales</span></span>,
    desc: 'Curso corto en 9 módulos: GitHub, Netlify, Vercel, Cloudflare, Codex o Claude Code. Qué usar para crear una landing, una calculadora o un cotizador, con tutoriales paso a paso.',
    cta: 'Empezar el curso',
    status: 'activo',
  },
  {
    href: '/kit-feriante/',
    badge: 'Nuevo',
    name: <span><span style={{ fontWeight: 800 }}>kit</span> <span style={{ fontWeight: 400, fontStyle: 'italic', color: 'var(--st-coral)' }}>feriante</span></span>,
    desc: 'Para vender en ferias y expos: checklist, pitch, registro de ventas por día, calculadora de rentabilidad, medios de cobro y ROI post feria.',
    cta: 'Abrir kit',
    status: 'activo',
  },
];
