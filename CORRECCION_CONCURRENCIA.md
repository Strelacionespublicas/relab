# Corrección 3 · Sincronización segura entre dispositivos

*Rama `fix/kit-feriante-persistencia`. Conserva las correcciones 1 y 2. Referencias: `AUDITORIA_KIT_FERIANTE.md`, `CORRECCION_IMPORTES.md` y `CORRECCION_PERSISTENCIA.md` (riesgo pendiente n.º 1). No está integrada en `main` ni desplegada.*

## Resumen
Antes, `PUT /api/state/:resource` escribía sin comprobar nada. Si dos dispositivos de la misma cuenta guardaban casi a la vez, el segundo pisaba al primero.

Ahora el servidor **solo acepta una escritura si se basa en la versión actual**. Si no, responde **409**, y el kit vuelve a leer, concilia con la política de la Corrección 2 y reintenta. La comprobación y la escritura son **una sola sentencia SQL**, así que no queda la carrera de una lectura seguida de una escritura.

El cambio de API es **compatible hacia atrás** y **no requiere migración de la base**.

## Arquitectura implementada
```
Dispositivo                                   Servidor (Pages Function + D1)
  GET  /api/state/kit-feriante ───────────▶  { data, updatedAt: V }
  concilia (merge3 / mergeFirst)
  PUT  { data, baseUpdatedAt: V } ────────▶  UPDATE … WHERE updated_at = V  (atómico)
                                   ◀────────  200 { updatedAt: V' }   o   409 { error: 'conflict' }
  si 409: vuelve a leer (V''), concilia desde la misma base y reintenta (hasta 5 veces)
```

**Servidor** (`functions/api/state/[resource].js`):
| `baseUpdatedAt` en el PUT | Sentencia única | Si no afecta ninguna fila |
|---|---|---|
| ausente (clientes anteriores, checklist Cyber, guía) | `INSERT … ON CONFLICT DO UPDATE SET …, updated_at = MAX(ahora, updated_at + 1) RETURNING updated_at` | — (siempre guarda, como antes) |
| `null` (el cliente no tenía nada guardado) | `INSERT … ON CONFLICT DO NOTHING RETURNING updated_at` | **409** |
| entero ≥ 0 | `UPDATE … SET data = ?, updated_at = MAX(ahora, updated_at + 1) WHERE … AND updated_at = ? RETURNING updated_at` | **409** |
| otro valor (texto, negativo, decimal, objeto, lista, booleano) | — | **400** `invalid_version` |

- La respuesta de éxito es `{ ok: true, updatedAt }`. El campo `updatedAt` es nuevo y los clientes anteriores lo ignoran.
- Si los datos no se pueden descifrar (clave anterior), el GET devolvía `{ data: null }` sin versión, y el cliente habría quedado en 409 para siempre. Ahora también devuelve `updatedAt`.

**Cliente** (`src/kit/sync.js`):
- Cada `PUT` manda `baseUpdatedAt` con la versión leída en el `GET`.
- **Ante un 409:** vuelve a leer, concilia desde la misma base con `merge3` (la política de la Corrección 2) y reintenta.
  - Hasta **5 intentos** por sincronización, con una espera creciente y aleatoria entre intentos (100·n a 100·n + 150 ms) para que dos dispositivos no se pisen en bucle.
  - Si se agotan, queda el estado **"Hubo cambios en otro dispositivo al mismo tiempo. Guardado en este dispositivo."** con el botón "Reintentar". También sigue el reintento automático (3/10/30/60 s). No hay bucles infinitos.
- **Con un 200 y su versión,** la cuenta quedó exactamente igual a lo conciliado, así que todas esas ventas pasan a "confirmadas" y la versión pasa a ser la base de la próxima vez.
- **Ventas borradas que no reaparecen:** el dispositivo rechazado ve el borrado del otro. Esa venta estaba confirmada en el servidor y ya no está, así que la regla de conciliación no la vuelve a subir.
- **Sin cambios:** el modo sin conexión, el resguardo por cuenta, el dueño de los datos, los estados visibles y el freno a duplicados.

## Archivos modificados
| Archivo | Cambio |
|---|---|
| `functions/api/state/[resource].js` | PUT con versión esperada, atómico, 409/400 y `updatedAt` en la respuesta; versión monotónica; GET con versión aunque no se pueda descifrar |
| `src/kit/sync.js` | `baseUpdatedAt` en cada PUT, manejo de 409 con reintentos acotados, estado `conflicto`, confirmación de ventas con la versión devuelta |
| `src/kit-feriante.jsx` | Solo el texto del estado `conflicto` y su botón "Reintentar", sin cambios de diseño |
| `tests/unit/state-api.test.js` (nuevo) | 16 pruebas del handler real de la API sobre SQLite (`node:sqlite`) con el esquema de `migrations/` |
| `tests/unit/kit-sync.test.js` | El servidor simulado aplica la misma regla de versión y permite soltar escrituras a la vez; 12 pruebas nuevas de concurrencia |
| `CLAUDE.md` | Documenta la versión y el 409 |

**Sin cambios:** la base de datos (no hay migraciones), `server/**`, la autenticación, `src/lib/api.js`, el checklist Cyber Monday y la guía. Esos dos usan el PUT sin versión, que se comporta como antes.

## Estrategia de versionado
**¿Alcanza `updated_at` tal como estaba? No.** Era `Date.now()` del Worker, en milisegundos:
- dos escrituras en el mismo milisegundo tenían el mismo valor;
- distintos datacenters pueden tener relojes desfasados, así que una versión nueva podía ser igual o menor que la anterior.

Con una comparación por igualdad, eso permitía aceptar una escritura basada en una versión vieja.

**Alternativa elegida, sin migración:** la misma columna pasa a ser un **contador monotónico por fila**, con `updated_at = MAX(ahora, updated_at + 1)`.
- Cada escritura deja un valor estrictamente mayor que el anterior y único para esa fila, aunque el reloj se repita o vaya hacia atrás.
- Sigue siendo un número parecido a una fecha en ms, así que lo guardado no cambia de significado y no hay que tocar datos.

Se comprobó con pruebas: dos escrituras con el reloj fijo dan versiones consecutivas, y un reloj que va 30 años hacia atrás igual da una versión mayor.

## Resultados de las pruebas
| Suite | Resultado |
|---|---|
| `npm test` · importes (Corrección 1) | ✅ 67/67 |
| `npm test` · sincronización (Corrección 2 + 12 nuevas de concurrencia) | ✅ 40/40 |
| `npm test` · API de estado (nuevo) | ✅ 16/16 |
| **Total `npm test`** | ✅ **123/123** |
| `npm run build` | ✅ |
| Wrangler + D1 locales · 20 PUT simultáneos con la misma versión | ✅ 7/7: 1 aceptado, 19 con 409, datos finales = el aceptado, versiones crecientes |
| Navegador · dos dispositivos de la misma cuenta guardando a la vez (D1 local real) | ✅ 9/9 |
| Navegador · kit completo (regresión) | ✅ 33/33 |
| Navegador · importes (Corrección 1) | ✅ 18/18 |
| Navegador · persistencia (Corrección 2) | ✅ 28/28 |
| Navegador · checklist Cyber Monday (PUT sin versión) | ✅ 23/23 |

**El escenario pedido.** Probado en `kit-sync.test.js` y también en el navegador contra D1 real:
1. A y B leen la misma versión.
2. A registra una venta y B registra otra.
3. Los dos guardados se retienen y se sueltan juntos.
4. El servidor acepta uno y responde 409 al otro (códigos observados: `200, 409, 200`).
5. El rechazado vuelve a leer, concilia y reintenta.
6. Las dos ventas quedan en la cuenta y en los dos dispositivos.

**También probado:**
- **Borrado simultáneo:**
  - A borra una venta mientras B agrega otra: la borrada no reaparece (también en el navegador);
  - dos dispositivos borran ventas distintas: se respetan los dos borrados.
- **Checklist concurrente:** ítems distintos se suman; en el mismo ítem queda el último cambio.
- **Calculadora y ROI concurrentes:** campos distintos se combinan. Si los dos cambian el mismo campo, gana el que concilia último, y los dos dispositivos terminan con el mismo valor.
- **Reconexión:** un dispositivo trabaja sin señal mientras el otro guarda y borra; al volver no se pierde nada y el borrado se respeta.
- **Clientes anteriores sin `baseUpdatedAt`:** un PUT viejo en el medio. El kit lo detecta, porque la versión cambió, y concilia.
- **Servidor anterior (sin versión):** el kit nuevo sigue funcionando como en la Corrección 2.
- **Versiones inválidas:** 6 tipos → 400 sin guardar.
- **Reintentos repetidos:**
  - con 409 permanente, corta en 5 intentos, muestra el aviso y se resuelve después sin duplicar;
  - un 409 aislado se resuelve en el mismo guardado;
  - con tres dispositivos guardando juntos no se pierde ninguna venta.

## Compatibilidad con versiones anteriores
- **Datos:** sin migración; la forma del estado y los valores guardados no cambian.
- **Clientes anteriores** (pestañas viejas del kit, checklist Cyber Monday, guía): el PUT sin `baseUpdatedAt` guarda como siempre. Su escritura avanza la versión y el kit nuevo la detecta.
- **El kit nuevo contra un servidor anterior** (por ejemplo, si se revierte solo la API): el servidor ignora `baseUpdatedAt` y el kit funciona como en la Corrección 2.
- **Las correcciones 1 y 2** siguen intactas: todas sus pruebas pasan.

## Riesgos pendientes
1. **Clientes sin versión.** Una pestaña con la versión anterior del kit todavía puede pisar sin control mientras siga abierta. Al recargar pasa a usar la versión nueva. Las ventas de los dispositivos nuevos no se pierden, porque se vuelven a subir.
2. **Mismo campo editado en dos dispositivos al mismo tiempo** (por ejemplo, el alquiler en la calculadora): queda el valor del último que concilia, sin aviso. Es la política documentada en la Corrección 2. Si hiciera falta avisarlo, se puede sumar más adelante.
3. **Conflicto persistente:** si un dispositivo recibe 409 cinco veces seguidas (otro guarda sin parar), espera y reintenta solo. Los datos siguen guardados en el dispositivo.
4. **Tope de 100.000 caracteres por cuenta:** sigue igual que en la Corrección 2.
5. **Las pruebas de la API** usan `node:sqlite` (Node 22.5 o más nuevo), que todavía es experimental y muestra un aviso. Las pruebas en navegador y contra wrangler quedaron fuera del repo, igual que antes.

## Procedimiento de despliegue y reversión
**Despliegue** (cuando lo autorices):
1. Revisar la vista previa de Cloudflare de `fix/kit-feriante-persistencia`.
2. Integrar en `main` con fast-forward. Incluye las correcciones 1, 2 y 3.
3. Cloudflare publica el sitio y las Functions juntos. **No hay migración ni secretos nuevos.**
4. Verificar con tu cuenta en dos dispositivos:
   - registrar una venta en cada uno casi a la vez y ver que las dos aparecen en ambos;
   - borrar una en uno y ver que no vuelve.

**Reversión:**
- **Todo:** revertir el merge en `main` (o volver a publicar el deploy anterior desde el panel de Cloudflare Pages).
- **Solo la API:** revertir el cambio de `functions/api/state/[resource].js`. El kit nuevo sigue funcionando sin versión, como en la Corrección 2.
- **Datos:** la reversión no los afecta. La columna `updated_at` sigue siendo un número y la versión anterior la usa igual.
