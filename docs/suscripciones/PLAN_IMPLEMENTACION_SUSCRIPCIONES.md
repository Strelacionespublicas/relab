# Plan de implementación · Kit Feriante PRO

*Versión 2, con el orden de etapas definido por Stella. No hay nada implementado. Cada etapa va en su propia rama, con vista previa, pruebas y tu OK antes de pasar a `main`. **Ninguna migración se ejecuta sin tu aprobación.***

## Etapas
| # | Etapa | Qué incluye | Estimación | Depende de | Sale a producción |
|---|---|---|---|---|---|
| **1** | **Cierre de arquitectura** | Estos 5 documentos; tu aprobación del modelo, de los datos, de la variante H/W y del MVP; datos de WordPress | — | Vos | — |
| **1b** | **Validación con feriantes** (en paralelo con la Etapa 2) | 5 a 8 entrevistas cortas (ver `PLAN_MVP_CHARLA_FERIANTES.md`). Confirma o reordena el MVP antes de programar la Etapa 3. | ~1 semana tuya | 1 | — |
| **En paralelo, desde ya** | **Legal y facturación** | Con tu contador o asesoría: botón de baja, botón de arrepentimiento, términos del servicio, privacidad y facturación ARCA de cada cobro. **No dependen del desarrollo y pueden frenar el lanzamiento si quedan para el final.** | — | Vos | — |
| **2** | **Acceso PRO** | Migración `0004` (permisos, códigos, canjes, auditoría); `requirePro`; `GET /api/pro/me`; prueba de 30 días con botón; canje de códigos de 90 días; **panel de administración mínimo** de códigos; indicador de plan y vencimiento en el Kit; Política de privacidad actualizada | 10–14 h | 1 | **Sí, sola**: no cobra nada y ya permite dar códigos |
| **3** | **MVP** | Migración `0005`; API `/api/pro/sync`, `/ops` y `/export`; **Mis ferias**, **Mis productos**, **Ventas PRO** y **Stock**; cola sin conexión; modo lectura al vencer; importar ventas gratis a una feria (opcional) | 30–45 h | 2 | Sí, para la charla (con códigos de 90 días) |
| **3c** | **Registro en WooCommerce y vidriera de servicios** (fase de lanzamiento gratis) | Producto a $0 con campos extra y consentimiento; email de pedido con el código; sección "Más ayuda para tu emprendimiento" y banner en el ROI | 4–8 h | 2 | Sí, con tu OK para tocar Woo |
| **4a** | ⏸ **POSTERGADA. Comercialización: cobro y acceso** | Migración `0006`; Mercado Pago en sandbox (confirmar los ⏳); checkout; webhook; "Mi suscripción" con cancelar; renovaciones, rechazos, reembolsos; Worker de conciliación; página de producto en Woo con botón a RELAB; compra real de bajo monto | 28–40 h | 2, y lo legal resuelto | Con los cobros **apagados** hasta terminar el sandbox y tu OK. **Fecha límite: antes del día 80 después de la charla.** |
| **4b** | **Pedidos en WooCommerce** (opcional) | Alta de un pedido en Woo por cada cobro, por la REST API (variante H). **Solo si la facturación ARCA va a salir desde Woo**; si no, se posterga. | 7–10 h | 4a y la decisión de facturación | Sí, sin afectar los permisos |
| **5** | **Avanzado** | Calculadora PRO, ROI PRO, estadísticas, informes PDF/Excel, cierre de caja; copia semanal a R2 | 25–40 h | 3 | Por partes |

**Fase de lanzamiento gratis** (decisión de Stella): **etapas 2, 3 y 3c, ≈ 44–68 h.** Las etapas 4a y 4b (cobros automáticos y pedidos en Woo) quedan **postergadas**, con su diseño listo, hasta que se decida cobrar a personas o a instituciones. Si algún día se cobra, serían ≈ 35–50 h más. Para la charla alcanza con las etapas 2 y 3: **≈ 40–60 h**, más las pruebas de `PLAN_MVP_CHARLA_FERIANTES.md`.

*Las horas son una estimación de esfuerzo, no un presupuesto: dependen de las decisiones pendientes y de lo que se confirme en sandbox.*

**Por qué este orden es bueno:**
- La Etapa 2 sale sola y no tiene riesgo de dinero.
- La Etapa 3 se valida con feriantes reales antes de cobrar.
- La Etapa 4 llega con un producto que ya probó su valor.

## Costos
| Concepto | Variante H (recomendada) | Variante W |
|---|---|---|
| Licencias | USD 0 | ✅ USD 279/año (WCS), más ⏳ el plugin de pasarela |
| Infraestructura | Cloudflare Pages, D1 y Workers. ⏳ Confirmar el plan: el gratis tiene límites de escritura diaria en D1 y 7 días de Time Travel; el pago (USD 5/mes) da 30 días. Para datos de ventas, **recomiendo el pago**. | Ídem + hosting actual |
| Comisiones | ⏳ Las de Mercado Pago por cobro (ver tu panel), más IVA | Ídem + pasarela |
| Mantenimiento | Seguir la API de MP y la REST API de Woo; pruebas automáticas | Actualizar 3 plugins con dinero real en juego |

## Decisiones pendientes (tuyas)
1. **Variante de cobro H o W:** recomiendo H.
2. **Fecha de la charla:** define si llegamos con el MVP completo o con un MVP reducido (ver el plan del MVP).
3. **Promo anual 24.900:** ¿quién accede, hasta cuándo, y si renueva a 24.900 o a 29.900?
4. **Diferencia entre mensual y anual** (hoy 49%): ver mi sugerencia en el modelo freemium.
5. **Cuando la persona contrata durante la prueba:** ¿el cobro arranca ya o al terminar la prueba (`free_trial` de MP)? Recomiendo **al terminar**, porque evita la sensación de perder días.
6. **Política de reembolsos** y de cambio de plan.
7. **Revisión legal:** botón de baja, botón de arrepentimiento, términos y privacidad.
8. **Facturación (ARCA)** de cada cobro.
9. **Plan de Cloudflare:** gratis o Workers Paid.

## Riesgos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| No llegar a la charla con todo el MVP | Alto | MVP reducido definido (ferias, productos y ventas PRO; stock simple) |
| *(Solo si se cobra)* **Reloj de los 90 días:** los códigos vencen y todavía no se puede pagar | Alto: se pierde el momento de mayor conversión | La Etapa 4a es una fecha límite (antes del día 80 después de la charla), no una mejora |
| Construir algo que los feriantes no pagarían | Alto | Etapa 1b de validación antes de la Etapa 3 |
| Lo legal o la facturación sin resolver al momento de cobrar | Alto | Arrancan ya, en paralelo |
| Error de stock o ventas duplicadas con datos reales | Alto | Ids idempotentes, libro de movimientos, `batch` atómico y pruebas de concurrencia (ver la arquitectura de datos) |
| Pérdida de `TEXT_KEY` | Crítico | Ya está en tu gestor de contraseñas: verificarlo antes de la Etapa 3 |
| Algo de MP no confirmado (plan anual, cuenta obligatoria) | Medio | Sandbox al inicio de la Etapa 4, antes de construir la interfaz de pago |
| Desincronización con los pedidos de Woo | Bajo | El permiso no depende de Woo; el Cron reintenta |
| Requisitos legales | Medio | Revisión antes de activar cobros |
| Precio en ARS desactualizado por inflación | Medio | Revisión periódica y aviso previo a quien ya está suscripto |

## Pruebas necesarias (resumen)
- **Automáticas:** permisos (`requirePro`, lectura permitida sin PRO); canje de códigos (fecha, cupo, simultáneos); una prueba general por persona; aislamiento entre cuentas; idempotencia de ventas y stock; ediciones con conflicto; webhooks (firma, repetidos, desordenados); períodos (mensual, anual, fin de mes).
- **Sandbox MP:** alta mensual y anual, rechazo, renovación, cancelación desde RELAB y desde MP, reembolso, webhook caído.
- **En el navegador:** celular y computadora; sin conexión; otra cuenta de Google; vencimiento con modo lectura.
- **Regresión:** las 123 pruebas automáticas actuales y los e2e del Kit.

## Despliegue
1. Cada etapa en su rama, con vista previa y tu OK.
2. **Antes de cada migración:**
   - marcador de Time Travel;
   - `wrangler d1 export`;
   - revisión del SQL con vos;
   - `migrations apply` con tu OK.
3. **Etapa 4:** cobros apagados con una variable hasta terminar el sandbox. Después, una compra real de bajo monto, cancelada y reembolsada.
4. **Reversión:**
   - apagar la variable de cobros o de PRO, y los datos quedan intactos;
   - para la base, restaurar Time Travel al marcador previo.
