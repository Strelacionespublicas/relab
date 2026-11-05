# Modelo freemium · Kit Feriante PRO

*Diseño para aprobar, sin implementar. Criterio definido por Stella: **las 7 herramientas actuales siguen 100% gratis, con todas sus funciones de hoy**. PRO **suma** funciones avanzadas en Ventas del día, Calculadora y ROI post feria, y **módulos nuevos exclusivos**: Mis ferias, Mis productos, Stock, Estadísticas avanzadas e Informes. Complementa `ARQUITECTURA_WOOCOMMERCE_RELAB.md` y `PLAN_IMPLEMENTACION_SUSCRIPCIONES.md`.*

**En una frase:** gratis sirve para manejar **una feria**; PRO sirve para manejar **el negocio feriante**, con varias ferias, catálogo, stock e informes.

## 1. Principios
1. **Lo gratis no se recorta, nunca.** Todo lo que hoy hace el kit (incluido guardar en la cuenta, el modo sin conexión y el CSV) sigue gratis y sin límites nuevos.
2. **PRO suma, no bloquea.** Lo PRO aparece como una opción extra con la marca "PRO". Nunca interrumpe un flujo gratis: por ejemplo, no hay carteles al registrar una venta.
3. **Los datos son de la persona.** Si PRO vence (cancelación o fin de la prueba):
   - todo lo cargado en módulos PRO queda **visible en modo lectura y exportable** (CSV/PDF);
   - nada se borra;
   - las herramientas gratis siguen funcionando con todos sus datos.
4. **Al volver a PRO, todo reaparece editable.**
5. **El permiso se controla en el servidor**, no solo ocultando botones.
6. **El modelo se reutiliza** para otros productos de RELAB.

## 2. Gratis (exactamente lo actual)
| Herramienta | Funciones gratis (sin cambios) |
|---|---|
| Checklist | 24 ítems, avance y desmarcar todo |
| Calculadora | Costos fijos, productos escritos en el momento (costo, precio, unidades), comisión promedio, % digital, resultado, margen, punto de equilibrio y el ejemplo de Rosa |
| Cobros | Guía de medios de pago |
| Pitch y ventas | Contenido completo |
| Visitantes | Contenido completo |
| Ventas del día | Registrar venta (producto, monto, medio), Hoy / Toda la feria, métricas, totales por medio, borrar, CSV |
| ROI post feria | Ingresos, costos, métricas, decisión, "Traer ventas del tracker" |
| General | Cuenta con Google, guardado en la cuenta, varios dispositivos, sin conexión |

## 3. PRO: mejoras en herramientas existentes
| Herramienta | Funciones PRO (nuevas) |
|---|---|
| **Ventas del día** | Elegir el producto de **Mis productos**, con precio sugerido · **cantidad** por venta · descuentos · **editar** una venta · notas · venta asignada a una **feria** · **comisión real por medio de pago** (tasas configurables) y neto del día · **cierre de caja**: efectivo esperado contra contado · ventas por hora |
| **Calculadora** | **Escenarios** guardados y comparados (pesimista, realista, optimista) · comisión por medio de pago en lugar de un promedio · **precio sugerido** para un margen objetivo · importar productos y costos desde Mis productos y Mis ferias |
| **ROI post feria** | **ROI por feria** · comparar ferias entre sí · costos que vienen de Mis ferias · comisiones calculadas desde las ventas · costo de mercadería vendida automático (catálogo × cantidades) · objetivo contra real |

## 4. PRO: módulos nuevos
| Módulo | Qué hace |
|---|---|
| **Mis ferias** | Crear ferias o eventos (nombre, lugar, fechas, costo de stand y otros fijos), elegir la feria activa, historial. Las ventas gratis existentes quedan en "Sin feria" y se pueden asignar. |
| **Mis productos** | Catálogo: nombre, categoría, costo, precio, variantes simples. Lo usan Ventas, Calculadora, ROI y Stock. |
| **Stock** | Stock inicial por feria y producto, descuento automático con cada venta, alerta de stock bajo, reposición, stock final al cierre |
| **Estadísticas avanzadas** | Por producto (unidades, ingresos, margen), por día y hora, por medio de pago, por feria, tendencias entre ferias, productos más rentables |
| **Informes** | PDF y Excel por feria (balance, ventas, stock final, ROI) e informe anual de todas las ferias |

## 5. Pruebas gratis y vencimiento
- **Las pruebas de 30 días** (general) **y de 90 días** (código de capacitación) dan **todo PRO**, sin tarjeta y sin cobro.
- **Al vencer** PRO o la prueba:
  - los módulos PRO pasan a modo lectura con "Exportar" y "Volver a PRO";
  - en Ventas del día, los campos PRO de cada venta (cantidad, feria, producto) se siguen viendo, pero solo se editan las partes gratis;
  - los totales gratis siguen calculándose igual.
- **Avisos:** 7 días y 1 día antes de vencer, en el panel. Nunca durante el registro de una venta.

## 6. Consecuencias técnicas (para la implementación, con aprobación aparte)
- **Datos:** los campos PRO son **aditivos** (por ejemplo, una venta suma `feriaId`, `productoId` y `cantidad`). Una venta sin esos campos es una venta gratis como las de hoy, así que no hace falta migrar nada.
- **Tope de 100.000 caracteres:** catálogo, stock y varias ferias lo superan. Los módulos PRO necesitan su **propio almacenamiento**: recursos separados por módulo o por feria, o tablas D1. Es un diseño aparte que hay que aprobar, porque cambia el esquema. El estado gratis actual (`kit-feriante`) no se toca.
- **Permisos:** `GET /api/billing/me` → `pro`. Los endpoints que guardan datos PRO verifican el permiso en el servidor. Los gratis siguen sin cambios.
- **Sin conexión:** se usa el último permiso conocido hasta su vencimiento, sin extenderlo en el dispositivo.

## 7. Cómo encaja en el plan de etapas
- **Etapa 0:** queda resuelto qué es PRO. Siguen pendientes los precios, las condiciones, lo legal y la facturación.
- **Etapa 1:** permisos y pruebas gratis, y la marca "PRO" en la interfaz. **Sin quitar nada gratis.**
- **Etapas 2 a 4:** cobro con Mercado Pago, gestión de la suscripción y conciliación (sin cambios).
- **Etapa nueva, PRO-A:** almacenamiento PRO, Mis productos y Mis ferias, que son la base de todo lo demás.
- **Etapa nueva, PRO-B:** las mejoras PRO en Ventas, Calculadora y ROI, más el Stock.
- **Etapa nueva, PRO-C:** Estadísticas e Informes.
- **Orden sugerido para lanzar:** PRO-A y PRO-B antes de cobrar, porque PRO tiene que tener valor el primer día. PRO-C puede salir después como mejora.
