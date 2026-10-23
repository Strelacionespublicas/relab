# TextoRedes — cómo publicarlo en tu dominio

Todo corre en Cloudflare, en el plan gratuito:

- **Cloudflare Pages**: sirve la herramienta (React + Vite, carpeta `src/`).
- **Pages Functions** (`functions/api/`): login con Google y guardado.
- **D1** (base de datos SQLite de Cloudflare): cuentas, texto en curso, borradores y grupos de hashtags.

Sin cuenta, la herramienta funciona igual. El login es opcional.

En esta guía uso `textoredes.strelacionespublicas.com.ar` como ejemplo. Cambialo por el subdominio que elijas.

---

## 1. Credenciales de Google (una sola vez)

1. Entrá a <https://console.cloud.google.com/> y creá un proyecto, por ejemplo "TextoRedes".
2. **APIs y servicios → Pantalla de consentimiento de OAuth**
   - Tipo de usuario: **Externo**.
   - Nombre de la app: TextoRedes. Email de soporte: el tuyo.
   - Permisos: dejá solo los básicos (`email`, `profile`, `openid`). Así Google no pide verificación.
   - Al final, tocá **Publicar app** para que pueda entrar cualquier cuenta y no solo las de prueba.
3. **Credenciales → Crear credenciales → ID de cliente de OAuth**
   - Tipo: **Aplicación web**.
   - **URIs de redireccionamiento autorizados** (agregá las tres):
     - `https://textoredes.strelacionespublicas.com.ar/api/auth/callback`
     - `https://textoredes.pages.dev/api/auth/callback`
     - `http://localhost:8788/api/auth/callback` (para probar en tu compu)
4. Guardá el **ID de cliente** y el **Secreto del cliente**.

## 2. Base de datos y proyecto en Cloudflare

Desde la carpeta del proyecto, con Node 20 o más nuevo:

```bash
npm install
npx wrangler login                      # abre el navegador para entrar a Cloudflare
npx wrangler d1 create textoredes       # copiá el database_id que devuelve
```

Pegá ese `database_id` en `wrangler.toml`, en lugar de `REEMPLAZAR_CON_EL_ID_DE_D1`. Después:

```bash
npm run db:migrate                                     # crea las tablas
npx wrangler pages project create textoredes --production-branch main
npx wrangler pages secret put GOOGLE_CLIENT_ID --project-name textoredes
npx wrangler pages secret put GOOGLE_CLIENT_SECRET --project-name textoredes
npm run deploy
```

Ya queda funcionando en `https://textoredes.pages.dev`.

## 3. Tu dominio

En el panel de Cloudflare: **Workers & Pages → textoredes → Custom domains → Set up a custom domain** → `textoredes.strelacionespublicas.com.ar`.

- Si el DNS del dominio ya está en Cloudflare, se configura solo.
- Si está en otro proveedor (por ejemplo NIC Argentina con DNS de tu hosting), creá allá un registro **CNAME** `textoredes` → `textoredes.pages.dev`. Cloudflare te muestra el dato exacto.

## 4. Limitar quién puede crear cuenta (opcional)

El pie dice "Herramienta de uso exclusivo". Si querés que solo entren ciertas personas, completá `ALLOWED_EMAILS` en `wrangler.toml` y volvé a publicar:

```toml
ALLOWED_EMAILS = "@strelacionespublicas.com.ar, cliente@gmail.com"
```

Un valor que empieza con `@` habilita todo ese dominio. Vacío = cualquier cuenta de Google. Esto limita el login, no el uso de la herramienta sin cuenta.

## 5. Publicar cambios

```bash
npm run deploy
```

Para que se publique solo con cada cambio, conectá el repo de GitHub en **Workers & Pages → Create → Pages → Connect to Git**. Build command: `npm run build`. Output: `dist`. Después, en **Settings**, cargá la base D1 (binding `DB`) y las variables `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`.

---

## Probar en local

```bash
cp .dev.vars.example .dev.vars     # y completá las credenciales de Google
npm run db:migrate:local
npm run preview                    # http://localhost:8788 con login y base local
```

Para trabajar solo el diseño, con recarga en vivo: `npm run dev`. Sin el backend corriendo, la herramienta funciona en modo "sin cuenta".

## Dónde está cada cosa

| Carpeta | Qué tiene |
|---|---|
| `src/App.jsx` | La interfaz completa de TextoRedes |
| `src/lib/core.js` | Formato Unicode, redes, emojis, plantillas y reglas de hashtags |
| `src/ds/` | Tokens, fuentes y componentes del design system ST |
| `functions/api/` | Endpoints: login, sesión, texto en curso, borradores y hashtags |
| `migrations/` | Estructura de la base D1 |
| `project/`, `chats/` | Diseño original exportado de Claude Design (referencia) |
