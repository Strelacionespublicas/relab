# Arquitectura de datos · Kit Feriante PRO

*Diseño para aprobar, sin implementar. **Ninguna migración se ejecuta sin tu aprobación explícita.** Rama `docs/suscripciones-kit-pro`, noviembre de 2026.*

## 1. Punto de partida: esquema actual de D1 (`relab`)
Revisado en `migrations/0001–0003`:
| Tabla | Contenido | Cifrado |
|---|---|---|
| `users` | id (el `sub` de Google), email, nombre, foto, texto en curso de TextoEnRedes | El texto, sí |
| `sessions` | hash del token, usuario, vencimiento | — |
| `drafts`, `tag_sets` | Borradores y hashtags de TextoEnRedes | Sí |
| `resource_state` | **Un JSON por persona y recurso**: el Kit gratis (`kit-feriante`), el Cyber Monday y la guía. `updated_at` funciona como versión (Corrección 3). | Sí (AES-GCM con `TEXT_KEY`) |

**Regla vigente que respeto:** el contenido de las personas se guarda **cifrado** y vos no podés leerlo. El panel de administración no muestra contenido de nadie.

**Por qué el JSON actual no sirve para PRO:**
- tiene un tope de 100.000 caracteres (unas 1.080 ventas);
- se reescribe entero en cada cambio;
- no permite descontar stock de forma segura;
- mezclaría datos de muchas ferias en un solo bloque.

**El estado gratis `kit-feriante` no se toca:** sigue igual y las 7 herramientas gratis siguen usándolo.

## 2. Principios del diseño PRO
1. **Tablas por entidad:** ferias, productos, variantes, ventas y movimientos de stock. Una fila por registro, no un JSON gigante.
2. **Cifrado por fila.** En claro solo quedan los datos técnicos que se necesitan para relacionar y sincronizar: ids, cuenta, feria, producto, fecha, versión y borrado. El contenido (nombres, ubicaciones, precios, costos, cantidades, descuentos, notas) va en una columna `data` cifrada, con el mismo esquema de `server/crypto.js`.
3. **Aislamiento entre cuentas:**
   - todas las claves primarias son `(user_id, id)`;
   - **cada consulta filtra por el `user_id` de la sesión del servidor**, nunca por un dato que mande el navegador;
   - una prueba automática intenta leer y escribir datos de otra cuenta y tiene que fallar.
4. **Ids estables creados en el dispositivo** (UUID). Un reintento no duplica: `INSERT … ON CONFLICT DO NOTHING` y operaciones idempotentes.
5. **Stock como libro de movimientos**, no como un número que se pisa:
   - cada venta, edición, reposición o ajuste agrega un movimiento;
   - el stock actual es la suma de los movimientos;
   - así no hay "descuentos perdidos" cuando dos dispositivos venden a la vez.
6. **La venta y su movimiento de stock se guardan juntos**, en una transacción (`DB.batch`): o se guardan los dos o ninguno.
7. **Ediciones con versión:** cada fila tiene `version`. Una edición lleva la versión leída y, si cambió, el servidor responde 409, igual que en la Corrección 3.
8. **Borrado suave:** `deleted_at`. Nada se borra físicamente al instante, y se puede recuperar durante 30 días (ver respaldo).
9. **Las migraciones son aditivas:** solo `CREATE TABLE` e índices. No hay `ALTER` destructivos ni se tocan datos existentes.

## 3. Licencias y permisos (migración `0004_pro_acceso.sql`)
| Tabla | Columnas | Notas |
|---|---|---|
| `entitlements` | `user_id`, `id`, `product` (`kit-feriante-pro`), `source` (`trial` / `trial_code` / `subscription` / `manual`), `starts_at`, `ends_at`, `status` (`active` / `revoked`), `ref` (id de la suscripción o del código), `created_at` | **La única fuente de "¿tiene PRO?"**: PRO = hay un permiso `active` con `starts_at ≤ ahora < ends_at` |
| `trial_codes` | `id`, `code_hash` (SHA-256 del código en mayúsculas), `label`, `product`, `days` (90), `redeem_until`, `max_uses`, `uses`, `active`, `created_at` | El código en texto solo se ve al crearlo, en el panel |
| `redemptions` | `user_id`, `product`, `kind` (`general` / `code`), `code_id`, `at` · único `(user_id, product, kind)` en `general`, y `(user_id, code_id)` en `code` | Una prueba general por persona; un mismo código no se canjea dos veces |
| `admin_audit` | `id`, `admin_user_id`, `action`, `target`, `at` | Registro de lo que se hace en el panel, sin contenido de usuarios |

**Canje sin pasarse del cupo.** El canje va en una sola sentencia, así que dos canjes simultáneos no superan `max_uses`:
`UPDATE trial_codes SET uses = uses + 1 WHERE id = ? AND active = 1 AND uses < max_uses AND redeem_until > ? RETURNING …`
Si la sentencia afecta una fila, se insertan en el mismo `batch` el `redemption` y el `entitlement`.

**Quién es admin:** una lista de emails en la variable `ADMIN_EMAILS` de Cloudflare (por ejemplo, el tuyo). El servidor la compara con la sesión. El panel solo administra **códigos y planes**; nunca muestra ferias, productos ni ventas de nadie.

**Facturación** (Etapa 4, migración `0006_billing.sql`, se diseña y aprueba entonces):
- `subscriptions`, `billing_events` (idempotencia de webhooks) y `checkouts`, según `ARQUITECTURA_WOOCOMMERCE_RELAB.md`;
- con una columna `billing_source` (`mercadopago` / `woocommerce`), así los permisos no dependen de qué variante de cobro se elija.

## 4. Datos PRO (migración `0005_pro_datos.sql`)
Todas las tablas tienen:
- `user_id`, `id` (UUID del dispositivo), `version` (entero, sube en cada cambio), `created_at`, `updated_at`, `deleted_at`;
- `data` (cifrado, con el contenido);
- `PRIMARY KEY (user_id, id)` y un índice por `(user_id, updated_at)` para sincronizar.

| Tabla | Columnas en claro, además de las comunes | Contenido cifrado en `data` |
|---|---|---|
| `pro_ferias` | — | nombre, ubicación, fecha de inicio y fin, gastos (lista de concepto y monto), notas |
| `pro_productos` | — | nombre, categoría, costo, precio, stock mínimo para la alerta, activo |
| `pro_variantes` | `producto_id` | nombre de la variante (por ejemplo talle o color) y costo o precio propios si difieren |
| `pro_ventas` | `feria_id`, `fecha` (día, `YYYY-MM-DD`) | ítems (producto, variante, cantidad, precio unitario, descuento), medio de pago, comisión aplicada, total, notas |
| `pro_stock_mov` | `producto_id`, `variante_id`, `feria_id`, `venta_id` (si viene de una venta), `tipo` (`inicial` / `venta` / `reposicion` / `ajuste` / `anulacion`) | cantidad (con signo), motivo |
| `pro_config` | — (una fila por cuenta) | feria activa, tasas de comisión por medio de pago, preferencias |
| `pro_cambios` | `user_id`, `seq` (contador por cuenta) | — | Cursor de sincronización: cada escritura suma una fila `(tabla, id, version)` para que otro dispositivo pida "lo que cambió desde `seq`" |

**Por qué cantidad y stock van cifrados.** Así se respeta "no ver datos de usuarios". El precio a pagar es que el stock y los totales los calcula el servidor después de descifrar, o el dispositivo. Con los volúmenes de una persona feriante (cientos o miles de filas) es inmediato.

## 5. Operaciones y reglas de consistencia
| Operación | Cómo se guarda | Qué evita |
|---|---|---|
| **Nueva venta** | `batch`: `INSERT pro_ventas … ON CONFLICT DO NOTHING`, más un `INSERT pro_stock_mov` (tipo `venta`, cantidad negativa) por ítem, con id derivado de la venta y el ítem, más `pro_cambios` | Un reintento no duplica la venta ni el descuento: los ids son fijos |
| **Editar venta** | `UPDATE … WHERE version = ?` (409 si cambió), más movimientos de **anulación** de los ítems anteriores y **venta** de los nuevos, en el mismo `batch` | Stock coherente aunque cambie la cantidad o el producto |
| **Borrar venta** | `deleted_at`, más movimientos de anulación | Devuelve el stock; se puede deshacer |
| **Reposición o ajuste** | `INSERT pro_stock_mov` | El historial completo queda auditable |
| **Stock actual** | Suma de los movimientos no borrados, por producto, variante y feria (o global) | Sin números pisados |
| **Alerta de stock bajo** | Stock actual ≤ el stock mínimo del producto | — |
| **Ingresos y comisiones** | Calculados con las funciones puras de `src/kit/calc.js` (con pruebas): total = Σ (precio × cantidad − descuento); comisión = total × tasa del medio de pago | Lectura de importes argentinos, ya probada |
| **Venta sin stock** | Se permite (en una feria no se frena una venta) y se marca el stock negativo con un aviso | No se pierde la venta |

**Sin conexión:** igual que el kit gratis.
- Las operaciones PRO quedan en una **cola local con dueño**: la clave lleva la huella de la cuenta, como `relab-kit-feriante:v2`.
- Se envían en lote cuando vuelve la red (`POST /api/pro/ops`). El servidor aplica cada operación de forma idempotente y devuelve el resultado de cada una.
- Al cerrar sesión con operaciones pendientes, se resguardan igual que en la Corrección 2.

## 6. API PRO (Pages Functions, siempre con sesión)
| Endpoint | Permiso | Qué hace |
|---|---|---|
| `GET /api/pro/me` | Sesión | Plan, fuente, vencimiento, `pro: true/false`, y si las acciones están habilitadas o solo la lectura |
| `POST /api/pro/trial` | Sesión | Activa la prueba de 30 días, una sola vez |
| `POST /api/pro/redeem` | Sesión | Canjea un código de 90 días (fecha, cupo, sin repetir) |
| `GET /api/pro/sync?since=seq` | Sesión (con o sin PRO) | Devuelve los cambios propios. **Leer siempre se puede.** |
| `POST /api/pro/ops` | **PRO vigente** | Crear y editar ferias, productos, ventas y stock. Sin PRO: 403 `pro_required`, sin escribir nada. |
| `GET /api/pro/export` | Sesión (con o sin PRO) | Todos los datos PRO propios en JSON o CSV |
| `GET/POST /api/admin/codes` | Admin | Listar, crear y desactivar códigos (cantidad de usos, sin datos de quién los usó) |

**Al vencer PRO:** las herramientas gratis siguen igual. Lo PRO queda **visible y exportable**, y **solo** se bloquea crear y editar. Al reactivarse, vuelve la edición. **Nada se borra.**

## 7. Compatibilidad con los registros existentes
- `resource_state` (el Kit gratis, Cyber y la guía) **no cambia**: misma forma, mismo cifrado y mismas pruebas.
- **Importar ventas gratis a una feria PRO** (opcional, a pedido de la persona): copia las ventas del tracker gratis a `pro_ventas`, con id derivado del id original. Así no se duplica si se repite, y **el original gratis queda intacto**.
- Las 123 pruebas actuales tienen que seguir en verde.
- `functions/api/account.js` ("Borrar mi cuenta") se amplía para borrar también las tablas PRO de esa persona.

## 8. Respaldo y recuperación
| Nivel | Mecanismo | Cubre |
|---|---|---|
| Base completa | **D1 Time Travel**: restaurar a cualquier minuto de los últimos **30 días en el plan pago** de Workers, o **7 días en el gratis** (⏳ confirmar en el panel cuál tenés). Ojo: la restauración es destructiva, pero devuelve un marcador para deshacerla. | Error grave o migración fallida |
| Antes de cada migración | Anotar el marcador de Time Travel (`wrangler d1 time-travel info`) y exportar la base (`wrangler d1 export`). El contenido queda cifrado en la copia. | Volver atrás exactamente al estado previo |
| Por registro | Borrado suave con "Papelera" de 30 días para ferias, productos y ventas | Errores de la persona |
| Por persona | "Exportar mis datos PRO" (JSON/CSV) desde la app | Copia propia; también al vencer PRO |
| Clave de cifrado | `TEXT_KEY` guardada en Cloudflare y en tu gestor de contraseñas (ya vigente) | **Sin esa clave, los datos cifrados no se pueden recuperar** |
| Copia periódica (opcional, Etapa 5) | Exportación semanal a R2 con un Worker programado | Más allá de la ventana de Time Travel |

[Fuente: D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)

## 9. Migraciones a aprobar
| Migración | Qué crea | Etapa | Destructiva |
|---|---|---|---|
| `0004_pro_acceso.sql` | `entitlements`, `trial_codes`, `redemptions`, `admin_audit` e índices | 2 | No |
| `0005_pro_datos.sql` | `pro_ferias`, `pro_productos`, `pro_variantes`, `pro_ventas`, `pro_stock_mov`, `pro_config`, `pro_cambios` e índices | 3 | No |
| `0006_billing.sql` | `subscriptions`, `billing_events`, `checkouts` | 4 | No |

**Procedimiento para cada una:**
1. Revisión del SQL con vos.
2. Prueba en la base local.
3. Marcador de Time Travel y exportación.
4. `wrangler d1 migrations apply relab --remote`, **con tu OK**.
5. Verificación.

## 10. Riesgos
1. **Si se pierde `TEXT_KEY`, los datos PRO quedan ilegibles,** igual que hoy. La mitigación ya existe: la clave está guardada en tu gestor de contraseñas.
2. **Con los datos cifrados no hay consultas SQL sobre contenido** (sumas o filtros por producto). Las estadísticas se calculan en el servidor o en el dispositivo después de descifrar. Con los volúmenes esperados alcanza, y se revisa en la Etapa 5.
3. **Stock negativo:** ventas simultáneas sin stock suficiente quedan registradas con aviso. Es una decisión de producto, porque no se frena una venta en la feria.
4. **La cola sin conexión** puede crecer si alguien usa PRO muchos días sin red. El tope local es amplio, con un aviso.
5. **El plan de Cloudflare** define si Time Travel guarda 7 o 30 días (⏳).
