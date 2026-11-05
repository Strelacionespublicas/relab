# Arquitectura · Suscripciones de Kit Feriante PRO (WooCommerce + RELAB + Mercado Pago)

*Propuesta para aprobar. No hay nada implementado. Recomendación: **alternativa D** de la comparativa, con las suscripciones en la API oficial de Mercado Pago, controladas desde RELAB, y WooCommerce como vidriera. Al final hay un anexo con la variante centrada en WooCommerce, por si la preferís.*

## 1. Reparto de responsabilidades
Tu pedido original ponía las suscripciones en WooCommerce. Lo cambio por un motivo verificado: **Mercado Pago no soporta WooCommerce Subscriptions con su plugin oficial**, y las otras pasarelas no cobran ARS en forma recurrente (ver la auditoría). Así queda:

| Pieza | Hace | No hace |
|---|---|---|
| **WooCommerce** (strelacionespublicas.com.ar) | Vidriera: la página de producto "Kit Feriante PRO" con planes, precios y condiciones, y botones que llevan a RELAB. Sigue vendiendo cursos y productos únicos como hoy. | No cobra la suscripción ni guarda su estado |
| **Mercado Pago (Suscripciones)** | Planes mensual, anual y anual promocional (`preapproval_plan`); autorización y cobros automáticos; reintentos de cobro; cancelación; avisos por webhook | No decide quién tiene PRO |
| **RELAB** (Cloudflare Pages + Functions + D1) | Login con Google; pruebas gratis de 30 y 90 días; **permisos PRO**; panel "Mi suscripción" (estado, próximo cobro, cancelar, cambiar plan); recibe y verifica los webhooks; conciliación periódica | No guarda tarjetas ni datos de pago |
| **Worker con Cron** (Cloudflare) | Conciliación diaria con Mercado Pago y vencimiento de pruebas | — |

**La misma pieza sirve para otros productos de RELAB:** cada uno tiene su id (`kit-feriante-pro`, …) y sus planes.

## 2. Diagrama de integración
```
  strelacionespublicas.com.ar (WooCommerce)          relab.strelacionespublicas.com.ar (RELAB)
  ┌──────────────────────────────┐                   ┌──────────────────────────────────────────┐
  │ Página "Kit Feriante PRO"     │──── botón ───────▶│ /pro  (elige plan; login con Google)      │
  │ (planes, precios, condiciones)│                   │   POST /api/billing/checkout ─┐           │
  └──────────────────────────────┘                   │                               │           │
                                                     │   D1: users · entitlements ·   │           │
                                                     │       subscriptions · events · │           │
                                                     │       trial_codes · redemptions│           │
                                                     │   POST /api/billing/webhook ◀──┼──┐        │
                                                     │   GET  /api/billing/me         │  │        │
                                                     │   POST /api/billing/cancel ────┼──┼──┐     │
                                                     └───────────────────────────────┼──┼──┼─────┘
                                                                                     │  │  │
                                     crea preapproval (external_reference) ──────────▼  │  │
                                   ┌─────────────────────────────────────────────────────┴──┴──┐
                                   │ Mercado Pago · API Suscripciones (preapproval / plan)      │
                                   │ checkout de la suscripción · cobros recurrentes · webhooks │
                                   └────────────────────────────────────────────────────────────┘
       Cron diario (Worker) ── GET /preapproval/search · /authorized_payments ──▶ concilia D1
```

## 3. Modelo de datos (RELAB, D1)
Tablas nuevas, con una **migración aditiva** que solo crea tablas: no toca ni borra nada. Se aplica recién con tu aprobación.
| Tabla | Campos principales | Para qué |
|---|---|---|
| `entitlements` | `user_id`, `product`, `source` (`trial`, `trial_code`, `subscription`), `starts_at`, `ends_at`, `status` | **La única fuente de "¿tiene PRO?"**: PRO = existe un permiso vigente (`now` entre `starts_at` y `ends_at`, y `status` activo) |
| `subscriptions` | `id`, `user_id`, `product`, `plan`, `mp_preapproval_id` (único), `status` (`pending`, `authorized`, `paused`, `cancelled`), `next_payment_date`, `current_period_end`, `cancel_at_period_end`, `updated_at` | Espejo de lo que dice Mercado Pago, con lo mínimo necesario |
| `checkouts` | `id` (aleatorio), `user_id`, `product`, `plan`, `created_at`, `expires_at`, `used_at` | **Vincula la compra con la cuenta RELAB** (ver sección 5) |
| `billing_events` | `id` (de MP o derivado), `topic`, `resource_id`, `received_at`, `processed_at`, `result` | **Idempotencia y registro**: cada evento se procesa una sola vez |
| `trial_codes` | `code_hash`, `product`, `days` (ej. 90), `redeem_until`, `max_uses`, `uses`, `label` | Códigos para capacitaciones |
| `redemptions` | `user_id`, `product`, `kind` (`general`, `code`), `code_hash`, `at` | Una prueba general por persona y producto; los canjes de código, con su límite |

**Lo que no se guarda:** ningún dato de tarjeta. Tampoco el email del pagador de Mercado Pago, salvo que haga falta para soporte (⏳ decidir). El vínculo con MP es el `preapproval_id`.

## 4. Flujo de compra
1. La persona entra a **RELAB → Kit Feriante PRO** y, si no lo hizo, inicia sesión con Google. Puede llegar desde la página de WooCommerce o desde el kit.
2. Elige un plan: mensual, anual, o anual promocional si tiene el código de la capacitación.
3. RELAB (`POST /api/billing/checkout`) crea un `checkout` con un id aleatorio y crea la suscripción en Mercado Pago:
   - con `preapproval_plan_id` del plan;
   - con `external_reference` = id del checkout;
   - con `back_url` = `/pro/gracias`.

   Después redirige al checkout de Mercado Pago (`init_point`).
4. En Mercado Pago, la persona autoriza la suscripción y se hace el **primer cobro**. ⏳ Hay que confirmar en sandbox si exige cuenta de MP.
5. Mercado Pago avisa por **webhook** (`subscription_preapproval` y `subscription_authorized_payment`).
6. RELAB **verifica la firma**, **consulta el recurso a la API** de MP (nunca confía en el contenido del aviso) y comprueba que:
   - el `external_reference` corresponde a un checkout válido y no usado;
   - el plan y el monto coinciden.

   Si todo coincide, crea o actualiza `subscriptions` y el **permiso PRO** hasta el fin del período pagado.
7. **La vuelta del navegador** (`/pro/gracias`) **no activa nada**: muestra "Confirmando tu pago…" y consulta `/api/billing/me` cada pocos segundos hasta ver PRO activo, o avisa que puede tardar.

## 5. Vinculación de cuentas (sin depender del email)
- La compra **empieza siempre dentro de RELAB, con sesión iniciada.** El id de usuario sale de la sesión del servidor, no de un parámetro.
- Cada checkout tiene un id **aleatorio, de un solo uso y con vencimiento** (por ejemplo, 2 horas). Viaja como `external_reference` a Mercado Pago y vuelve en la suscripción. Así se sabe **qué cuenta RELAB** inició la compra, aunque el pagador use otro email en Mercado Pago.
- **Nunca** se activa PRO por coincidencia de email.
- Si llegara un pago con un `external_reference` desconocido o ya usado, se registra en `billing_events` como "huérfano" y no se activa nada. Lo resolvés desde el panel de soporte.

## 6. Flujo de renovación
1. Mercado Pago cobra solo en cada período (mensual o anual).
2. Llega `subscription_authorized_payment`. RELAB verifica, consulta `GET /authorized_payments/{id}`, y si el pago está **aprobado** extiende `entitlements.ends_at` hasta el nuevo fin de período y guarda `next_payment_date`.
3. **Renovación rechazada:** Mercado Pago reintenta según su política (⏳ confirmar cuántos intentos y cada cuánto).
   - Mientras tanto RELAB mantiene PRO hasta `ends_at`, más un margen de gracia configurable (por ejemplo, 3 días).
   - Si al final del margen no hubo cobro aprobado, PRO vence solo.
   - RELAB avisa en el panel: "No pudimos cobrar tu suscripción: actualizá tu medio de pago".
4. **Cambio de tarjeta:** desde la cuenta de Mercado Pago de la persona o desde un botón en RELAB, si la API lo permite (⏳ `PUT /preapproval/{id}`).

## 7. Flujo de cancelación
1. En **RELAB → Mi suscripción → Cancelar**, se pide una confirmación simple (botón de baja, ⏳ revisión legal).
2. RELAB llama `PUT /preapproval/{id}` con `status: canceled`. **Desde ese momento no hay nuevos cobros.**
3. PRO se mantiene **hasta el fin del período ya pagado** (`cancel_at_period_end`) y después vence solo.
4. Si la persona cancela desde Mercado Pago, llega el webhook y RELAB hace lo mismo.
5. **Reembolsos** (por ejemplo, el botón de arrepentimiento dentro de los 10 días, ⏳ revisión legal): lo hacés desde Mercado Pago. El aviso de reembolso o contracargo termina el permiso en el momento.
6. **Cambio de plan** (mensual ↔ anual): se cancela el actual al fin del período y se crea uno nuevo que arranca cuando termina el anterior. Así no hay cobros dobles ni prorrateos complicados.

## 8. Pruebas gratuitas (sin tarjeta ni cobro)
- **General, 30 días:** botón "Probar PRO gratis 30 días" en RELAB, una vez por persona y producto (`redemptions`). Crea un permiso `trial` de 30 días. No crea nada en Mercado Pago.
- **Capacitaciones, 90 días:** la persona ingresa un código.
  - RELAB valida el código (se guarda solo su hash), la fecha límite de canje (`redeem_until`) y los usos (`uses < max_uses`, incrementado en la misma sentencia para que no se pase del cupo).
  - Si todo está bien, crea un permiso `trial_code` de 90 días.
- **Al vencer:** PRO se apaga solo. Unos días antes, RELAB muestra "Tu prueba termina el …: elegí un plan para seguir". Nunca cobra.
- **Si contrata durante la prueba:** la suscripción empieza en ese momento. ⏳ Decisión comercial: también se podría usar el `free_trial` de Mercado Pago para que el primer cobro sea al terminar la prueba.

## 9. Permisos PRO en las herramientas
- `GET /api/billing/me` → `{ pro: true/false, source, ends_at, plan, next_payment_date, cancel_at_period_end }`.
- El Kit consulta eso al iniciar sesión y muestra u oculta las funciones PRO. ⏳ Falta definir cuáles son PRO.
- **El permiso se comprueba también en el servidor** en cualquier endpoint que guarde datos PRO: no alcanza con ocultar botones.
- **Sin conexión:** se usa el último permiso conocido hasta su `ends_at`. Nunca se extiende en el dispositivo.

## 10. Seguridad
| Tema | Medida |
|---|---|
| Autenticación de webhooks | Firma HMAC-SHA256 de `x-signature` (`ts`, `v1`) sobre `data.id`, `x-request-id` y `ts`, con la clave secreta de la aplicación. Se rechaza si no coincide o si `ts` es viejo (por ejemplo, más de 5 minutos). ✅ Documentado por MP. ⏳ Armado exacto del manifest a confirmar. |
| Verificación de estado | El aviso se usa solo para saber **qué** cambió. El estado real se lee siempre con `GET /preapproval/{id}` o `/authorized_payments/{id}` con el token del servidor. |
| Credenciales | `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET` solo como **Secretos de Cloudflare**, igual que `GOOGLE_CLIENT_SECRET` y `TEXT_KEY`. Nunca en el repo ni en el chat. Nunca llegan al navegador. |
| Idempotencia | `billing_events.id` es único y el `INSERT` marca "procesando". Un aviso repetido no vuelve a activar ni a extender. Las extensiones se calculan desde la fecha del pago, no "sumando 30 días" cada vez. |
| Registro de eventos | `billing_events` guarda tópico, recurso, resultado y error, sin datos personales ni de tarjeta. Retención limitada (⏳, por ejemplo 12 meses). |
| Reintentos | Mercado Pago reintenta los avisos que no recibieron 200. RELAB responde 200 recién después de registrar el evento. Si falla el procesamiento, el Cron lo retoma. |
| Conciliación | Worker con Cron diario: recorre suscripciones activas, compara con `GET /preapproval/search` y corrige `subscriptions`/`entitlements`. También vence pruebas. Lo que encuentra se registra. |
| Entornos | **Aplicación de prueba de Mercado Pago**, con credenciales y usuarios de prueba, en las vistas previas de Cloudflare. **Producción** solo en `main`. Base D1 separada para pruebas (⏳ crear `relab-test`). |
| Cloudflare | Pages Functions para el webhook y la API. Un Worker aparte con **Cron Triggers** para la conciliación, porque Pages no tiene cron. La URL del webhook no depende de cookies: queda fuera del chequeo de Origin del middleware y valida su propia firma. |
| Minimización de datos | Solo `user_id` de RELAB, `preapproval_id`, plan, estado y fechas. Sin tarjetas, sin DNI y sin el email del pagador salvo decisión explícita. Hay que actualizar la **Política de privacidad**. |
| Fraude o abuso de pruebas | Una prueba general por cuenta; códigos con hash, fecha y cupo; límite de pedidos de canje por cuenta. |

## 11. Manejo de errores
| Situación | Qué pasa |
|---|---|
| **Pago rechazado** en el primer cobro | No se activa PRO. `/pro/gracias` muestra "El pago no se aprobó" y permite reintentar con otro medio. |
| **Renovación fallida** | PRO hasta `ends_at` + gracia; aviso en el panel; vence solo si no se cobra. |
| **Cambio de tarjeta** | En la cuenta de MP, o desde RELAB si la API lo permite (⏳). |
| **Cancelación** | Sin nuevos cobros desde la confirmación; PRO hasta el fin del período. |
| **Reembolso o contracargo** | El permiso termina al recibir el aviso, verificado con la API. |
| **Cambio de plan** | El actual se cancela al fin del período y el nuevo arranca después. |
| **El webhook no llega o falla** | Mercado Pago reintenta, y el Cron diario concilia. El panel tiene "Actualizar estado", que consulta a MP en el momento. |
| **Webhook con firma inválida** | Se responde 401 y no se procesa; queda registrado. |
| **Mercado Pago caído** | El checkout muestra un error claro. Los permisos vigentes siguen funcionando. |
| **La persona pagó pero no ve PRO** | Recuperación del acceso: `/api/billing/me` con "Actualizar estado", que consulta a MP por los `preapproval_id` del usuario. Si no se resuelve, soporte busca el `external_reference` en `billing_events`. |
| **Ingresó con otra cuenta de Google** | La compra está atada a la cuenta que la inició. El panel muestra con qué cuenta está activo PRO. Soporte puede mover el permiso tras verificar la identidad (⏳ procedimiento). |

## 12. Recorrido de la persona (resumen)
1. Inicia sesión en RELAB con Google.
2. Abre **Kit Feriante PRO**.
3. Elige mensual o anual.
4. Pasa al checkout de Mercado Pago y autoriza.
5. Paga el primer período.
6. Mercado Pago avisa y RELAB verifica.
7. **PRO se activa solo.**
8. Los cobros siguientes se hacen solos.
9. En **Mi suscripción** ve el plan, el próximo cobro y el botón **Cancelar**.

Tu pedido decía "checkout de WooCommerce" en el paso 4. En esta arquitectura el checkout es de Mercado Pago, que es lo que permite el cobro automático en ARS. WooCommerce queda como la página donde se presenta y se explica el producto.

---

## Anexo · Variante centrada en WooCommerce (no recomendada)
Si preferís que el estado de la suscripción viva en WooCommerce:
1. **Pieza de cobro:**
   - WooCommerce Subscriptions (USD 279/año) más un plugin de terceros que conecte WCS con Mercado Pago (⏳ sin verificar), o
   - un plugin de suscripciones de MP como Inobarix (🟡 joven).
2. **Vinculación:** RELAB genera un **token firmado de un solo uso** (el id de checkout) y lo pasa en el link al checkout de WooCommerce. WooCommerce lo guarda en el pedido.
3. **Puente WooCommerce → RELAB:** un webhook de WooCommerce (pedido pagado, renovación, cancelación, reembolso), firmado con HMAC y verificado en RELAB con `X-WC-Webhook-Signature`. RELAB, además, consulta la REST API de WooCommerce con una clave de solo lectura para confirmar el estado.
4. **Conciliación** diaria contra la REST API de WooCommerce.

**Por qué no la recomiendo:**
- suma dos licencias y un plugin no oficial en el camino del dinero;
- deja dos sistemas que pueden desincronizarse;
- Mercado Pago dice que su plugin no funciona con WooCommerce Subscriptions.
