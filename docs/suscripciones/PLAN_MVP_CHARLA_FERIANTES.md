# Plan del MVP · Charla con feriantes

*Qué se puede mostrar en una capacitación, qué hay que probar antes de que lo usen emprendedores reales, y en qué orden se construye. Es un plan para aprobar, sin implementar.*

## 1. Objetivo de la charla
- Que cada feriante salga **usando el Kit gratis** en su celular.
- Que salga con **PRO activado por 90 días con un código**, sin tarjeta.
- Para vos, el objetivo comercial es **validar PRO con uso real** antes de cobrar, y llegar al fin de los 90 días con personas que ya cargaron su catálogo y sus ferias. Esas son las que convierten.

## 2. Qué se puede mostrar
| Bloque | Qué se muestra | Estado |
|---|---|---|
| **Kit gratis** | Las 7 herramientas, con el ejemplo de Rosa: checklist, calculadora, cobros, pitch, visitantes, ventas del día y ROI | ✅ Ya existe (con las correcciones 1 a 3, pendientes de integrar a `main`) |
| **Activar PRO** | Login con Google → "Tengo un código" → código de la charla → PRO por 90 días | Etapa 2 |
| **A. Mis ferias** | Crear "Feria de Mataderos · sábado", con lugar, fechas y gastos (stand, viaje). Marcarla como activa. | Etapa 3 |
| **B. Mis productos** | Cargar 3 o 4 productos con costo, precio y una variante (por ejemplo talle o color) | Etapa 3 |
| **C. Ventas PRO** | Vender "2 × aros dorados" con descuento, cobrado con QR; ver ingresos, comisión y neto; editar una venta | Etapa 3 |
| **D. Stock** | Cargar existencias, ver cómo baja con cada venta, la alerta de stock bajo y una reposición | Etapa 3 |
| **Modo lectura** | Qué pasa cuando vencen los 90 días: nada se borra, se puede exportar, vuelve con PRO | Etapa 3 (se muestra con una cuenta de prueba vencida) |

**Guion sugerido** (unos 20 minutos de demo):
1. El problema: "¿Ganaste plata en la última feria?"
2. Calculadora gratis.
3. Ventas del día gratis.
4. Activar el código, todos juntos, con el QR en pantalla.
5. Cargar un producto en vivo.
6. Hacer una venta con stock.
7. ROI.
8. Cierre: "Esto es tuyo 90 días; tus datos no se pierden".

**Datos de demo:** una cuenta exclusiva para la charla (no la tuya personal), cargada con el caso Rosa: 2 ferias, 8 productos y unas 30 ventas. Se arma con un script de datos ficticios que corre solo sobre esa cuenta.

## 3. MVP reducido, si no llegamos con la fecha
Orden de recorte, de lo último a sacar a lo primero:
1. **Se mantienen siempre:** Acceso PRO con código, Mis productos y Ventas PRO con catálogo y cantidad.
2. **Mis ferias**, sin historial detallado.
3. **Stock simple:** existencias y descuento por venta, sin alertas ni reposición.
4. **Se postergan:** variantes, descuentos y la edición de ventas.

## 4. Pruebas obligatorias antes del uso con emprendedores reales
**Integridad de datos (no negociable):**
- [ ] Una venta enviada dos veces (doble toque, reintento por red) **queda una sola vez**, y el stock baja una sola vez.
- [ ] Dos dispositivos vendiendo el mismo producto a la vez: el stock final es la suma correcta de los movimientos.
- [ ] Editar una venta (cambiar la cantidad o el producto) ajusta el stock exactamente.
- [ ] Borrar una venta devuelve el stock, y se puede recuperar desde la papelera.
- [ ] Ventas sin conexión, cerrar la app y volver con red: se suben todas, sin duplicados.
- [ ] Cerrar sesión con ventas pendientes: quedan resguardadas y no se mezclan con otra cuenta.

**Aislamiento y permisos:**
- [ ] Otra cuenta no puede leer ni escribir ferias, productos ni ventas ajenas: prueba automática con ids de otra cuenta.
- [ ] Sin PRO, el servidor rechaza crear y editar (`pro_required`), pero permite leer y exportar.
- [ ] Al vencer el código, nada se borra. Al reactivar, todo vuelve editable.
- [ ] Un código no se canjea dos veces por la misma persona, respeta el cupo con canjes simultáneos y vence en su fecha.
- [ ] El panel de administración solo abre con un email de `ADMIN_EMAILS` y no muestra contenido de nadie.

**Cálculos:**
- [ ] Ingresos, descuentos, comisiones y neto, con importes argentinos (`1.500,50`), contra casos calculados a mano.
- [ ] Los totales de Ventas PRO coinciden con la exportación CSV.

**Uso real:**
- [ ] En celulares Android y iPhone de gama media: alta de producto y venta en menos de 10 segundos.
- [ ] Con mala señal o modo avión, en el momento de la feria.
- [ ] Prueba piloto con 2 o 3 feriantes de confianza durante una feria real, antes de la charla.
- [ ] Las herramientas gratis siguen igual: las 123 pruebas automáticas y los e2e en verde.

**Respaldo:**
- [ ] Marcador de Time Travel y exportación de la base anotados antes de las migraciones `0004` y `0005`.
- [ ] Una restauración de prueba en la base de prueba, para saber que funciona.
- [ ] `TEXT_KEY` verificada en tu gestor de contraseñas.

## 5. Cronograma orientativo (desde tu aprobación)
| Semana | Trabajo | Tu parte |
|---|---|---|
| 1 | Etapa 2: acceso PRO, códigos y panel | Aprobar la migración `0004`; probar el canje en la vista previa |
| 2–3 | Etapa 3: ferias, productos, ventas PRO y stock | Aprobar la `0005`; probar en tu celular |
| 4 | Pruebas obligatorias, piloto con 2 o 3 feriantes, datos de demo, código de la charla | Conseguir a las personas del piloto |
| Charla | Demo y canje en vivo | — |

**Para que la charla sea con el MVP completo, conviene que esté a 4 o más semanas de tu aprobación.** Si es antes, va con el MVP reducido de la sección 3.

## 6. Después de la charla (para no perder la oportunidad)
- **Indicadores:**
  - canjes del código;
  - personas que cargaron al menos 1 producto;
  - personas con al menos 1 venta PRO;
  - uso en la semana 2 y en la semana 8.

  Son números, sin leer contenido.
- **Antes del día 80 de los 90:** la Etapa 4 lista, con la promo anual de 24.900 para quienes canjearon el código. Ese es el momento de mayor conversión.
- **Encuesta corta** a las 2 semanas: qué usaron y qué les falta. Eso ordena la Etapa 5.

## 7. Pendientes para cerrar este plan
- **Fecha de la charla.**
- **Cantidad aproximada de asistentes**, para definir el cupo del código.
- **Personas para el piloto.**
- **Si la promo anual se anuncia en la charla** o al final de la prueba.
