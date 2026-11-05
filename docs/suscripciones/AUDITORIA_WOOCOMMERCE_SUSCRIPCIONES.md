# Auditoría · WooCommerce y suscripciones automáticas para Kit Feriante PRO

*Etapa 1: solo auditoría e investigación. No se instaló, configuró ni compró nada, y no se modificó WooCommerce ni RELAB. Noviembre de 2026.*

**Cómo leer este documento**
- ✅ **Verificado:** dato tomado de una fuente oficial (Mercado Pago, WooCommerce, YITH, Payway) a través del buscador. Desde este entorno no se pueden abrir esas páginas directamente, así que conviene confirmarlo en el navegador antes de decidir.
- 🟡 **Terceros:** dato de blogs o comparadores, no oficial.
- ⏳ **Pendiente:** no se pudo confirmar.

## 1. Estado de la instalación de WordPress / WooCommerce
**No verificado: no hay acceso.** Desde este entorno no hay acceso al panel de WordPress. Además, el sitio publicado (`strelacionespublicas.com.ar`) no se puede abrir desde acá, porque la red de esta sesión no lo permite. No invento resultados.

**Lo que se sabe por el trabajo anterior sobre el sitio** (no reverificado hoy):
| Pieza | Dato conocido |
|---|---|
| Hosting | Hostinger, con LiteSpeed Cache y CDN |
| Tema | Tema de bloques propio `st-rp` |
| Tienda | WooCommerce, con compra solo con cuenta (sin invitados) |
| Pagos | Plugin oficial **Mercado Pago payments for WooCommerce** en modo **Checkout Pro** (ARS). **WooCommerce PayPal Payments** para USD. |
| Cursos | Plugin propio **ST Campus** |
| Correo | WP Mail SMTP |

Payway y GoCuotas figuran en tu pedido como medios disponibles, pero no sé si están instalados como plugins en WooCommerce.

**Qué necesito para completar la auditoría** (capturas o texto copiado; **sin contraseñas ni claves**):
1. **Herramientas → Salud del sitio → Información → "Copiar la información del sitio al portapapeles"**, pegada en un mensaje. Trae las versiones de WordPress, PHP, WooCommerce, la base de datos y los plugins activos. Se pueden borrar las líneas con rutas o emails.
2. **Plugins → Plugins instalados**: una captura de la lista completa, con versiones y cuáles están activos.
3. **WooCommerce → Ajustes → Pagos**: una captura con los medios activos (Mercado Pago, Payway, GoCuotas, PayPal).
4. **WooCommerce → Ajustes → Avanzado → Funciones**: si está activado el "Almacenamiento de pedidos de alto rendimiento" (HPOS).
5. **Mercado Pago, en tu panel de vendedor**:
   - si te aparece **Herramientas para vender → Suscripciones**;
   - si tenés creada una aplicación en **Tus integraciones**, solo el nombre.
6. **Payway**: si tu contrato incluye **Débito automático**, y si usás el plugin de Payway para WooCommerce, con su versión.
7. **GoCuotas**: si está integrado por plugin o por link de pago.
8. **Facturación**: cómo emitís hoy las facturas (ARCA/AFIP), a mano o con algún plugin o sistema.

## 2. Compatibilidad comprobada (documentación)
| Pregunta | Resultado | Fuente |
|---|---|---|
| ¿El plugin oficial de Mercado Pago funciona con **WooCommerce Subscriptions**? | ✅ **No.** La ayuda oficial de Mercado Pago Argentina dice que por ahora no se puede usar esa solución de WooCommerce con Mercado Pago, y recomienda Checkout Pro o Checkout API. | [Ayuda MP 36053](https://www.mercadopago.com.ar/ayuda/36053) |
| ¿El plugin oficial de Mercado Pago tiene suscripciones propias? | ✅ No de forma nativa: lo dijo el autor en el foro oficial, en una respuesta de hace casi 3 años. Una reseña de junio de 2025 dice que sigue sin funcionar con suscripciones. | [Foro WordPress.org](https://wordpress.org/support/topic/mercadopago-suscripciones/) · [Ficha en WooCommerce](https://woocommerce.com/products/mercado-pago-checkout/) |
| ¿Mercado Pago tiene suscripciones propias (cobro automático)? | ✅ **Sí.** API de Suscripciones (`preapproval`, con o sin plan): cobros automáticos en ARS con tarjeta de crédito, débito o dinero en cuenta, frecuencia en `days` o `months`, prueba gratis opcional, cancelación con `status: canceled` y notificaciones por webhook. | [Docs Suscripciones](https://www.mercadopago.com.ar/developers/es/docs/subscriptions) · [Con plan](https://www.mercadopago.com.ar/developers/en/docs/subscriptions/integration-configuration/subscription-associated-plan) · [Sin plan, pago autorizado](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/integration-configuration/subscription-no-associated-plan/authorized-payments) · [Gestión](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/subscription-management) · [Referencia GET preapproval](https://www.mercadopago.com.ar/developers/es/reference/online-payments/subscriptions/get-preapproval/get) |
| ¿Webhooks de Mercado Pago autenticables? | ✅ Sí. Firma HMAC-SHA256 en el header `x-signature` (`ts` y `v1`), con `x-request-id`, `data.id` y una clave secreta por aplicación. Tópicos de suscripciones: `subscription_preapproval`, `subscription_authorized_payment` y `subscription_preapproval_plan`. | [Webhooks Suscripciones](https://www.mercadopago.com.co/developers/es/docs/subscriptions/additional-content/your-integrations/notifications/webhooks) · [Webhooks Checkout Pro](https://www.mercadopago.com.mx/developers/es/docs/checkout-pro-orders/resources/notifications/webhooks) |
| **WooCommerce Subscriptions**: precio y requisitos | ✅ USD 279 por año (ficha oficial). La renovación automática requiere una pasarela compatible; si no hay, la renovación es manual. | [Ficha oficial](https://woocommerce.com/products/woocommerce-subscriptions/) |
| **YITH WooCommerce Subscription**: renovación automática | ✅ Solo con PayPal Standard, Stripe (plugins de YITH o WooCommerce Stripe) o YITH Account Funds. Las demás pasarelas renuevan **a mano**. Premium: USD 199,99 por año. | [Página oficial YITH](https://yithemes.com/themes/plugins/yith-woocommerce-subscription/) |
| ¿Stripe para un comercio argentino? | 🟡 No abre cuentas a negocios con base en Argentina; la vía habitual es una LLC en EE. UU., con cobro en USD. | [Global66](https://www.global66.com/blog/stripe-argentina/) · [LupaPago](https://lupapago.com/mercado-pago-vs-stripe/) |
| ¿PayPal cobra en ARS? | 🟡 No se encontró que liquide en pesos a cuentas argentinas. En tu sitio ya se usa para USD. | [Metaloide](https://metaloide.net/blog/vender-productos-digitales-argentina/) |
| **Payway**: ¿cobros recurrentes? | ✅ Tiene **Débito automático** para suscripciones y membresías. El comercio presenta los débitos con **archivos TXT por marca de tarjeta** desde Mi Payway: es un proceso por lotes, no un cobro en línea por API. No se encontró una API de tokenización para cobros recurrentes ni soporte de suscripciones en su plugin de WooCommerce (⏳). | [Débito automático Payway](https://www.payway.com.ar/debito-automatico) · [Ayuda Payway](https://ayuda.payway.com.ar/cobros/medios-de-pago/debito-automatico) · [Portal developers](https://developers.payway.com.ar/catalog?category=Pagos) |
| **GoCuotas**: ¿suscripciones? | 🟡 **No.** Es "comprá ahora, pagá después" con débito: 2 a 4 cuotas sin interés, la primera en el momento y el resto a 30, 60 y 90 días. **Son cuotas, no suscripción recurrente.** Mínimo $2.000 por venta. | [Tiendanube · GOcuotas](https://www.tiendanube.com/blog/gocuotas-que-es) · [Ayuda Tiendanube](https://ayuda.tiendanube.com/es_AR/gocuotas/preguntas-frecuentes-sobre-gocuotas) |
| Plugins de terceros con suscripciones de Mercado Pago | 🟡 **Inobarix Recurring Payments for Mercado Pago** (gratis, WordPress.org): usa la API de suscripciones de MP sin WooCommerce Subscriptions, con webhook propio y sincronización por cron. Es joven (versión 0.9 a 1.0 según la ficha). **Cujiware MercadoPago Tools Pro** (pago): dice ser compatible con WooCommerce Subscriptions. Ninguno es oficial. | [Inobarix](https://wordpress.org/plugins/inobarix-recurring-payments-for-mercado-pago/) · [xpay.sh](https://www.xpay.sh/directory/woocommerce/plugins/inobarix-recurring-payments-for-mercado-pago/) · [Cujiware](https://cujiware.com/plugins/all/woocommerce/mercadopago-para-woocommerce) |

**Pendiente de confirmar en la documentación oficial o en sandbox:**
- ⏳ **Plan anual en Mercado Pago:** que acepte `frequency: 12` con `frequency_type: months`. La documentación muestra `days`/`months` y ejemplos mensuales, pero no confirma el tope.
- ⏳ **Cuenta de Mercado Pago para suscribirse:** si es obligatoria en el flujo con redirección (`init_point`). Fuentes de terceros indican que sí, y que con tarjeta tokenizada no.
- ⏳ **Cambio de tarjeta y de monto** de una suscripción existente: la API tiene `PUT /preapproval/{id}`, pero falta confirmar qué campos acepta.
- ⏳ **Política de reintentos** de Mercado Pago ante una renovación rechazada (cuántos intentos y cada cuánto).
- ⏳ **Comisiones vigentes** de suscripciones en Argentina: no hay una tabla oficial específica en los resultados. Ver en tu panel de MP o en la página de costos.
- ⏳ **Payway:** si existe una API de tokenización para cobros recurrentes con tarjeta (consultar a Payway).

## 3. Riesgos y limitaciones detectados
1. **WooCommerce Subscriptions + Mercado Pago no tiene soporte oficial.** Usarlos juntos depende de un plugin de terceros pago y de dos licencias, y tiene el riesgo de que una actualización rompa las renovaciones.
2. **Con YITH, la renovación automática es solo con Stripe o PayPal:** no sirve para ARS. Con Mercado Pago las renovaciones serían manuales, que es justo lo que no querés.
3. **El débito automático de Payway es un proceso manual por lotes** (TXT mensual): no escala para un SaaS y requiere operación todos los meses.
4. **GoCuotas no cobra en forma recurrente:** solo sirve para cuotas de una compra única, por ejemplo un plan anual en cuotas, y eso no renueva solo.
5. **Plugins de terceros con suscripciones de MP:** un solo desarrollador, versiones jóvenes y sin respaldo de Mercado Pago. El riesgo de mantenimiento es alto para cobros.
6. **Doble fuente de verdad.** Si las suscripciones viven en WordPress y los permisos en RELAB, hace falta un puente WordPress → RELAB firmado y conciliación. Hay más puntos de falla.
7. **Requisitos legales argentinos** para servicios contratados online. Hay que revisarlos con asesoría antes de vender:
   - el **botón de baja**, para cancelar por el mismo medio y con la misma facilidad con que se contrató;
   - el **botón de arrepentimiento**, que permite revocar la compra dentro de los 10 días.

   ⏳ No se verificó la normativa vigente en esta etapa.
8. **Facturación electrónica (ARCA)**: ni Mercado Pago ni RELAB emiten facturas. Hay que definir cómo se factura cada cobro recurrente (⏳).

## 4. Información pendiente (resumen)
- Los 8 datos de la sección 1, para cerrar la auditoría de tu instalación.
- Las 6 confirmaciones técnicas marcadas con ⏳ en la sección 2, que se resuelven en sandbox de Mercado Pago y con consultas a Payway.
- **Decisiones comerciales:**
  - qué funciones son **PRO** y cuáles quedan gratis en el Kit (hoy todo es gratis);
  - la política de cancelación (fin del período pagado) y de reembolsos;
  - la facturación;
  - los precios finales.
