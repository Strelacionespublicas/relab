# Arquitectura de Relab

## Stack
- **Front:** Vite + React 18, sitio multipágina. Cada recurso es una carpeta con su `index.html` y se agrega en `vite.config.js` (`build.rollupOptions.input`).
- **Back:** Cloudflare Pages Functions en `functions/api/` (helpers en `server/lib.js`, cifrado en `server/crypto.js`, acceso PRO en `server/pro.js`).
- **Base:** Cloudflare D1 `relab` (binding `DB`), una sola cuenta para todos los recursos. Login con Google (OAuth + PKCE) en `functions/api/auth/`.
- **Publicación:** Cloudflare Pages, proyecto `relab` (`relab-6su.pages.dev` + dominio propio). Cada push a `main` se publica; cada rama genera una vista previa `<rama>.relab-6su.pages.dev`, donde el login no funciona.
- **Design system ST:** `src/ds/` (tokens, Karla e Inter). El Kit, el checklist Cyber, `/pro` y `/admin` reutilizan `src/kit-feriante.css`.

## Páginas
| Ruta | Archivo | Qué es |
|---|---|---|
| `/` | `src/hub.jsx` + `src/resources.jsx` | Vitrina con tarjetas (badge `Nuevo`/`Recomendado`) |
| `/kit-feriante/` | `src/kit-feriante.jsx` | Kit del feriante (gratis + PRO) |
| `/pro/` | `src/pro-landing.jsx` | Landing para activar PRO gratis con Google |
| `/admin/` | `src/admin.jsx` | Panel de Stella: registros, contactos y códigos |
| `/textoenredes/` | `src/App.jsx` | Editor de texto con formato para redes |
| `/checklist-cyber-monday/`, `/guia-herramientas-digitales/` | `src/checklist.jsx`; `guia-…/index.html` + `src/guia.js` | Recursos en formato curso |
| `/privacidad/` | `src/privacidad.jsx` | Política: actualizar texto y fecha cuando se guarda algo nuevo |

## Kit: módulos del navegador (`src/kit/`)
- `calc.js`: lectura de importes argentinos (`parseNumber`, `readField`, `fmt`) y cuentas de la Calculadora y el ROI (`calcRoi`, con "tu sueldo": `ganDia`, `ganHora`, `cubre`, `trasSueldo`).
- `sueldo-calc.js`, `sueldo.jsx`, `sueldo-ejemplo.js`: Mi sueldo y rentabilidad (cuentas puras probadas en `tests/unit/sueldo-calc.test.js`; colores de los sobres validados para daltonismo).
- `state.js`, `sync.js`: estado gratis `{ checks, ventas, calc, roi, sueldo, propios }` (`sueldo` = `{ f, hist }`; `propios` = tareas propias del checklist, su marca en `checks['p-' + id]`). Una clave nueva del estado hay que sumarla en `normalize`, `hasData`, `merge3`, `mergeFirst` y `containedIn`, o se pierde al sincronizar. El estado completo tiene un límite de 100 KB en el navegador y en `resource_state` (`kit-feriante`), con dueño por cuenta, sin conexión y control de versión (409).
- `pro.jsx`: insignia PRO, modal de canje de código, `?codigo=`; `PRO_ENABLED` (visible por defecto; `VITE_PRO_ENABLED=0` lo oculta).
- `pro-store.js`: datos PRO en el dispositivo más una cola de cambios sin conexión; sincroniza con `/api/pro/data` y `/api/pro/ops`.
- `pro-calc.js`: ventas, stock (libro de movimientos), resumen del negocio, productos más vendidos, sueldo (`jornadasFeria`, `resumenSueldo`, `sueldoObjetivo`, `mesesDelPeriodo`), orden y búsqueda para la venta rápida.
- `pro-import.js`: importar productos desde Excel, CSV o filas pegadas. El .xlsx se lee con `read-excel-file/browser`, que se carga solo al subir un archivo.
- `pro-modules.jsx`: pantallas PRO. Resumen (con Tu sueldo y Primeros pasos), Mis ferias, Mis productos (con Importar y favoritos), Ventas PRO (buscador, variantes, aviso de comisión), Stock, papelera y exportar.
- `src/lib/version.js`: aviso "Hay una versión nueva · Actualizar". Compara el id de build con `/version.json`, pedido sin caché.

## Tablas (migraciones)
| Migración | Tablas |
|---|---|
| 0001–0003 | `users`, `sessions`, `drafts`, `tag_sets`, `resource_state` (JSON cifrado por persona y recurso; `updated_at` hace de versión) |
| 0004 | `access_codes` (solo el hash del código), `redemptions`, `entitlements` (única fuente de "¿tiene PRO?"), `admin_audit` |
| 0005 | `pro_rows` (`user_id, kind, id, version, data` cifrado, `last_op`, `deleted_at`). Kinds: `feria`, `producto`, `venta`, `stock`, `config` |
| 0006 | `pro_registros` (registro desde `/pro`: localidad, rubro, ferias por mes, WhatsApp cifrado, consentimiento, campaña) |

Todas las tablas con datos de personas llevan `REFERENCES users(id) ON DELETE CASCADE`, y "Borrar mi cuenta" (`functions/api/account.js`) también borra las tablas PRO.

## Endpoints
- `/api/me`, `/api/state/:resource`, `/api/drafts`, `/api/tagsets`, `/api/current`, `/api/account`, `/api/auth/*`.
- `/api/pro/me`: si tiene PRO, hasta cuándo y si es admin.
- `/api/pro/redeem`: canje de código en un solo `DB.batch`, que respeta el cupo aunque canjeen muchas personas a la vez.
- `/api/pro/join`: registro desde `/pro`. Activa PRO 365 días una sola vez por persona (permiso con id `lanzamiento`). `PRO_LAUNCH=0` cierra el lanzamiento.
- `/api/pro/data`: lee siempre, aunque PRO haya vencido.
- `/api/pro/ops`: escribe, con `requirePro`. Crear va con `base: null` y editar con la versión; el `opId` hace que un reintento no duplique.
- `/api/admin/codes` (y `[id]`) y `/api/admin/registros`. Con `?formato=csv` descarga los contactos de quienes aceptaron novedades. Solo para los emails de `ADMIN_EMAILS`.

## Decisiones de diseño que conviene respetar
- **El stock es un libro:** registros `stock` (existencias, reposiciones, ajustes) menos las unidades de las ventas. Editar o borrar una venta corrige el stock solo, y dos celulares vendiendo a la vez no se pisan.
- **Ids creados en el dispositivo más `opId`:** un doble toque o un reintento no duplica ventas.
- **Borrado suave**, con papelera de 30 días.
- **Sin PRO vigente,** todo se ve y se exporta; solo se bloquea crear y editar.
