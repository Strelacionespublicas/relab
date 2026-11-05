# Corrección 1 · Importes y cálculos del Kit del Emprendedor Feriante

*Rama `fix/kit-feriante-importes`, creada desde `main` (5b22afa). Toma como referencia `AUDITORIA_KIT_FERIANTE.md` (hallazgo crítico n.º 1 y riesgo n.º 9). No está integrada en `main` ni desplegada.*

## Resumen
El kit interpretaba mal los importes escritos como se escriben en Argentina. **"120.000" se leía como 120** y "1.500,50", "$5000" o "12 000" se convertían en 0, sin aviso. Ahora:
- se leen bien;
- lo que no es un número se marca en el campo, en lugar de contarse como 0;
- se rechazan los negativos y los porcentajes fuera de 0–100.

Las fórmulas quedaron en un módulo propio, con 67 pruebas automáticas.

## Archivos modificados
| Archivo | Cambio |
|---|---|
| `src/kit/calc.js` (nuevo) | Módulo de funciones puras, sin React (detalle abajo) |
| `src/kit-feriante.jsx` | Usa el módulo. Se quitaron `num` y `fmt` locales. Calculadora y ROI muestran el error en cada campo (`aria-invalid` + mensaje con `role="alert"`) y ocultan el resultado mientras haya errores. Ventas del día usa `readMonto`. El CSV ya no redondea los centavos. "Mercadería e insumos" suma la ayuda "El costo de lo que vendiste, no de todo el stock." |
| `src/kit-feriante.css` | Solo estados de error: borde rojo en el campo inválido y ubicación del mensaje. El resto del diseño no cambia. |
| `tests/unit/kit-calc.test.js` (nuevo) | 67 pruebas unitarias |
| `package.json` / `package-lock.json` | `vitest` 3.2.7 como dependencia de desarrollo y script `npm test` |
| `CLAUDE.md` | Documenta el módulo y las pruebas |

**Contenido de `src/kit/calc.js`:**
- `parseNumber`: lectura en formato argentino.
- `num`: la compatible de siempre.
- `readField` y `readMonto`: validación.
- `fmt` y `csvMonto`: formato de salida.
- `calcFeria` (calculadora) y `calcRoi` (ROI).

**No se tocó:**
- la base de datos, las migraciones ni la API;
- los datos guardados: mismas claves (`relab-kit-feriante`, `kit-feriante`) y misma forma del estado;
- los demás recursos de Relab;
- el diseño, salvo los mensajes de error;
- no se agregaron funciones nuevas.

## Cómo se leen los números ahora (`parseNumber`)
| Escrito | Antes | Ahora |
|---|---|---|
| `120.000` | 120 ❌ | 120000 |
| `1.500,50` | 0 ❌ | 1500,50 |
| `$5000` | 0 ❌ | 5000 |
| `12 000` | 0 ❌ | 12000 |
| `1500,50` | 1500,50 | 1500,50 |
| `1.500.000,75` | 0 ❌ | 1500000,75 |
| `$ 1.500,50` | 0 ❌ | 1500,50 |
| `2.99` / `3.5` / `0,5` | igual | igual (compatibles) |
| `0.500` | 0,5 | 0,5 (con parte entera 0, el punto es decimal) |
| `abc`, `1.50.0`, `5%` | 0 en silencio ❌ | inválido, se avisa en el campo |

Reglas:
- Se quitan los espacios (también el espacio duro) y el `$` inicial.
- Con punto y coma juntos, el último es el decimal y el otro tiene que agrupar de a 3 cifras.
- Solo con coma: es el decimal, como antes.
- Solo con punto: si agrupa de a 3 cifras ("1.500", "120.000", "1.500.000") es separador de miles. Si no ("2.99", "3.5"), es decimal, como antes.
- Vacío no es error y cuenta como 0, salvo en el monto de una venta, que es obligatorio.

**Compatibilidad:**
- Los montos de las ventas ya guardadas son números y no cambian.
- Los campos de la calculadora y del ROI guardan el texto tal cual se escribió, así que se reinterpretan con las reglas nuevas.
- El único cambio de resultado posible es el que se buscaba: si alguien había escrito "120.000", antes el kit calculaba con 120 y ahora con 120.000.

## Errores corregidos
1. **Importes en formato argentino mal leídos:** antes daban 120 o 0. Afectaba a la calculadora, a las ventas y al ROI.
2. **Valores inválidos contados como 0 en silencio.** Ahora el campo se marca con "Escribí solo números, por ejemplo 12.000 o 1.500,50." y la calculadora o el ROI muestran "Corregí los campos marcados…" en lugar de un resultado equivocado.
3. **Negativos aceptados.** Un costo de −45.000 o un "% digital" de −50 daban resultados absurdos, como comisiones negativas. Ahora: "No puede ser negativo."
4. **Porcentajes fuera de rango.**
   - "% digital" se recortaba a 100 sin avisar y la comisión no tenía tope.
   - Ahora los dos aceptan de 0 a 100 y, si no: "Tiene que estar entre 0 y 100."
5. **Días de feria = 0.** Antes se convertía en 1 sin avisar; ahora dice "Tiene que ser mayor a 0." Vacío sigue valiendo 1.
6. **Monto de la venta.**
   - Si es inválido o negativo, ya no se registra y dice qué revisar.
   - "12.000" se guarda como $12.000, no como $12.
7. **ROI, % del objetivo.** Comparaba el ingreso **neto** (después de comisiones) con un objetivo de **ventas**, que es bruto. Ahora compara lo vendido con el objetivo.
8. **ROI, venta por día.** Mostraba el neto dividido por los días; ahora muestra lo **vendido** por día, como dice la etiqueta.
9. **CSV de ventas:** redondeaba los centavos ($1.500,50 salía como 1501). Ahora exporta `1500,5`.

## Revisión de las fórmulas (sin cambios de lógica)
Comprobadas con casos hechos a mano en las pruebas:
- **Calculadora:**
  - ingresos = Σ precio × unidades;
  - costo de lo vendido = Σ costo × unidades;
  - comisiones = ingresos × %digital × %comisión;
  - ganancia = ingresos − costo vendido − fijos − comisiones;
  - margen = ganancia / ingresos;
  - equilibrio = ⌈fijos / (precio promedio − costo promedio − precio promedio × %digital × %comisión)⌉.

  Ejemplo: 2 productos y $100.000 de fijos dan $210.000 de ingresos, $26.850 de ganancia, 13% de margen y 40 unidades de equilibrio. El caso de Rosa sigue dando $1.785.000, $722.515 y 10 unidades.
- **ROI:**
  - neto = efectivo + digital − comisiones;
  - costos = stand + traslado + mercadería vendida + otros;
  - ROI = (neto − costos) / costos, y sin costos no se calcula;
  - las decisiones siguen igual: rentable con ganancia y ROI ≥ 20%, positivo con margen bajo, o pérdida.

## Pruebas ejecutadas y resultados
| Prueba | Resultado |
|---|---|
| `npm test` (Vitest 3.2.7, `tests/unit/kit-calc.test.js`) | ✅ **67 de 67** |
| `npm run build` | ✅ sin errores |
| Prueba en navegador de siempre del kit (Playwright, celular y computadora, con sesión simulada y otro dispositivo) | ✅ **32 de 32**: sin regresiones |
| Prueba en navegador nueva de importes (Playwright, celular) | ✅ **18 de 18** |

**Qué cubren las pruebas unitarias:**
- los 5 formatos pedidos;
- 18 formatos válidos más, incluidos los que ya admitía el kit;
- 16 inválidos que ya no se convierten en 0;
- vacío ≠ 0;
- negativos y porcentajes 0–100;
- monto de venta obligatorio y mayor a 0;
- calculadora con caso a mano, caso de Rosa, 0% digital, sin unidades, margen negativo y todo vacío;
- ROI: valores, cuatro decisiones, sin costos, días 0 e inválidos;
- formato de salida y CSV.

**Qué cubre la prueba nueva en el navegador:**
- "120.000" de stand → $120.000;
- texto inválido → campo marcado y resultado oculto;
- % > 100 y costo negativo → error;
- venta "12.000" → $12.000 y "1.500,50" → total $13.501;
- monto inválido o negativo → no se registra;
- CSV con centavos;
- ROI con importes argentinos;
- objetivo sobre lo vendido;
- días 0 → error;
- sin scroll horizontal ni errores de JS.

Las dos pruebas en navegador corren contra wrangler y D1 locales. Quedaron fuera del repo, en el entorno de trabajo, igual que en las etapas anteriores. Sumar pruebas e2e al repo es parte de la recomendación 12 de la auditoría.

## Pendiente (fuera de esta corrección)
- Riesgos de pérdida y mezcla de datos (hallazgos 2 a 5): Etapa 3 de la auditoría.
- `npm install` reporta avisos de `npm audit` en dependencias de desarrollo. No afectan al sitio publicado y no se tocaron.
