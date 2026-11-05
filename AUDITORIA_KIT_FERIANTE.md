# Auditoría técnica · Kit del Emprendedor Feriante (Relab)
*Revisión del código en `main` (commit 5b22afa), noviembre 2026. Solo lectura: no se modificó la aplicación, la base ni los datos.*

## 1. Arquitectura actual
| Capa | Tecnología | Dónde |
|---|---|---|
| Front | React 18 + Vite 6, multipágina (una entrada por recurso) | `vite.config.js`, `kit-feriante/index.html`, `src/kit-feriante.jsx` (773 líneas, un solo archivo), `src/kit-feriante.css` |
| Componentes comunes | `Footer`, `LoginModal`, cliente `api` | `src/Footer.jsx`, `src/LoginModal.jsx`, `src/lib/api.js` |
| Backend | Cloudflare Pages Functions | `functions/api/**` |
| Base de datos | Cloudflare D1 (SQLite) | `migrations/0001–0003`, tabla `resource_state` |
| Autenticación | Google OAuth 2.0 + PKCE, sesión propia con cookie HttpOnly/Secure/SameSite=Lax de 30 días; en la base se guarda el SHA-256 del token | `functions/api/auth/{login,callback,logout}.js`, `server/lib.js` |
| Cifrado | AES-GCM 256 con clave derivada (HKDF) del secreto `TEXT_KEY` | `server/crypto.js` |
| Protección | El middleware rechaza escrituras desde otro origen (Origin ≠ sitio) y responde 503 sin `TEXT_KEY` | `functions/api/_middleware.js` |
| Deploy | Push a `main` → Cloudflare Pages | `wrangler.toml` |

El Kit es una sola página (SPA por hash): `#inicio` muestra "Tu kit" y `#checklist`, `#calculadora`, `#cobros`, `#pitch`, `#visitantes`, `#tracker` y `#roi` abren cada herramienta. El menú lateral y el drawer se arman desde `SECTIONS`.

## 2. Cómo se guardan y recuperan los datos
- **Estado único por persona:** `{ checks, ventas, calc, roi }` (`normalize`, línea 74).
- **Sin cuenta:** `localStorage['relab-kit-feriante']`, que se escribe en cada cambio.
- **Con cuenta:** `GET/PUT /api/state/kit-feriante` (`functions/api/state/[resource].js`).
  - El JSON completo se cifra y se guarda en `resource_state (user_id, resource)` con `INSERT … ON CONFLICT DO UPDATE`.
  - Gana la última escritura.
  - Tope de 100.000 caracteres.
- **Al cargar** (`Kit`, líneas 182-195): `api.me()`. Si la cuenta tiene datos, **reemplazan** a los del navegador. Si no tiene, se sube lo local.
- **Cada cambio** se guarda en la cuenta con 800 ms de espera. Los errores se ignoran (`.catch(() => {})`).
- **Aislamiento entre usuarios en el servidor:** correcto. Todas las consultas filtran por el `user.id` de la sesión, el recurso se valida con `validId` y "Borrar mi cuenta" elimina también `resource_state` (`functions/api/account.js`).

## 3. Funcionalidades existentes (las 7 herramientas)
| Herramienta | Qué hace hoy | Guarda datos |
|---|---|---|
| Checklist | 24 ítems en 5 bloques, ids estables, progreso y "Desmarcar todo" | `checks` |
| Calculadora | 6 costos fijos, productos (costo, precio, unidades), comisión % y % digital → ingresos, costo de lo vendido, comisiones, ganancia, margen y punto de equilibrio. Botón "números de Rosa" | `calc` |
| Cobros | Contenido fijo: 6 medios, tarifas con fuente y "Revisado en octubre 2026" | No |
| Pitch y ventas | Contenido fijo: fórmula, AIDA, pitch de 20 s, atención, upselling y objeciones | No |
| Visitantes | Contenido fijo: tipos de visitante, 10 tipos de cliente y calidad de servicio | No |
| Ventas del día | Registrar venta (producto, monto, medio), vista Hoy/Toda la feria, métricas, totales por medio, borrar una venta o las de hoy, CSV | `ventas` |
| ROI post feria | Ingresos, costos y métricas cualitativas → ingreso neto, ganancia, ROI, venta por día, costo por contacto y decisión. Botón "Traer ventas del tracker" | `roi` |

## 4. Datos compartidos entre herramientas (comprobado)
| Desde → hacia | ¿Existe? | Detalle |
|---|---|---|
| Ventas del día → ROI | **Sí, manual** | `traer()` (línea 704) reemplaza efectivo, digital y días con **todas** las ventas guardadas |
| Calculadora → ROI (costos fijos) | No | El ROI vuelve a pedir stand, traslado, etc. |
| Calculadora → Ventas del día (productos y precios) | No | El producto se escribe a mano en cada venta |
| Cobros → Calculadora / Tracker (comisión por medio) | No | La calculadora usa una sola comisión promedio; el tracker guarda el medio pero no calcula comisión |
| Tracker → ROI (comisiones) | No | "Comisiones pagadas" se carga a mano |
| Checklist → otras | No | "post-4" menciona el ROI, pero sin link |
| Portada | Sí | Lee el estado de todas para mostrar los indicadores |

## 5. Revisión de fórmulas
**Calculadora** (líneas 598-610):
- ingresos = Σ precio × unidades;
- costo de lo vendido = Σ costo × unidades;
- comisiones = ingresos × %digital × %comisión;
- ganancia = ingresos − costo de lo vendido − fijos − comisiones;
- margen = ganancia / ingresos;
- **equilibrio** = ⌈fijos / (precio promedio − costo promedio − precio promedio × %digital × %comisión)⌉.

Las fórmulas son correctas si la mezcla de productos se mantiene. Con el caso de Rosa dan $1.785.000 de ingresos, $722.515 de ganancia y 10 unidades de equilibrio, igual que la cuenta a mano.

**ROI** (líneas 709-722):
- ingreso neto = efectivo + digital − comisiones;
- costos = stand + traslado + insumos + otros;
- ROI = (neto − costos) / costos;
- "por cada $1 volvieron $(1 + ROI)" es correcto.

Observaciones:
- **"Mercadería e insumos"** es ambiguo. Si cargan todo lo que compraron, incluido el stock que no vendieron, el ROI queda subestimado. Tiene que ser el costo de lo **vendido**.
- **% del objetivo:** compara un ingreso **neto** con un objetivo de ventas **bruto**, y así sale más bajo de lo real.
- **Umbrales de la decisión** (ROI ≥ 20% es "rentable"): son un criterio fijo, sin explicar.
- **Comisión de la calculadora:** el campo pide "con IVA", pero Cobros muestra las tasas "+ IVA" y no hay una ayuda que haga la cuenta.

## 6. Errores y riesgos detectados
**Críticos**
1. **Los montos con punto de miles se leen mal.** `num()` (línea 89) solo cambia la coma. Probado con Node:
   - `"120.000"` → **120**;
   - `"1.500,50"` → **0**;
   - `"$5000"` → **0**;
   - `"12 000"` → **0**.

   En Argentina se escribe "120.000". Afecta a la calculadora, a las ventas (una venta de $12.000 se guarda como $12) y al ROI, y el error pasa sin aviso.
2. **Se pierden ventas al ingresar o sin conexión.** Si la cuenta ya tiene datos, al cargar **reemplazan** a los del navegador (líneas 187-188). Pasa en dos casos:
   - ventas que se cargaron sin cuenta, antes de ingresar;
   - ventas cargadas sin señal (que en las ferias es común). `api.me()` falla, el kit funciona como "sin cuenta", y en la siguiente carga con conexión los datos viejos de la cuenta pisan los nuevos.
3. **Se mezclan cuentas en un navegador compartido.**
   - Al cerrar sesión el kit no borra `localStorage`, así que la próxima persona ve las ventas anteriores.
   - Si otra persona ingresa con una cuenta vacía, el kit **sube a su cuenta** los datos de la persona anterior (`hasData(initial())`, línea 189).

   El estado local no tiene dueño. La guía de prompting ya resuelve esto con `owner`.
4. **Dos celulares en el mismo stand se pisan.** Gana la última escritura y no hay control de versión (`updated_at` no se compara), así que cada teléfono sube su copia completa y borra las ventas del otro.

**Altos**
5. **Errores de guardado invisibles.** `.catch(() => {})` (línea 202): "Guardando…" queda fijo, no hay reintento ni aviso de "sin conexión".
6. **Tope de 100.000 caracteres:** alcanza para unas **1.080 ventas** (91 caracteres cada una). Una feria larga lo puede superar, y desde ahí el servidor responde 400 y nada más se guarda en la cuenta, sin aviso.
7. **Ventas duplicadas:** el doble toque o el Enter repetido en "+ Registrar" carga dos ventas iguales. No hay ningún bloqueo ni aviso.
8. **"Traer ventas del tracker"** pisa lo que ya estaba en el ROI sin confirmar y suma ventas de **todas** las ferias, porque no existe el concepto de feria o evento.
9. **Validación:**
   - se aceptan negativos, y un "%digital" de −50 da comisiones negativas;
   - no hay tope en la comisión;
   - los campos inválidos cuentan como 0 sin avisar.

**Medios y bajos**
10. **Login:** vuelve a la portada y no a la herramienta que estabas usando, porque `api.login()` usa solo `pathname`.
11. **"Más vendido"** cuenta registros, no unidades ni pesos, y "Mate" y "mate" cuentan como productos distintos.
12. **El tracker no tiene cantidad:** una venta de 3 unidades es un solo registro, y no se puede editar, solo borrar.
13. **Borrados sin deshacer:** todos usan `window.confirm`.
14. **CSV:** un nombre que empieza con `=` puede ejecutarse como fórmula en Excel. Es riesgo bajo, porque son datos de la propia persona.
15. **Servidor:** `PUT /api/state/:resource` acepta cualquier nombre de recurso válido, sin límite de cantidad ni de pedidos. Una cuenta podría llenar la base. Es riesgo bajo.
16. **Sin versión de esquema** en el estado: dificulta migraciones futuras.
17. **El mismo patrón de guardado** (riesgos 2 a 5) está en el checklist Cyber Monday (`src/checklist.jsx`) y en la guía (`src/guia.js`).

## 7. Accesibilidad, navegación y responsive
**Bien:**
- `lang="es-AR"`;
- labels que envuelven los inputs;
- ítems del checklist como `button` con `aria-pressed`;
- íconos `aria-hidden`;
- `role="alert"` en el error de monto;
- `aria-label` en los botones de borrar;
- `inputMode="decimal"`;
- Escape cierra el menú.

**Falta:**
- llevar el foco al título al cambiar de herramienta;
- que el drawer sea `role="dialog"`, con foco atrapado y devolución del foco;
- `aria-pressed` en el selector Hoy/Toda la feria;
- `aria-live` en los resultados de la calculadora y del ROI;
- revisar el contraste de las pastillas de estado de 10,5 px.

**Responsive:** probado antes con Playwright en 390 px y 1280 px, sin scroll horizontal. Falta probar 320–360 px y tablets.

## 8. Funcionalidades parcialmente implementadas
- **Integración entre herramientas:** solo existe Ventas → ROI, manual y sin filtro por feria (sección 4).
- **Comisiones:** la calculadora usa un promedio; las tasas por medio de Cobros son texto fijo, y el tracker registra el medio pero no la comisión.
- **Multi-feria:** no existe. Todo se acumula en una sola lista.
- **Productos:** existen en la calculadora, pero no se pueden elegir en el tracker ni se cargan cantidades.
- **Exportación:** solo hay CSV de ventas. No hay PDF ni balance de la calculadora o el ROI, ni copia de respaldo.
- **Pitch y Visitantes:** son solo contenido; no permiten armar y guardar el pitch propio ni las objeciones propias.

## 9. Pruebas automatizadas
**No hay ninguna en el repo:** no hay script `test` en `package.json`, ni archivos `*.test.*` o `*.spec.*`, ni CI. Las verificaciones con Playwright de las etapas anteriores se corrieron a mano desde el scratchpad y no quedaron en el repo.

Casos críticos sin cubrir:
- `num()` con formatos argentinos;
- las fórmulas de la calculadora y del ROI, con casos límite (0, negativos, sin unidades, sin costos);
- fusión de datos al ingresar: local con ventas vs. cuenta con datos;
- cierre de sesión y cambio de cuenta en el mismo navegador;
- conflicto entre dos dispositivos;
- error de red y reintento;
- tope de 100.000 caracteres;
- en la API: aislamiento entre usuarios, recurso inválido, sin sesión y Origin ajeno;
- e2e: registrar → recargar → traer al ROI.

## 10. Recomendaciones priorizadas
| # | Recomendación | Impacto | Complejidad |
|---|---|---|---|
| 1 | Lectura de números en formato argentino (miles con punto, decimales con coma, `$` y espacios), aviso en campos inválidos, sin negativos y % entre 0 y 100 | Crítico | Baja |
| 2 | Estado local con dueño (`owner` = cuenta); limpiar al cerrar sesión; no subir datos de otra persona | Crítico | Baja |
| 3 | Fusión al ingresar y al recuperar conexión: ventas unidas por `id`, checks unidos, calculadora y ROI por fecha de cambio; nunca descartar ventas | Crítico | Media |
| 4 | Estado de guardado visible: "Sin conexión, guardado en este teléfono" y reintento automático | Alto | Baja |
| 5 | Control de concurrencia: versión (`updated_at`) en el PUT; si cambió, traer, fusionar y reintentar | Alto | Media |
| 6 | Evitar duplicados: bloquear el botón mientras registra y avisar si hay una venta igual en los últimos segundos | Alto | Baja |
| 7 | Tope de tamaño: avisar al acercarse y subir el límite o guardar las ventas en filas propias | Alto | Media |
| 8 | Ferias o eventos: cada venta pertenece a una feria y el ROI se calcula por feria | Alto | Media |
| 9 | Integraciones: productos de la calculadora en el tracker (con cantidad), comisión por medio configurable que estima las comisiones del ROI, costos fijos de la calculadora en el ROI, confirmación antes de "Traer" | Alto | Media |
| 10 | Volver a la herramienta después del login (incluir el hash en `return`) | Medio | Baja |
| 11 | Accesibilidad: foco al cambiar de herramienta, drawer accesible, `aria-live`, `aria-pressed`, contraste | Medio | Baja |
| 12 | Pruebas: Vitest para cálculos y fusión, Playwright e2e en el repo, pruebas de API y `npm test` | Alto (previene regresiones) | Media |
| 13 | Versión de esquema en el estado y migración | Medio | Baja |
| 14 | Editar ventas, deshacer borrados y CSV seguro (escapar `=`, `+`, `-`, `@`) | Medio | Baja |
| 15 | Pitch y objeciones propias guardadas; PDF del balance o ROI | Medio | Media |

## 11. Archivos y componentes a modificar
- `src/kit-feriante.jsx`: dividirlo en módulos sin cambiar la interfaz.
  - `src/kit/calc.js`: `num`, `fmt` y las fórmulas, como funciones puras.
  - `src/kit/storage.js`: estado local con dueño, fusión, versión y reintentos.
  - Componentes por herramienta.
- `src/lib/api.js`: `saveState` con versión esperada y manejo de 409; `login` con el hash.
- `functions/api/state/[resource].js`: aceptar `baseUpdatedAt` y responder 409 si cambió; devolver `updatedAt`; límite de recursos por usuario.
- `server/lib.js`: `safeReturn` que acepte un `#hash` seguro.
- `src/kit-feriante.css`: estados de error, de guardado y de foco.
- **Mismo patrón de guardado, después:** `src/checklist.jsx`, `src/guia.js`.
- **Pruebas:** `package.json` (Vitest y script `test`), `tests/unit/*.test.js`, `tests/e2e/*.spec.js`.
- **Privacidad:** `src/privacidad.jsx` solo si se suman datos nuevos (por ejemplo, ferias con nombre).
- **Documentación:** `CLAUDE.md`.

## 12. Propuesta de implementación incremental
Cada etapa va en su propia rama, con vista previa, pruebas, capturas y paso a `main` solo con el OK de Stella. Ninguna elimina funciones existentes y todas conservan los datos guardados: mismos ids y misma clave, con migración del estado si hace falta.

1. **Etapa 2 · Base segura, sin cambios visibles.** Extraer las fórmulas a `src/kit/calc.js`, sumar Vitest con pruebas de `num()`, de las fórmulas y de casos límite, y corregir la lectura de números en formato argentino (#1). Agregar `npm test`.
2. **Etapa 3 · No perder ni mezclar datos.** Dueño del estado local y limpieza al cerrar sesión (#2), fusión al ingresar y al reconectar (#3), estado de guardado visible y reintento (#4), anti-duplicados (#6), versión de esquema (#13), y pruebas de cada caso.
3. **Etapa 4 · Varios dispositivos.** Control de versión en la API con 409 + fusión (#5) y tratamiento del tope de tamaño (#7). Pruebas de API y de conflicto.
4. **Etapa 5 · Herramientas conectadas.** Ferias (#8), productos con cantidad y comisión por medio, costos fijos al ROI y confirmación antes de traer (#9).
5. **Etapa 6 · Experiencia.** Login que vuelve a la herramienta (#10), accesibilidad (#11), editar y deshacer ventas, CSV seguro (#14), pitch propio y PDF (#15).
6. **Después:** aplicar las etapas 2 a 4 al checklist Cyber Monday y a la guía, que comparten el patrón de guardado.
