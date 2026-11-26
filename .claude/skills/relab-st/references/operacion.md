# Operación de Relab

## Migración nueva en producción (la pega Stella)
1. Escribí `migrations/000N_<nombre>.sql` (solo `CREATE TABLE` o `CREATE INDEX`, aditiva). Probala en local (`npx wrangler d1 execute relab --local --file migrations/000N_….sql`) y en las pruebas de Vitest, que cargan todas las migraciones sobre `node:sqlite`.
2. Para ella, armá un bloque **en el chat, listo para copiar**, con una línea por sentencia:
   ```sql
   CREATE TABLE IF NOT EXISTS … ;
   CREATE INDEX IF NOT EXISTS … ;
   INSERT INTO d1_migrations (name) SELECT '000N_nombre.sql' WHERE NOT EXISTS (SELECT 1 FROM d1_migrations WHERE name = '000N_nombre.sql');
   ```
3. **Sus pasos:**
   1. anotar la hora;
   2. Cloudflare → Almacenamiento y base de datos → D1 → `relab` → **Consola**;
   3. pegar todo y tocar Ejecutar;
   4. mandar captura.

   Para confirmar que quedó: `SELECT name FROM sqlite_master WHERE type='table' AND name IN (…);`.
4. Si pega un fragmento cortado y aparece "syntax error at offset 0", no se ejecutó nada. Pasale el bloque de nuevo, dentro de un recuadro de código.
5. El código nuevo tiene que funcionar aunque la migración todavía no esté aplicada. Por ejemplo, `getEntitlement` devuelve null si falta la tabla.

## Cloudflare
- **Secretos:** proyecto `relab` → Ajustes → Variables y secretos → Agregar → tipo **Secreto**, en Producción. Se toman en el próximo despliegue.
- **Versión vieja en el celular:** lo más probable es la caché de la zona `strelacionespublicas.com.ar`.
  - Arreglo: sitio strelacionespublicas.com.ar → Caching → Configuration → **Purge Everything**.
  - Revisar Caching → Cache Rules, por si hay una regla que alcance a `relab.`.
  - Desde que existe `version.json`, el sitio muestra solo el aviso "Hay una versión nueva · Actualizar".
- **Time Travel (D1):** vuelve la base a un momento anterior (hasta 30 días en el plan pago, 7 en el gratis). Es destructivo: solo ante un problema grave, y con ella.
- **Confirmar un despliegue:** `gh api repos/Strelacionespublicas/relab/commits/<sha>/check-runs --jq '.check_runs[] | select(.name=="Cloudflare Pages") | .status + " " + (.conclusion // "")'`.

## Pruebas locales
- **`npm test` (Vitest):** los handlers de `functions/` se prueban con su código real, sobre un adaptador de D1 en `node:sqlite` (ver `tests/unit/state-api.test.js` y `pro-*.test.js`). El `batch` del adaptador tiene que ser transaccional (BEGIN/COMMIT) para poder probar cupos y canjes simultáneos.
- **Servidor local:** `npm run build` y después `npx wrangler pages dev dist --port 8788 --binding TEXT_KEY=<clave de prueba> --binding ADMIN_EMAILS=<email de prueba>`, en segundo plano. Se corta solo al llegar a su tiempo máximo: hay que volver a levantarlo. La base local está en `.wrangler/`; si falta una tabla, `wrangler d1 execute relab --local --file migrations/000N…`.
- **Sesiones de prueba:** insertar en `sessions` el SHA-256 de un token (`tokE`, `tokF`, …) para usuarios de prueba, y usar la cookie `relab_session=<token>` en Playwright.
- **Playwright:** `require('playwright')`, Chromium en `/opt/pw-browsers/chromium`, viewport de 390×844 para celular.
- Las pruebas de navegador que cambian datos tienen que **dejar el estado listo al empezar** (borrar sus filas de prueba), para no depender del orden en que se corren.
- En Vitest, no nombrar `it` a una variable auxiliar dentro de un `describe`: tapa el `it` de Vitest y las pruebas no corren ("No test found in suite").

## Problemas conocidos
- El login con Google **no funciona en las vistas previas** de Cloudflare. Lo de PRO se prueba en local o en producción (oculto para el resto si hace falta).
- Desde el entorno remoto de Claude no se puede abrir el sitio publicado, porque el proxy lo bloquea. La verificación final la hace Stella en el celular.
- `gh repo clone` puede fallar (GraphQL no disponible): clonar con `git clone --depth 1 https://github.com/Strelacionespublicas/relab`.
- Los heredocs con SQL dentro de comandos largos pueden quedar bloqueados por el chequeo de seguridad. Escribir los scripts con la herramienta de archivos y ejecutarlos aparte.
