---
name: relab-st
description: Cómo trabajar en Relab, el sitio de recursos gratuitos de ST Relaciones Públicas (Stella Torres) en relab.strelacionespublicas.com.ar — el Kit del feriante y Kit Feriante PRO (ferias, productos, ventas, stock, resumen, tu sueldo), la landing /pro, el panel /admin, TextoEnRedes, los checklists y las guías. Usar SIEMPRE que Stella pida cambios, funciones nuevas, correcciones, recursos nuevos, publicar, revisar el panel, migraciones de la base (D1), problemas de Cloudflare o de caché, o hable del piloto con feriantes, aunque no diga "Relab" (por ejemplo "agregá algo al kit", "no veo la actualización en el celu", "publicalo", "sumá un recurso", "¿cómo van los registros?").
---

# Relab (ST Relaciones Públicas)

Relab es el conjunto de recursos gratuitos de Stella en **relab.strelacionespublicas.com.ar**: el Kit del feriante (gratis + PRO), TextoEnRedes, checklists, guías y la vitrina. Es un solo sitio Vite + React en Cloudflare Pages, con funciones en Cloudflare y base D1. Repo: `Strelacionespublicas/relab`. El repo tiene un `CLAUDE.md` detallado: leelo al empezar cualquier trabajo de código.

## Cómo trabajar con Stella
- Stella **no programa**. Hablale en español rioplatense, claro, sin jerga técnica; si un término es inevitable, explicalo en una línea.
- Quiere **criterio, no complacencia**: si una idea suya tiene un costo (por ejemplo, achicar el público del kit o sumar complejidad), decíselo con el porqué y una alternativa, y dejá que decida. Para decisiones de producto, preguntá con opciones concretas y marcá la recomendada.
- Cuando tenga que tocar un panel (Cloudflare, Google, WooCommerce), dale **pasos numerados con los nombres exactos de los menús**. Suele tener el navegador traducido al español: "Trabajadores y Pajes" = Workers & Pages; "laboratorio de reventa" = relab.
- Reportá con honestidad: qué está publicado y qué no, qué pruebas pasaron, y si algo que dijiste antes resultó no ser cierto, corregilo explícitamente.

## Reglas que no se rompen (y por qué)
1. **Nunca a `main` sin su OK explícito** ("sí, publicá"). Cada push a `main` se publica solo en el sitio real. Trabajá siempre en una rama.
2. **La base de datos la toca ella.** Las migraciones nuevas van en `migrations/000N_*.sql`, solo aditivas. Para producción le das un bloque SQL listo para pegar en Cloudflare → D1 `relab` → Consola, con `CREATE TABLE IF NOT EXISTS` y el `INSERT INTO d1_migrations ... WHERE NOT EXISTS`, así pegarlo dos veces no rompe nada. Pedile que anote la hora antes, por si hay que volver con Time Travel.
3. **Privacidad: Stella no quiere poder leer lo que cargan las personas.** Todo contenido de usuarios va cifrado (`encryptText`/`decryptText` de `server/crypto.js`, con el Secreto `TEXT_KEY`). El panel `/admin` muestra solo cantidades; la única excepción son los datos de contacto de quienes aceptaron recibir novedades en `/pro`. Nada de pantallas, exportaciones o logs con ventas, productos o textos de terceros.
4. **Lo gratis no se recorta.** Las 9 herramientas gratis del Kit siguen completas; PRO solo suma.
5. **Secretos solo en Cloudflare** (`TEXT_KEY`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAILS`), nunca en el repo ni en el chat. Con `[vars]` en `wrangler.toml`, Cloudflare ignora las variables de texto del panel: por eso `ADMIN_EMAILS` va como Secreto.
6. **No cambiar URLs ya compartidas** (`/kit-feriante/`, `/pro/`, `/admin/`): hay links en mails y redes.

## Flujo de trabajo
1. Rama nueva desde `main` actualizado.
2. Cambios + pruebas: `npm test` (Vitest; las funciones de servidor se prueban con su código real sobre `node:sqlite`) y pruebas de navegador con Playwright contra `wrangler pages dev dist` local (ver `references/operacion.md`). Revisá las pantallas también en tamaño celular (390 px).
3. Commit y push de la rama. Mostrale capturas del celular y un resumen en su idioma: qué cambia para la feriante, qué pruebas pasaron, qué decisiones tomaste.
4. Con su "sí, publicá": fast-forward de la rama a `main`, `npm test` y `npm run build` de nuevo, push, y confirmá el despliegue con `gh api repos/Strelacionespublicas/relab/commits/<sha>/check-runs` hasta ver "Deployed successfully". Desde el entorno remoto el sitio no se puede abrir: pedile que lo verifique en el celular.

## Dónde mirar según el pedido
- **Arquitectura, archivos, tablas, endpoints:** `references/arquitectura.md`
- **Qué hace el Kit gratis y PRO, el modelo de acceso y el panel:** `references/kit-y-pro.md`
- **Operación (SQL para pegar, Cloudflare, caché, pruebas locales, problemas conocidos):** `references/operacion.md`
- **Qué está publicado y qué sigue (piloto, pendientes):** `references/estado-y-pendientes.md`. Actualizalo cuando publiques algo importante.
