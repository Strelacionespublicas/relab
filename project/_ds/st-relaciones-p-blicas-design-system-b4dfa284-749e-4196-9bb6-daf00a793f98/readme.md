# ST Relaciones Públicas — Design System

Guía de marca, componentes y tokens para proyectos de ST Relaciones Públicas. Sistema modular, escalable y listo para consumir.

## 📋 Estructura

```
.
├── styles.css              # Punto de entrada (importa tokens + fonts)
├── tokens/                 # Tokens de diseño
│   ├── colors.css          # Paleta de marca
│   ├── typography.css      # Familias y escalas tipográficas
│   ├── spacing.css         # Espaciado y radios
│   ├── shadows.css         # Sombras de marca
│   └── fonts.css           # @font-face (Karla + Inter self-hosted)
├── components/             # Componentes reutilizables
│   ├── brand/              # Logo, Network Background
│   ├── core/               # Button, Badge, Card, Stat
│   └── forms/              # Input, Select, Checkbox, Switch
├── guidelines/             # Especificaciones visuales
│   ├── color-primary.card.html
│   ├── typography.card.html
│   └── ...
├── slides/                 # Plantillas de slides reutilizables
└── flyers/                 # Ejemplos de flyers y campañas

```

## 🎨 Paletas

### Primaria (Marca base)
- **Petróleo**: #012C3D — fondo corporativo, subtítulos
- **Coral**: #F15946 — acción, énfasis, enlaces
- **Celeste**: #4FC4E8 — apoyo, datos positivos
- **Gris claro**: #F5F5F0 — superficies neutras
- **Gris oscuro**: #2C3E50 — texto principal

## 📝 Tipografía

- **Inter** — Display, títulos, portadas. Moderno, geométrico. Weights: 100–900
- **Karla** — Body, párrafos, descripciones. Cálido, accesible. Weights: 100–900
- Ambas variable fonts self-hosted + Google Fonts fallback

### Escala tipográfica
- H1: 56px / 1.1 line-height (Inter 800)
- H2: 42px / 1.15 (Inter 700)
- H3: 28px / 1.3 (Inter 600)
- Body: 16px / 1.6 (Karla 400)
- Caption: 12px / 1.4 (Karla 500)

## 🧩 Componentes

### Brand
- **Logo** — Logo en blanco, color, petróleo (`.png` + SVG)
- **NetworkBackground** — Fondo geométrico de marca

### Core
- **Button** — Primario, secundario, outline, sizes S/M/L
- **Badge** — Estados: default, success, warning, error
- **Card** — Contenedor flexible con sombra
- **Stat** — Número + label (para dashboards, KPIs)

### Forms
- **Input** — Text, email, password, sizes S/M/L
- **Select** — Dropdown con opciones
- **Checkbox** — Single + grupo
- **Switch** — Toggle on/off

## 🎛️ Tokens CSS

Todos los tokens están disponibles como variables CSS. Ejemplo:

```css
background: var(--st-coral);
color: var(--text-primary);
font-family: var(--font-display);
padding: var(--space-lg);
border-radius: var(--radius-md);
box-shadow: var(--shadow-lg);
```

Tokens disponibles:
- **Colors**: `--st-petrol`, `--st-coral`, `--st-celeste`, `--st-indigo-dark`, etc.
- **Typography**: `--font-display`, `--font-body`, `--font-size-*`, `--line-height-*`
- **Spacing**: `--space-xs` (4px) a `--space-4xl` (64px)
- **Radius**: `--radius-sm` (4px) a `--radius-full` (999px)
- **Shadows**: `--shadow-sm`, `--shadow-md`, `--shadow-lg`

## 🚀 Cómo usar

### En un proyecto que consume este DS

1. Copia o referencia este proyecto como design system bound
2. En tu HTML, carga el bundle:
   ```html
   <link rel="stylesheet" href="_ds/styles.css">
   <script src="_ds/_ds_bundle.js"></script>
   ```
3. Accede a componentes:
   ```js
   const { Button, Card, Logo } = window.STRelacionesPBlicasDesignSystem_b4dfa2;
   ```
4. O copia archivos individuales (componentes, tokens, flyers)

### En este DS (authoring)

- Edita componentes en `components/*/`
- Actualiza tokens en `tokens/`
- Crea cartas en `guidelines/` con `<!-- @dsCard group="…" -->`
- Usa `check_design_system` para validar cambios

## 📊 Especificaciones

### Espaciado (8px grid)
- xs: 4px
- sm: 8px
- md: 16px
- lg: 24px
- xl: 32px
- 2xl: 48px
- 3xl: 64px

### Radios
- sm: 4px
- md: 8px
- lg: 12px
- full: 999px

### Sombras
- sm: 0 2px 4px rgba(0,0,0,0.08)
- md: 0 4px 12px rgba(0,0,0,0.12)
- lg: 0 12px 24px rgba(0,0,0,0.16)

## 🔗 Documentación

Cada componente tiene un archivo `.prompt.md` con:
- Descripción y uso
- Props disponibles
- Ejemplos de código
- Variantes

## 📝 Notas de marca

- Tono: Profesional, innovador, accesible
- Voz: Directa, sin jerga innecesaria
- Uso de logo: Siempre con suficiente espaciado (≥ 20px alrededor)
- Fotografía: Documentales, personas en contexto real, colores naturales
- Ilustraciones: Línea limpia, geométricas, apoyo visual (no protagonismo)

---

**Última actualización**: Junio 2026  
**Mantenedor**: ST Relaciones Públicas  
**Versión**: 1.0
