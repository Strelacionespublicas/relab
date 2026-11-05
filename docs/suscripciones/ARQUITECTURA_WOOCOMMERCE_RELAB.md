# Arquitectura · Suscripciones de Kit Feriante PRO (WooCommerce + RELAB + Mercado Pago)

*Versión 2. Es una propuesta para aprobar: no hay nada implementado, instalado ni cobrado. Criterio de Stella:*
- ***WooCommerce es el sistema comercial;***
- ***RELAB gestiona el acceso y el uso;***
- ***el login es con Google.***

## 1. Lo que condiciona el diseño (verificado)
| Hecho | Estado | Consecuencia |
|---|---|---|
| El plugin oficial de Mercado Pago **no funciona con WooCommerce Subscriptions** | ✅ [Ayuda MP 36053](https://www.mercadopago.com.ar/ayuda/36053) | Con los plugins actuales, WooCommerce **no puede** renovar solo en ARS |
| El plugin oficial de MP no tiene suscripciones propias | ✅ Foro oficial y reseña de 2025 | Lo mismo |
| **Payway:** débito automático por archivos TXT por lotes | ✅ | No es un cobro automático por API: requiere operación mensual |
| **GoCuotas:** cuotas de una compra, no suscripción | 🟡 | Sirve solo para un plan anual pagado de una vez, sin renovación |
| **La API de Suscripciones de Mercado Pago** cobra sola en ARS, con webhooks firmados y cancelación por API | ✅ | Es la única vía oficial para la renovación automática |

**Extensiones posibles**, si se quisiera que WooCommerce cobre la renovación (sin instalar nada):
- **WooCommerce Subscriptions**: ✅ USD 279/año. Necesita una pasarela compatible, que hoy no existe en forma oficial para MP.
- **Cujiware MercadoPago Tools Pro** (pago, de terceros): dice ser compatible con WCS. 🟡 Sin verificar.
- **Inobarix Recurring Payments for Mercado Pago** (gratis, de terceros): usa la API de suscripciones de MP. 🟡 Joven, y sin documentación sobre cancelaciones.
- **YITH Subscription**: renovación automática solo con Stripe o PayPal. ❌ Descartada para ARS.

## 2. Dos variantes que respetan "WooCommerce = sistema comercial"
| | **H. Híbrida (recomendada)** | **W. Todo en WooCommerce** |
|---|---|---|
| Página de producto, precios y condiciones | WooCommerce | WooCommerce |
| Clientes y pedidos (registro comercial, facturación, "Mis pedidos") | **WooCommerce**: RELAB crea un pedido en Woo por cada cobro aprobado, por la REST API | WooCommerce |
| Quién cobra la renovación | Mercado Pago Suscripciones (API oficial), iniciada desde RELAB | WCS + un plugin de terceros |
| Plugins nuevos | **Ninguno** | WCS (USD 279/año) + Cujiware o Inobarix |
| Permiso PRO | RELAB, con aviso directo de MP | RELAB, con aviso de Woo (puente firmado) |
| Puntos de falla en el camino del dinero | MP → RELAB | MP → plugin de terceros → WCS → puente → RELAB |
| Riesgo | Medio: es código propio, con pruebas y sandbox | Alto: una actualización de un plugin no oficial puede cortar renovaciones |

**Recomiendo H.** WooCommerce sigue siendo el sistema comercial (vidriera, clientes, pedidos, contabilidad), sin poner un plugin no oficial en el medio del cobro. **W** queda como alternativa si en la auditoría de WordPress aparece algo que la haga viable: por ejemplo, que Cujiware esté probado con WCS en tu versión.

**El código de RELAB no depende de la variante.** Los permisos se calculan igual y solo cambia de dónde viene el aviso: `billing_source` = `mercadopago` o `woocommerce`.

## 3. Reparto de responsabilidades (variante H)
| Pieza | Hace | No hace |
|---|---|---|
| **WooCommerce** | Página "Kit Feriante PRO"; registra **clientes y pedidos** (uno por cobro, con número de suscripción); base para la facturación; enlace "Gestionar mi suscripción" en Mi cuenta | No cobra la renovación ni decide quién tiene PRO |
| **Mercado Pago** | Planes mensual, anual y promocional (`preapproval_plan`); primer cobro y renovaciones; reintentos; avisos firmados | No sabe de cuentas RELAB, salvo el `external_reference` |
| **RELAB** | Login con Google; pruebas de 30 y 90 días; **permisos**; checkout; webhook; "Mi suscripción" (estado, próximo cobro, **cancelar**); panel de administración de códigos; alta de pedidos en Woo | No guarda tarjetas ni datos de pago |
| **Worker con Cron** | Conciliación diaria con MP y con Woo; vencimiento de pruebas; reintento de pedidos Woo pendientes | — |

## 4. Diagrama (variante H)
```
 WooCommerce (strelacionespublicas.com.ar)            RELAB (relab.strelacionespublicas.com.ar)
 ┌────────────────────────────────┐                   ┌─────────────────────────────────────────┐
 │ Página "Kit Feriante PRO"       │── "Contratar" ───▶│ /pro  · login con Google · elige plan    │
 │ Mi cuenta → Mis pedidos         │                   │ POST /api/billing/checkout ──┐           │
 │ Pedidos (uno por cobro) ◀───────┼── REST API ───────│ D1: entitlements · subscriptions ·      │
 └────────────────────────────────┘   (clave propia)   │     checkouts · billing_events ·        │
                                                      │     trial_codes · redemptions           │
                                                      │ POST /api/billing/webhook ◀──┐           │
                                                      │ POST /api/billing/cancel ────┼──┐        │
                                                      └──────────────────────────────┼──┼───────┘
                         crea preapproval (external_reference = checkout) ───────────▼  │
                      ┌──────────────────────────────────────────────────────────────┴──┴──┐
                      │ Mercado Pago · Suscripciones: cobros recurrentes · webhooks firmados │
                      └─────────────────────────────────────────────────────────────────────┘
          Cron diario (Worker): concilia MP ↔ D1 ↔ pedidos de Woo, y vence pruebas
```

## 5. Vinculación segura de cuentas
1. **La contratación empieza siempre en RELAB, con sesión de Google.** El botón de WooCommerce lleva a `/pro`, y si no hay sesión, pide el login primero.
2. RELAB crea un **checkout** con un id aleatorio, **de un solo uso, con vencimiento** (2 h) y atado al `user_id` de la sesión del servidor.
3. Ese id viaja como `external_reference` a Mercado Pago y vuelve en cada aviso. Así se sabe **qué cuenta RELAB** contrató, aunque el pagador use otro email.
4. **Nunca se activa PRO por coincidencia de email,** ni por la vuelta del navegador.
5. **Cliente de WooCommerce:** RELAB crea o reutiliza el cliente en Woo con el email de Google de la cuenta RELAB. Es solo un registro comercial, no un permiso, y guarda el `relab_user_id` como metadato.
6. **Si llega un pago con referencia desconocida o ya usada**, queda "huérfano" en `billing_events` y no activa nada.

*Variante W:* el id del checkout viaja en el link al carrito de Woo y se guarda en el pedido. El webhook de Woo, firmado con `X-WC-Webhook-Signature`, lo devuelve, y RELAB confirma el estado por la REST API.

## 6. Activación, renovación, cancelación y reembolso
| Evento | Cómo se entera RELAB | Qué hace |
|---|---|---|
| **Primer pago aprobado** | Webhook `subscription_preapproval` / `subscription_authorized_payment`. Se verifica la firma y **se consulta la API de MP** (nunca se confía en el contenido del aviso). | Comprueba checkout, plan y monto → crea `subscription` → **permiso PRO hasta el fin del período** → crea el pedido en Woo (estado completado, con el id de pago de MP) |
| **Renovación aprobada** | `subscription_authorized_payment`, verificado | Extiende `ends_at` desde la fecha del pago (no "sumando 30 días") → nuevo pedido en Woo |
| **Renovación rechazada** | Aviso y Cron | PRO sigue hasta `ends_at` más una gracia de 3 días (configurable). Aviso "actualizá tu medio de pago". Si no se cobra, pasa a modo lectura. |
| **Cancelación del cliente** | Botón **Cancelar** en RELAB → `PUT /preapproval/{id}` `status: canceled`. También si cancela desde su cuenta de MP (llega el aviso). | **Sin cobros nuevos desde ese momento.** PRO hasta el fin del período pagado; después, modo lectura. Nota en el último pedido de Woo. |
| **Reembolso o contracargo** | Aviso de MP verificado (el reembolso lo hacés desde MP) | Termina el permiso en el momento → pedido Woo "Reembolsado" |
| **Cambio de plan** | Desde "Mi suscripción" | Se cancela el actual al fin del período y el nuevo arranca después: sin cobros dobles |

**La vuelta del navegador** (`/pro/gracias`) **no activa nada**: muestra "Confirmando tu pago…" y consulta el estado hasta verlo activo.

**Si falla el alta del pedido en Woo**, el permiso PRO **no se demora**. El pedido queda pendiente y el Cron lo reintenta.

## 7. Permisos en el servidor
- `GET /api/pro/me` → `{ pro, plan, source, ends_at, next_payment_date, cancel_at_period_end, readOnly }`.
- **Cada escritura PRO** pasa por `requirePro(user)` en el servidor. Si no hay PRO, responde 403 `pro_required` y no escribe nada.
- **La lectura y la exportación de los datos propios no requieren PRO**: ver la conservación de datos en `MODELO_FREEMIUM_KIT_PRO.md`.
- Las herramientas gratis no pasan por este control.

## 8. Panel de administración mínimo
- **Acceso:** solo los emails de la variable `ADMIN_EMAILS` de Cloudflare, comprobados contra la sesión del servidor.
- **Qué hace:**
  - crear códigos de prueba (días, fecha límite de canje, cupo, etiqueta como "Charla feriantes nov");
  - desactivar códigos;
  - ver usos (cantidad, sin nombres).
- **Más adelante:** configurar los días de la prueba general, ver suscripciones (estado y fechas, sin contenido) y resolver huérfanos.
- **Lo que nunca muestra:** ferias, productos, ventas ni ningún contenido de las personas.
- Cada acción queda en `admin_audit`.

## 9. Seguridad
| Tema | Medida |
|---|---|
| Webhooks de MP | Firma HMAC-SHA256 de `x-signature` (`ts`, `v1`) con `data.id`, `x-request-id` y `ts`. Se rechaza si `ts` tiene más de 5 minutos. ✅ Documentado. ⏳ El formato exacto se confirma en sandbox. |
| Estado real | Siempre por la API (`GET /preapproval/{id}`, `/authorized_payments/{id}`) |
| Idempotencia | `billing_events.id` único: un aviso repetido no extiende dos veces. Los pedidos de Woo llevan el id de pago de MP para no duplicarse. |
| Credenciales | `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, y `WC_KEY`/`WC_SECRET` (una clave REST de Woo **solo con permiso para pedidos y clientes**). Todas como Secretos de Cloudflare, cargados por vos, nunca en el repo ni en el chat. |
| Tarjetas | Nunca pasan por RELAB ni por Woo: las maneja Mercado Pago |
| Entornos | Una aplicación de prueba de MP y una base D1 de prueba para las vistas previas. Producción solo en `main`. |
| Minimización | En D1: `user_id`, `preapproval_id`, plan, estado y fechas. En Woo: lo necesario para facturar. Hay que actualizar la Política de privacidad. |

## 10. Lo que falta de WordPress para cerrar (sin contraseñas ni claves)
1. "Salud del sitio → Información" copiado: versiones de WP, PHP y WooCommerce, y los plugins activos.
2. Captura de **Plugins instalados**.
3. Captura de **WooCommerce → Ajustes → Pagos**: si Payway y GoCuotas están como plugins, y sus versiones.
4. Si HPOS (almacenamiento de pedidos de alto rendimiento) está activo.
5. Si en tu panel de MP aparece **Suscripciones** y si tenés una aplicación en **Tus integraciones**.
6. Cómo facturás hoy (ARCA): a mano o con un plugin. Define si el pedido de Woo dispara la factura.
7. Si permitís crear una **clave REST de WooCommerce** con permisos limitados, a cargar vos en Cloudflare (en la Etapa 4).
