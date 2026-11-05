# Modelo freemium · Kit Feriante PRO

*Versión 2: aprobada en lo conceptual por Stella, con ajustes. Sigue sin implementar. Complementa `ARQUITECTURA_DATOS_KIT_PRO.md`, `ARQUITECTURA_WOOCOMMERCE_RELAB.md`, `PLAN_IMPLEMENTACION_SUSCRIPCIONES.md` y `PLAN_MVP_CHARLA_FERIANTES.md`.*

**Mensaje oficial:**
- **GRATIS:** herramientas para planificar, registrar ventas y evaluar resultados.
- **PRO:** gestión organizada de múltiples ferias, productos, inventario, ventas avanzadas e informes.

*(Se elimina la frase anterior "gratis sirve para una feria": no es cierta, porque el kit gratis no tiene límite de ferias, y además desvaloriza lo gratis.)*

## 1. Principios
1. **Las 7 herramientas actuales siguen 100% gratis**, sin restricciones nuevas. Eso incluye la cuenta, el guardado, varios dispositivos, el modo sin conexión y el CSV.
2. **PRO suma, no bloquea.** Lo PRO aparece como una opción extra con la marca "PRO" y nunca interrumpe un flujo gratis.
3. **El permiso se controla en el servidor**, no solo ocultando botones.
4. **El modelo se reutiliza** para otros productos de RELAB.

## 2. Conservación de datos al terminar la prueba o la suscripción
| Regla | Qué significa |
|---|---|
| **No se borra nada** | Ferias, productos, ventas PRO y stock quedan guardados sin plazo de vencimiento, mientras exista la cuenta |
| **Lo gratis sigue igual** | Las 7 herramientas funcionan con todos sus datos |
| **PRO se puede ver y exportar** | Los módulos PRO se abren en modo lectura, con "Exportar" (CSV/JSON) |
| **Solo se bloquea crear y editar** lo exclusivo de PRO | El servidor rechaza esas escrituras (`pro_required`) |
| **Al reactivar PRO, vuelve la edición** | Con todos los datos tal como estaban |

La única forma de borrar datos PRO es que la persona use "Borrar mi cuenta", o que borre un registro (que va a una papelera de 30 días).

## 3. Gratis (exactamente lo actual)
| Herramienta | Funciones gratis (sin cambios) |
|---|---|
| Checklist | 24 ítems, avance y desmarcar todo |
| Calculadora | Costos fijos, productos (costo, precio, unidades), comisión promedio, % digital, resultado, margen, punto de equilibrio y el ejemplo de Rosa |
| Cobros | Guía de medios de pago |
| Pitch y ventas | Contenido completo |
| Visitantes | Contenido completo |
| Ventas del día | Registrar venta (producto, monto, medio), Hoy / Toda la feria, métricas, totales por medio, borrar, CSV |
| ROI post feria | Ingresos, costos, métricas, decisión, "Traer ventas del tracker" |
| General | Cuenta con Google, guardado en la cuenta, varios dispositivos, sin conexión |

## 4. PRO, por prioridad
**MVP (para la charla con feriantes):**
| Módulo | Qué incluye |
|---|---|
| **A. Mis ferias** | Crear y editar ferias: nombre, ubicación, fechas, gastos. Feria activa. Historial. |
| **B. Mis productos** | Catálogo: nombre, categoría, costo, precio, variantes simples |
| **C. Ventas PRO** | Elegir productos del catálogo, cantidad, medio de pago, descuentos, asociar la venta a una feria, editar, cálculo de ingresos y comisiones |
| **D. Stock** | Existencias, descuento automático por venta, reposición, alerta de stock bajo |

**Después (Etapa 5):**
- **Calculadora PRO:** escenarios, comisión por medio de pago, precio sugerido para un margen objetivo, importar desde el catálogo.
- **ROI PRO:** ROI por feria, comparar ferias, costos y comisiones automáticos.
- **Estadísticas avanzadas:** por producto, día, hora, medio y feria.
- **Informes** PDF y Excel, por feria y anuales.
- **Cierre de caja.**

## 5. Planes y pruebas
| Plan | Precio | Condiciones |
|---|---|---|
| **Gratis** | ARS 0 | Permanente |
| **Prueba PRO 30 días** | ARS 0 | Para cualquier persona registrada, una vez por cuenta. Voluntaria (se activa con un botón), sin tarjeta y sin cobro. |
| **Prueba PRO 90 días con código** | ARS 0 | Por código especial (capacitaciones, charlas). Los días, la fecha límite de canje y el cupo se configuran desde el **panel de administración**. Sin tarjeta y sin cobro. |
| **PRO Mensual** | ARS 4.900 | Renovación automática |
| **PRO Anual** | ARS 29.900 | Renovación automática (equivale a ~ARS 2.490 por mes, 49% menos que el mensual) |
| **PRO Anual promocional** | ARS 24.900 | Con código o en una ventana de lanzamiento (⏳ decidir si renueva a 24.900 o a 29.900) |

**Al vencer una prueba**, PRO pasa solo a modo lectura y la cuenta vuelve a Gratis. **Nunca cobra.**
**Avisos de vencimiento:** 7 días y 1 día antes, en el panel. Nunca mientras se registra una venta.

## 6. Mi opinión sobre los precios
- **El anual a 29.900 es el plan que conviene empujar.** Coincide con el ciclo de temporada de ferias, y además reduce cobros, rechazos y bajas. Ojo: un descuento del 49% hace que el mensual parezca caro. Si querés que el mensual también venda, yo lo bajaría a ARS 3.900, o subiría el anual a 34.900 (alrededor de 40% de descuento).
- **La promo a 24.900 la limitaría** a quienes canjeen un código en la charla y contraten antes de que termine la prueba de 90 días. Es el mejor gancho para convertir a esas personas.
- Los precios en ARS se desactualizan rápido. Conviene definir cada cuánto se revisan (⏳) y avisar a quien ya está suscripto antes de cualquier aumento.

## 7. Consecuencias técnicas
Ver `ARQUITECTURA_DATOS_KIT_PRO.md`. En resumen:
- **El estado gratis (`kit-feriante`) no se toca.** PRO tiene tablas propias en D1, cifradas por fila.
- **Las ventas gratis no se migran.** Se pueden importar a una feria PRO a pedido, y el original queda intacto.
- **El permiso se verifica en el servidor** (`requirePro`) en cada escritura PRO. La lectura y la exportación de los datos propios están siempre permitidas.
- **Sin conexión**, se usa el último permiso conocido hasta su vencimiento, sin extenderlo en el dispositivo.
