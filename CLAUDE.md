# Relab

Recursos gratuitos de ST Relaciones Públicas (Stella Torres) en https://relab.strelacionespublicas.com.ar. La dueña no programa: explicale en español rioplatense, claro y sin jerga, y dale pasos concretos cuando tenga que tocar algún panel.

## Estructura
- Un solo sitio Vite + React en Cloudflare Pages (proyecto `relab`, `relab-6su.pages.dev`). Cada push a `main` se publica solo.
- `/` → vitrina (`index.html`, `src/hub.jsx`). La lista de tarjetas está en `src/resources.jsx`.
- `/<recurso>/` → cada recurso en su carpeta con su `index.html` y su `.jsx`. Hoy: `textoenredes/` (`src/App.jsx`, `src/RichEditor.jsx`, `src/lib/core.js`).
- `/privacidad/` → política de privacidad (`src/privacidad.jsx`). Google la exige para el login.
- `functions/api/` → backend compartido (Pages Functions). `server/lib.js` tiene sesión, cookies y validación.
- D1 `relab` (binding `DB`): una sola cuenta para todos los recursos. Tablas en `migrations/`.
- Login con Google (OAuth + PKCE): `functions/api/auth/`. El login vuelve al recurso desde el que se entró (`?return=`).
- Design system ST: `src/ds/` (tokens, fuentes Karla e Inter, `Button`, `Switch`, `Logo`). Pie común: `src/Footer.jsx`. Diseño original de referencia en `project/` y `chats/`.

## Sumar un recurso
Casi siempre llega como handoff de Claude Design. Leé su README y los chats antes de empezar.

**Página simple (no guarda datos):**
1. `nombre/index.html` (copiá `textoenredes/index.html`) apuntando a `src/nombre.jsx`.
2. Agregalo en `vite.config.js`, en `build.rollupOptions.input`.
3. Importá los tokens de `src/ds/tokens/*.css` y `src/app.css`, y usá `Logo`, `Footer` y los componentes de `src/ds/`. La cabecera es petróleo, con logo ST y el nombre del recurso, más "un recurso relab" con link a `/`.
4. Sumá la tarjeta en `src/resources.jsx`.

**Herramienta con cuenta (guarda avances):** lo anterior, más:
- Una migración nueva `migrations/000N_<recurso>.sql`. Las tablas llevan `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`.
- Los endpoints en `functions/api/<recurso>/`, usando `requireUser`, `readJson`, `validId`, `validText` y `json` de `server/lib.js`. Mirá `functions/api/drafts/` como ejemplo.
- Que `/api/me` no crezca sin control: cada recurso trae sus propios datos desde sus endpoints.
- Actualizar `src/privacidad.jsx` (qué se guarda) y la fecha.
- **Producción:** Stella no usa la terminal. Pasale el SQL de la migración para que lo pegue en Cloudflare → D1 `relab` → Consola, junto con `INSERT INTO d1_migrations (name) VALUES ('000N_<recurso>.sql');`.

## Cómo publicar
- Nunca directo a `main`: primero una rama. Cloudflare la publica en `https://<rama>.relab-6su.pages.dev`, y Stella la prueba en el celular. El login no funciona en esas direcciones, y es normal.
- Con su OK, fast-forward a `main`.
- Antes de publicar, probá con `npm run build` y Playwright (Chromium en `/opt/pw-browsers/chromium`), en escritorio y con viewport de celular.

## No tocar
- `GOOGLE_CLIENT_SECRET` vive solo en el panel de Cloudflare, como Secreto. Nunca va en el repo ni en el chat.
- **Privacidad:** el contenido de los usuarios (texto en curso, borradores, grupos de hashtags y cualquier dato nuevo que escriban) se guarda cifrado con `encryptText`/`decryptText` de `server/crypto.js`. La clave es el Secreto `TEXT_KEY` (solo en Cloudflare y en el gestor de contraseñas de Stella). Sin la clave, guardar devuelve 503 `config` y nunca se escribe en texto plano. Stella no quiere poder leer lo que escriben: no agregues pantallas, exports ni logs con ese contenido. Nombre y email sí son visibles (login).
- `GOOGLE_CLIENT_ID` y `database_id` están en `wrangler.toml` a propósito: con `[vars]` en el archivo, Cloudflare ignora las variables de texto del panel.
- Una dirección nueva para el login (otro dominio) hay que agregarla en Google Cloud → Google Auth Platform → Clientes → "Relab web" → URIs de redireccionamiento.
- TextoRedes: el texto se guarda y se copia como Unicode con formato. `RichEditor` solo cambia cómo se ve. No cambies `applyStyle`, `REV` ni `styleChar` sin probar que el texto copiado sigue igual.
