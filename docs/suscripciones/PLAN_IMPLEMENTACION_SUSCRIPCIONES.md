# Plan de implementación · Suscripciones de Kit Feriante PRO

*Propuesta para aprobar. No hay nada implementado. La base es la arquitectura recomendada (alternativa D). Cada etapa va en su propia rama, con vista previa, pruebas y tu OK antes de pasar a `main`.*

## Recomendación final
1. **¿Necesitamos instalar un plugin adicional?**
   **No**, con la opción recomendada. Las suscripciones se hacen con la API oficial de Mercado Pago, desde RELAB. WooCommerce sigue con sus plugins actuales y solo suma una página de producto que lleva a RELAB.
2. **¿Cuál es la mejor opción para nuestra instalación?**
   **Suscripciones de Mercado Pago controladas desde RELAB** (alternativa D).
   - Es la única que cobra sola en ARS con una API oficial.
   - No suma licencias.
   - El permiso PRO vive donde se usa.

   *Verificado:* el plugin oficial de MP no funciona con WooCommerce Subscriptions, y YITH solo renueva sola con Stripe o PayPal.
3. **¿Qué pasarela permite cobrar automáticamente todos los meses?**
   - **Mercado Pago Suscripciones** (✅ oficial, ARS, tarjeta de crédito, débito o dinero en cuenta).
   - Payway tiene débito automático, pero por **archivos TXT por lotes**, con trabajo manual cada mes.
   - **GoCuotas no hace cobros recurrentes**: son cuotas de una compra.
4. **¿Podemos ofrecer planes mensuales y anuales?**
   - Mensual: ✅ sí.
   - Anual: muy probable con `frequency: 12, frequency_type: months`. ⏳ Se confirma en sandbox en la Etapa 2 antes de ofrecerlo.
   - El anual promocional es otro plan de Mercado Pago, que solo se ofrece con el código de la capacitación.
5. **¿Cómo se cancela una suscripción?**
   - Desde **RELAB → Mi suscripción → Cancelar** (un clic y una confirmación), o desde la cuenta de Mercado Pago.
   - No hay más cobros desde ese momento.
   - PRO sigue hasta el fin del período ya pagado.
6. **¿Cómo se activa automáticamente PRO en RELAB?**
   - Mercado Pago avisa por webhook firmado.
   - RELAB verifica la firma, consulta el estado real a la API de MP y comprueba que la compra corresponde a la cuenta que la inició.
   - Recién entonces activa PRO hasta el fin del período.
   - La vuelta del navegador desde el pago no activa nada.
7. **¿Cuál es el costo de implementación y mantenimiento?** Ver la sección "Costos estimados". En resumen:
   - **USD 0 en licencias**;
   - Cloudflare dentro del plan gratis con este volumen (⏳ confirmar);
   - las comisiones de Mercado Pago por cobro (⏳ ver tu panel);
   - y unas 50 a 75 horas de desarrollo y pruebas, en etapas.
8. **¿Qué debemos configurar antes de vender?** Ver "Antes de vender", al final.

**Qué es verificado y qué no.** Lo marcado ✅ está en documentación oficial (vía buscador). Lo marcado ⏳ se confirma en la Etapa 2, en el sandbox de Mercado Pago, o con vos:
- plan anual;
- si suscribirse exige cuenta de Mercado Pago;
- cambio de tarjeta y de monto;
- política de reintentos;
- comisiones;
- requisitos legales.

## Etapas
| # | Etapa | Qué incluye | Prioridad | Depende de |
|---|---|---|---|---|
| 0 | **Decisiones** | ~~Qué es PRO~~: resuelto en `MODELO_FREEMIUM_KIT_PRO.md` (todo lo actual sigue gratis); precios finales; condiciones de cancelación y reembolso; textos legales (botón de baja y de arrepentimiento, con asesoría); facturación (ARCA); datos de la auditoría de WordPress | Bloqueante | Vos |
| 1 | **Permisos y pruebas gratis** | Migración aditiva (`entitlements`, `trial_codes`, `redemptions`); `GET /api/billing/me`; prueba de 30 días; canje de códigos de 90 días con fecha y cupo; marca PRO en el Kit y en la vitrina; panel mínimo "Mi plan"; privacidad actualizada. **Sin quitar nada gratis.** | Alta: ya sirve para las capacitaciones, sin cobrar nada | 0 |
| PRO-A | **Base de PRO** | Almacenamiento propio de los módulos PRO (diseño aparte para aprobar, porque cambia el esquema); **Mis productos** y **Mis ferias**; modo lectura y exportación cuando PRO vence | Alta: sin esto PRO no tiene valor | 1 |
| PRO-B | **Mejoras PRO** | Ventas del día (producto del catálogo, cantidad, descuentos, editar, feria, comisión real, cierre de caja); Calculadora (escenarios, comisión por medio, precio sugerido); ROI por feria y comparativo; **Stock** | Alta: hay que tenerla antes de cobrar | PRO-A |
| PRO-C | **Estadísticas e Informes** | Estadísticas avanzadas; informes PDF/Excel por feria y anual | Media: puede salir después del lanzamiento | PRO-B |
| 2 | **Mercado Pago en sandbox** | Aplicación de prueba; planes de prueba; confirmar los ⏳ (anual, cuenta obligatoria, cambio de tarjeta, reintentos, firma); `checkouts`, `subscriptions` y `billing_events`; `POST /api/billing/checkout`; webhook con firma e idempotencia; `/pro/gracias` con espera del estado | Alta | 1, y credenciales de prueba cargadas por vos como Secretos |
| 3 | **Gestión de la suscripción** | Panel "Mi suscripción" con plan, próximo cobro, cancelar, cambiar de plan y actualizar estado; renovaciones, rechazos, gracia, reembolsos y contracargos | Alta | 2 |
| 4 | **Conciliación y soporte** | Worker con Cron diario; registro de eventos con retención; vista de soporte mínima (sin datos personales innecesarios) para casos huérfanos y para mover un permiso | Media | 2 |
| 5 | **Vidriera en WooCommerce** | Página de producto "Kit Feriante PRO" en el tema `st-rp`, con planes, condiciones, preguntas frecuentes y botones a RELAB | Media | 0 (precios y textos) |
| 6 | **Producción** | Aplicación de producción de MP, planes reales, webhook de producción, compra real de bajo monto, monitoreo de la primera semana | — | 1 a 5 y tu OK |

## Costos estimados
| Concepto | Alternativa D (recomendada) | Alternativa A (WCS + pasarela de terceros) |
|---|---|---|
| Licencias | USD 0 | ✅ USD 279/año (WooCommerce Subscriptions), más ⏳ el plugin de pasarela de terceros |
| Infraestructura | Cloudflare Pages, D1 y Workers: dentro del plan gratis con este volumen (⏳ confirmar límites en el panel) | Hosting actual |
| Comisiones por cobro | ⏳ Las de Mercado Pago (ver tu panel o la página de costos). Se suma IVA. | Las de la pasarela, más lo mismo de MP |
| Desarrollo (estimación de horas de trabajo) | Etapa 1: 8–12 h · Etapa 2: 12–18 h · Etapa 3: 8–12 h · Etapa 4: 6–10 h · Etapa 5: 4–6 h · pruebas y producción: 8–12 h. **Total ≈ 46–70 h** | Configuración, puente firmado y conciliación con WooCommerce: 30–50 h, más pruebas de compatibilidad en cada actualización |
| Mantenimiento | Revisar cambios de la API de MP; conciliación automática; seguir las pruebas automáticas | Actualizar 3 plugins con dinero real en juego; riesgo de que una actualización rompa renovaciones |

*Las horas son una estimación de esfuerzo, no un presupuesto: dependen de las decisiones de la Etapa 0 y de lo que se confirme en sandbox.*

## Pruebas necesarias
**Automáticas (Vitest, en el repo):**
- verificación de firma del webhook: válida, inválida y con `ts` vencido;
- idempotencia: el mismo evento dos veces;
- cálculo de períodos: mensual, anual, fin de mes y años bisiestos;
- canje de códigos: fecha, cupo y usos simultáneos;
- una sola prueba general por persona;
- estados de suscripción → permisos;
- cancelación al fin del período;
- renovación rechazada con gracia;
- reembolso;
- conciliación.

**Sandbox de Mercado Pago, con usuarios de prueba:**
- alta mensual y anual;
- primer pago aprobado y rechazado;
- renovación, simulada o con frecuencia en días para probar rápido;
- cancelación desde RELAB y desde MP;
- cambio de tarjeta;
- reembolso;
- webhook caído y recuperado por el Cron.

**En el navegador:** el recorrido completo en celular y computadora; la vuelta desde el pago sin activar antes de tiempo; otra cuenta de Google; sin conexión con PRO vigente.

**Regresión:** las pruebas actuales del Kit (123 automáticas y los e2e).

## Criterios de aceptación
- PRO se activa **solo** con un pago aprobado verificado contra la API, y **nunca** por la vuelta del navegador ni por coincidencia de email.
- La persona contrata una vez y se le cobra sola cada mes o año. Ve el próximo cobro y puede cancelar en un clic.
- Después de cancelar **no hay nuevos cobros**, y PRO dura hasta el fin del período pagado.
- Las pruebas gratis de 30 y 90 días no piden tarjeta, no crean nada en Mercado Pago y vencen solas.
- Los códigos respetan la fecha límite y el cupo, aunque haya canjes simultáneos.
- Un webhook repetido, desordenado o perdido no duplica ni pierde permisos: el Cron corrige en menos de 24 h.
- Ningún dato de tarjeta pasa por RELAB, y las credenciales están solo en Secretos de Cloudflare.
- Prueba y producción están separadas: credenciales, base y URLs de webhook.
- Todas las pruebas automáticas y e2e en verde.

## Estrategia de despliegue
1. Cada etapa en su rama, con vista previa de Cloudflare (credenciales de **prueba**) y tu OK para integrar.
2. **La Etapa 1 puede salir sola** a producción: permisos y pruebas gratis, sin cobros. Así ya podés dar códigos de 90 días en las capacitaciones.
3. **Etapas 2 a 4** en producción con los cobros **apagados** (sin botón de compra visible), hasta terminar el sandbox.
4. **Activación:**
   - credenciales de producción de MP como Secretos;
   - planes reales creados por vos en MP o por la API con tu OK;
   - URL del webhook de producción;
   - **una compra real de bajo monto**, cancelada y reembolsada después.
5. Lanzamiento con monitoreo diario de `billing_events` y de la conciliación durante la primera semana.
6. **Reversión:** apagar el botón de compra (una variable). Los permisos vigentes siguen. Las suscripciones activas se pueden pausar o cancelar desde MP si hiciera falta.

## Antes de vender (lista de configuración)
- [x] Qué es PRO: definido en `MODELO_FREEMIUM_KIT_PRO.md`. Las 7 herramientas actuales siguen gratis.
- [ ] Precios finales y condiciones: cancelación, reembolsos y cambio de plan.
- [ ] Revisión legal: botón de baja, botón de arrepentimiento, términos del servicio y Política de privacidad actualizada.
- [ ] Facturación electrónica de cada cobro (ARCA): cómo y con qué sistema.
- [ ] Cuenta de Mercado Pago de vendedor con Suscripciones habilitadas; **dos aplicaciones** en Tus integraciones (prueba y producción); webhook configurado con los tópicos de suscripciones.
- [ ] Secretos en Cloudflare, cargados por vos: `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET` (prueba en vista previa, producción en `main`).
- [ ] Base D1 de prueba separada.
- [ ] Página de producto en WooCommerce con textos aprobados.
- [ ] Los datos de la auditoría de WordPress (sección 1 de `AUDITORIA_WOOCOMMERCE_SUSCRIPCIONES.md`).
