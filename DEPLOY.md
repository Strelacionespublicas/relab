# Relab — cómo publicarlo en tu dominio

Relab es un solo sitio con la vitrina en la raíz y un recurso por carpeta:

- `https://relab.strelacionespublicas.com.ar/` → vitrina de recursos
- `https://relab.strelacionespublicas.com.ar/textoenredes/` → TextoRedes

Una sola cuenta (login con Google) sirve para todos los recursos. El día que compres `relab.com.ar`, cambiás el dominio en Cloudflare y en Google (pasos 1 y 3) y listo.

Todo corre en Cloudflare, en el plan gratuito:

- **Cloudflare Pages**: sirve la vitrina y los recursos (React + Vite, carpeta `src/`).
- **Pages Functions** (`functions/api/`): login con Google y guardado.
- **D1** (base de datos SQLite de Cloudflare): cuentas, texto en curso, borradores y grupos de hashtags.

Sin cuenta, la herramienta funciona igual. El login es opcional.

---

## 1. Credenciales de Google (una sola vez)

1. Entrá a <https://console.cloud.google.com/> y creá un proyecto, por ejemplo "Relab".
2. **APIs y servicios → Pantalla de consentimiento de OAuth**
   - Tipo de usuario: **Externo**.
   - Nombre de la app: Relab. Email de soporte: el tuyo.
   - Permisos: dejá solo los básicos (`email`, `profile`, `openid`). Así Google no pide verificación.
   - Al final, tocá **Publicar app** para que pueda entrar cualquier cuenta y no solo las de prueba.
3. **Credenciales → Crear credenciales → ID de cliente de OAuth**
   - Tipo: **Aplicación web**.
   - **URIs de redireccionamiento autorizados** (agregá las tres):
     - `https://relab.strelacionespublicas.com.ar/api/auth/callback`
     - `https://relab-6su.pages.dev/api/auth/callback`
     - `http://localhost:8788/api/auth/callback` (para probar en tu compu)
4. Guardá el **ID de cliente** y el **Secreto del cliente**.

## 2. Base de datos y proyecto en Cloudflare

Desde la carpeta del proyecto, con Node 20 o más nuevo:

```bash
npm install
npx wrangler login                      # abre el navegador para entrar a Cloudflare
npx wrangler d1 create relab            # copiá el database_id que devuelve
```

Pegá ese `database_id` en `wrangler.toml`, en lugar de `REEMPLAZAR_CON_EL_ID_DE_D1`. Después:

```bash
npm run db:migrate                                     # crea las tablas
npx wrangler pages project create relab --production-branch main
npx wrangler pages secret put GOOGLE_CLIENT_ID --project-name relab
npx wrangler pages secret put GOOGLE_CLIENT_SECRET --project-name relab
npm run deploy
```

Ya queda funcionando en `https://relab-6su.pages.dev`.

## 3. Tu dominio

En el panel de Cloudflare: **Workers & Pages → relab → Custom domains → Set up a custom domain** → `relab.strelacionespublicas.com.ar`.

- Si el DNS del dominio ya está en Cloudflare, se configura solo.
- Si está en otro proveedor (por ejemplo NIC Argentina con DNS de tu hosting), creá allá un registro **CNAME** `relab` → `relab-6su.pages.dev`. Cloudflare te muestra el dato exacto.

## 4. Limitar quién puede crear cuenta (opcional)

Hoy puede ingresar cualquier persona con Google (la cuenta sirve para guardar avance, hashtags y textos). Si algún día querés limitarlo, completá `ALLOWED_EMAILS` en `wrangler.toml` y volvé a publicar:

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

## Sumar un recurso nuevo

1. Creá la carpeta `nuevorecurso/` con su `index.html` (copiá el de `textoenredes/`) apuntando a su propio `.jsx`.
2. Agregala en `vite.config.js`, en `input`.
3. Sumala a `RESOURCES` en `src/hub.jsx` para que aparezca en la vitrina.
4. Si necesita guardar datos, agregá una migración en `migrations/` y sus endpoints en `functions/api/`. La cuenta ya es la misma.

## Probar en local

```bash
cp .dev.vars.example .dev.vars     # y completá las credenciales de Google
npm run db:migrate:local
npm run preview                    # http://localhost:8788 (vitrina) y /textoenredes/, con login y base local
```

Para trabajar solo el diseño, con recarga en vivo: `npm run dev`. Sin el backend corriendo, la herramienta funciona en modo "sin cuenta".

## Dónde está cada cosa

| Carpeta | Qué tiene |
|---|---|
| `index.html`, `src/hub.jsx` | La vitrina de Relab (lista de recursos) |
| `textoenredes/index.html`, `src/App.jsx` | TextoRedes |
| `src/Footer.jsx` | Pie común a todo Relab |
| `src/lib/core.js` | Formato Unicode, redes, emojis, plantillas y reglas de hashtags |
| `src/ds/` | Tokens, fuentes y componentes del design system ST |
| `functions/api/` | Endpoints: login, sesión, texto en curso, borradores y hashtags |
| `migrations/` | Estructura de la base D1 |
| `project/`, `chats/` | Diseño original exportado de Claude Design (referencia) |
