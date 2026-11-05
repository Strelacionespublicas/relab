# Comparativa · Soluciones de suscripción para Kit Feriante PRO

*Uso las mismas marcas que en la auditoría: ✅ verificado en una fuente oficial (vía buscador), 🟡 terceros, ⏳ pendiente. Los precios están en USD, sin impuestos, según las fichas oficiales a noviembre de 2026. Las comisiones de Mercado Pago no tienen una tabla oficial específica para suscripciones en los resultados: confirmarlas en tu panel.*

**Aclaración clave:** **cuotas no es lo mismo que suscripción.** GoCuotas, o las cuotas de tarjeta de Mercado Pago y Payway, dividen **una compra** en pagos. Una suscripción **cobra de nuevo cada período** con la autorización inicial, sin que la persona vuelva a pagar.

## Tabla comparativa
| | **A. WooCommerce Subscriptions + pasarela** | **B. YITH WooCommerce Subscription + pasarela** | **C. Suscripciones de Mercado Pago desde WooCommerce** (plugin de terceros, ej. Inobarix) | **D. Suscripciones de Mercado Pago desde RELAB** (API directa) ⭐ |
|---|---|---|---|---|
| Instalación | Plugin pago + plugin de pasarela compatible | Plugin pago + pasarela | Plugin gratis en WordPress | Sin plugins: desarrollo en RELAB (Cloudflare) |
| Licencia | ✅ USD 279/año, más ⏳ el precio de la pasarela de terceros (ej. Cujiware Tools Pro) | ✅ USD 199,99/año (Premium) | 🟡 Gratis | Sin licencias |
| Comisiones | Las de la pasarela | Las de la pasarela | ⏳ Las de Mercado Pago | ⏳ Las de Mercado Pago |
| Cobro automático en ARS | ⏳ **No con el plugin oficial de MP** (✅ la ayuda de MP lo descarta). Solo con un plugin de terceros que dice soportarlo, sin verificar. | ❌ Automático solo con Stripe o PayPal (no hay ARS para un comercio argentino). Con MP, renovación **manual**. | 🟡 Sí, porque usa la API de suscripciones de MP | ✅ Sí: la API oficial de suscripciones de MP (`preapproval`) cobra sola |
| Mensual y anual | Sí (WCS) | Sí | ⏳ Según el plugin | ✅ Mensual. ⏳ Anual con `frequency: 12 months`, a confirmar en sandbox |
| Prueba gratis sin tarjeta | WCS tiene pruebas, pero con suscripción y medio de pago | Similar | Según el plugin | Se maneja en RELAB, sin pasar por MP (como pediste) |
| Cancelación | En "Mi cuenta" de WooCommerce. El plugin tiene que cancelar también en la pasarela. | Ídem | ⏳ No documentado | ✅ Desde RELAB (`PUT /preapproval/{id}` con `status: canceled`) y también desde la cuenta de MP del cliente |
| Webhooks / API | WCS tiene hooks y REST; la pasarela, sus propios webhooks | Hooks de WordPress | Webhook local y cron de sincronización | ✅ Webhooks firmados (HMAC) y consulta directa a la API de MP |
| Activación de PRO en RELAB | Necesita un puente firmado WordPress → RELAB y vincular cuentas | Ídem | Ídem | Directa: RELAB recibe el aviso de MP y activa |
| Mantenimiento | Alto: 3 piezas (WCS, pasarela de terceros y puente) con actualizaciones | Alto | Medio-alto: plugin joven de un desarrollador, más el puente | Bajo-medio: un solo integración, con API oficial y versionada |
| Dependencias | WordPress, WooCommerce, WCS, pasarela de terceros y RELAB | WordPress, WooCommerce, YITH y pasarela | WordPress, WooCommerce, el plugin y RELAB | Mercado Pago y RELAB (Cloudflare) |
| Limitaciones | Sin soporte oficial de MP. Dos licencias. | No cumple "cobro automático en ARS" | Sin respaldo oficial; el manejo de cancelaciones no está documentado | Las suscripciones no se ven en el panel de WooCommerce, sino en el de MP y en RELAB. Hay que desarrollar el panel "Mi suscripción". |
| Riesgo técnico | Alto: una actualización puede romper renovaciones de dinero real | — (descartada) | Alto | Medio: es nuestro código, con pruebas y sandbox |

**Payway y GoCuotas**, como pasarelas de suscripción:
- **Payway:** el débito automático (✅) se opera con archivos TXT por lotes desde Mi Payway. No es un cobro en línea por API y no tiene plugin de suscripciones (⏳). No sirve para cobrar solo cada mes sin trabajo manual.
- **GoCuotas:** 🟡 no tiene cobro recurrente.

Los dos pueden seguir como medios de pago de **compras únicas** en WooCommerce, por ejemplo un plan anual pagado de una vez o en cuotas, pero ese plan **no se renueva solo**.

## Ventajas y desventajas
**A. WooCommerce Subscriptions**
- ➕ Es el estándar de WooCommerce, con un panel completo, cambio de plan y pruebas.
- ➖ Mercado Pago dice explícitamente que no funciona con su plugin oficial. Depende de un plugin de terceros pago para el cobro automático, y hacen falta dos licencias más el puente con RELAB.

**B. YITH**
- ➕ Más barato que WCS.
- ➖ Renueva sola solo con Stripe o PayPal, que no cobran ARS para un comercio argentino. **Descartada.**

**C. Plugin de terceros con la API de suscripciones de MP**
- ➕ Gratis y queda dentro de WooCommerce.
- ➖ Es joven y de un solo desarrollador, sin documentación sobre cancelaciones. Requiere el puente firmado con RELAB y la conciliación entre dos sistemas.

**D. Suscripciones de MP desde RELAB** ⭐
- ➕ Usa la API **oficial** de Mercado Pago para cobros recurrentes en ARS.
- ➕ No hay licencias.
- ➕ El permiso PRO vive donde se usa (RELAB), sin puente.
- ➕ La cancelación se hace en un clic desde RELAB.
- ➕ Se reutiliza para otros productos de RELAB.
- ➖ Las suscripciones no aparecen en el panel de WooCommerce. WooCommerce puede seguir como vidriera, con una página de producto que lleva a RELAB.
- ➖ Requiere desarrollar el panel "Mi suscripción" y la conciliación.

## Fuentes oficiales consultadas
- Mercado Pago:
  - [¿Es posible usar WooCommerce Subscriptions con Mercado Pago? (ayuda 36053)](https://www.mercadopago.com.ar/ayuda/36053)
  - [Suscripciones: documentación](https://www.mercadopago.com.ar/developers/es/docs/subscriptions)
  - [Suscripción con plan asociado](https://www.mercadopago.com.ar/developers/en/docs/subscriptions/integration-configuration/subscription-associated-plan)
  - [Sin plan, pago autorizado](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/integration-configuration/subscription-no-associated-plan/authorized-payments)
  - [Sin plan, pago pendiente](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/integration-configuration/subscription-no-associated-plan/pending-payments)
  - [Gestión de suscripciones](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/subscription-management)
  - [Glosario](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/resources/glossary)
  - [Referencia GET /preapproval](https://www.mercadopago.com.ar/developers/es/reference/online-payments/subscriptions/get-preapproval/get)
  - [Webhooks de suscripciones](https://www.mercadopago.com.co/developers/es/docs/subscriptions/additional-content/your-integrations/notifications/webhooks)
  - [Webhooks: validación de firma](https://www.mercadopago.com.mx/developers/es/docs/checkout-pro-orders/resources/notifications/webhooks)
  - [Herramientas para vender: Suscripciones](https://www.mercadopago.com.ar/herramientas-para-vender/suscripciones)
- WooCommerce:
  - [WooCommerce Subscriptions](https://woocommerce.com/products/woocommerce-subscriptions/)
  - [Mercado Pago en el Marketplace](https://woocommerce.com/products/mercado-pago-checkout/)
- YITH: [YITH WooCommerce Subscription](https://yithemes.com/themes/plugins/yith-woocommerce-subscription/)
- Payway:
  - [Débito automático](https://www.payway.com.ar/debito-automatico)
  - [Ayuda: débito automático](https://ayuda.payway.com.ar/cobros/medios-de-pago/debito-automatico)
  - [Soluciones para vender online](https://www.payway.com.ar/soluciones-pago-vender-online)
  - [Portal de desarrolladores](https://developers.payway.com.ar/catalog?category=Pagos)
- WordPress.org:
  - [Foro: MercadoPago + suscripciones](https://wordpress.org/support/topic/mercadopago-suscripciones/)
  - [Plugin Inobarix](https://wordpress.org/plugins/inobarix-recurring-payments-for-mercado-pago/)

**Terceros, usados solo como referencia:**
- [Cujiware Tools Pro](https://cujiware.com/plugins/all/woocommerce/mercadopago-para-woocommerce)
- [xpay.sh: Inobarix](https://www.xpay.sh/directory/woocommerce/plugins/inobarix-recurring-payments-for-mercado-pago/)
- [Tiendanube: GOcuotas](https://www.tiendanube.com/blog/gocuotas-que-es)
- [Global66: Stripe en Argentina](https://www.global66.com/blog/stripe-argentina/)
- [LupaPago](https://lupapago.com/mercado-pago-vs-stripe/)
- [Metaloide](https://metaloide.net/blog/vender-productos-digitales-argentina/)
- [goncy/next-mercadopago (suscripciones)](https://github.com/goncy/next-mercadopago/blob/main/integraciones/suscripciones/README.md)
