# Corrección 2 · Persistencia y protección de datos del Kit del Emprendedor Feriante

*Rama `fix/kit-feriante-persistencia`, creada desde `fix/kit-feriante-importes` (incluye la Corrección 1 con sus 67 pruebas). Referencias: `AUDITORIA_KIT_FERIANTE.md` (hallazgos 2 a 7) y `CORRECCION_IMPORTES.md`. No está integrada en `main` ni desplegada.*

**No hubo cambios en la API, ni en la base de datos, ni en la autenticación, ni en la forma del estado que se guarda en la cuenta** (`{ checks, ventas, calc, roi }`, igual que antes). Lo que cerraría por completo el riesgo que queda necesita un cambio de API. Está propuesto en la sección 6 y espera autorización.

## 1. Problemas encontrados (comprobados en el código)
| # | Problema | Dónde estaba |
|---|---|---|
| 1 | El estado del navegador (`localStorage['relab-kit-feriante']`) no tenía dueño. Al cerrar sesión no se limpiaba: la persona siguiente veía las ventas anteriores y, si ingresaba con una cuenta vacía, **se subían a su cuenta**. | `Kit`, `logout` y `hasData(initial())` |
| 2 | Al iniciar sesión, si la cuenta tenía datos, **reemplazaban** a los del navegador: se perdían las ventas cargadas sin cuenta o sin conexión. | `setSt(normalize(data))` |
| 3 | Sin conexión, `api.me()` fallaba y el kit pasaba a "sin cuenta". En la siguiente carga con red, la versión vieja de la cuenta pisaba la nueva del teléfono. | `api.me().catch → { user: null }` |
| 4 | Cada guardado subía el estado completo y ganaba la última escritura: dos celulares de la misma cuenta se borraban las ventas entre sí. | `PUT` sin conciliar |
| 5 | Los errores de guardado se ignoraban (`.catch(() => {})`) y quedaba "Guardando…" fijo, sin reintento. | efecto de guardado |
| 6 | El doble clic o el Enter repetido en "+ Registrar" cargaba la venta dos veces. | `Tracker.add` |

## 2. Arquitectura de sincronización implementada
Hay dos módulos sin React (se pueden probar): `src/kit/state.js` (la forma del estado y los valores en blanco, que antes estaban en el componente) y **`src/kit/sync.js`** (el motor de guardado). El componente solo se suscribe al motor y le pide cambios.

**En el navegador:**
| Clave | Contenido |
|---|---|
| `relab-kit-feriante:v2` | `{ owner, data, dirty, base }` |
| `relab-kit-feriante:sin-cuenta` | Datos cargados sin cuenta que la persona eligió no sumar a una cuenta |
| `relab-kit-feriante:resguardo:<owner>` | Cambios sin sincronizar de una cuenta que cerró sesión o cambió de persona |
| `relab-kit-feriante` | Formato anterior: se lee una vez para migrar y se borra **solo después** de escribir la copia nueva |

- **`owner`**: la huella SHA-256 del email de la cuenta (no se guarda el email), `null` si son datos sin cuenta o `'legacy'` si vienen del formato anterior.
- **`dirty`**: indica que hay cambios que el servidor todavía no confirmó.
- **`base`**: la última versión conciliada con la cuenta, `{ data, updatedAt, confirmed }`.
  - `updatedAt` es la **versión que pone el servidor** (`resource_state.updated_at`), no la hora del dispositivo.
  - `confirmed` son los ids de las ventas que se vieron en el servidor.

**Al abrir el kit (`start`):**
1. Lee el navegador. Si los datos son de una cuenta, **no los muestra** hasta comprobar la sesión.
2. Consulta `/api/me`.
   - **Sin red:** sigue con lo del dispositivo, avisa "Sin conexión…" y no sube nada hasta comprobar la sesión.
   - **Sin sesión:** si los datos eran de una cuenta, los guarda en el resguardo (si tenían cambios pendientes) y muestra el modo sin cuenta vacío.
   - **Misma cuenta:** sincroniza.
   - **Otra cuenta:** guarda los datos anteriores en el resguardo de su dueño, empieza limpio y, si esta cuenta tiene un resguardo propio, lo recupera.
   - **Datos sin cuenta:**
     - si ya están todos en la cuenta, los adopta sin preguntar;
     - si la persona tocó "Guardar en mi cuenta" desde el kit, los suma;
     - si no, **pregunta**: "Este dispositivo tiene datos cargados sin cuenta (N ventas). ¿Los sumamos a tu cuenta?", con "Sumar a mi cuenta" o "No, dejarlos en este dispositivo".

**Sincronizar (`syncNow`):**
1. `GET` del estado de la cuenta.
2. Conciliación con la política de la sección 4.
3. `PUT` solo si el resultado difiere de lo que tiene la cuenta.
4. Si hubo cambios mientras sincronizaba, se aplican encima y se vuelve a subir.

Se dispara a los 800 ms de cada cambio, al volver la conexión (`online`), al volver a la pestaña y con el botón "Reintentar". Si falla, reintenta solo a los 3, 10, 30 y 60 s.

**Cerrar sesión (`logout`):** intenta subir lo pendiente durante 4 s como máximo.
- Si lo logra, limpia todo lo de esa cuenta en el navegador.
- Si no, lo deja en el resguardo de esa cuenta y avisa: "Tenías cambios sin sincronizar. Quedaron guardados en este dispositivo y se suben solos cuando vuelvas a ingresar."

**Estados visibles**, arriba y en la portada:
- "Guardando…";
- "✓ Guardado en tu cuenta": **solo** después de que el servidor confirmó el `PUT` o que la cuenta ya tenía lo mismo;
- "Sin conexión. Guardado en este dispositivo.";
- "Tu sesión venció. Guardado en este dispositivo.", con "Ingresar";
- "No se pudo sincronizar.", con "Reintentar". Si la causa es el tope de tamaño, se agrega un aviso para descargar el CSV.

**Ventas duplicadas:**
- Cada venta tiene un id estable desde que se crea, así que los reintentos y las conciliaciones no la duplican.
- En el formulario se ignora la misma venta (producto + monto + medio) repetida dentro de 2 s, y un segundo envío con el formulario ya vacío. Así, el doble clic o el Enter repetido no duplican ni muestran un error, y una venta distinta se puede cargar enseguida.

## 3. Archivos modificados
| Archivo | Cambio |
|---|---|
| `src/kit/sync.js` (nuevo) | Motor de guardado: dueño, conciliación, sin conexión, reintentos, resguardo y estados |
| `src/kit/state.js` (nuevo) | `newId`, `blankProduct`, `blankCalc`, `blankRoi`, `normalize`, `hasData` (movidos desde el componente, sin cambios) |
| `src/kit-feriante.jsx` | Usa el motor en lugar de `useState` + `localStorage` + `api.saveState`. Suma el estado de guardado visible, los avisos (pregunta por datos sin cuenta, resguardo, recuperación, tope) y la marca de "ingreso desde el kit". En el tracker, el freno a los duplicados. |
| `src/kit-feriante.css` | Colores de los estados y de los avisos. En celular la barra superior oculta el nombre para que entre el estado y "‹ Recursos" no se parte. |
| `tests/unit/kit-sync.test.js` (nuevo) | 28 pruebas con un servidor y un navegador simulados |
| `CLAUDE.md` | Documenta el motor y sus claves |

**Sin cambios:** `functions/**`, `server/**`, `migrations/**`, `src/lib/api.js`, `LoginModal`, los otros recursos de Relab y la forma del estado en la cuenta.

## 4. Política de resolución de conflictos
Se basa en una conciliación de tres vías entre la última versión conocida (`base`), el dispositivo y la cuenta. Ninguna regla depende del reloj de un dispositivo: la versión la pone el servidor y las ventas se identifican por id.

| Dato | Regla |
|---|---|
| **Ventas** | Se conservan todas las de ambos lados por id. Una venta desaparece **solo** si se borró en este dispositivo (estaba en la última versión conocida y ya no está) o si se borró en otro (el servidor la tuvo, `confirmed`, y ya no la tiene). Una venta que el servidor nunca confirmó no se descarta aunque falte allá: se vuelve a subir. |
| **Checklist** | Por ítem: si cambió en este dispositivo, gana el cambio de acá; si no, el de la cuenta. Así, un estado viejo no deshace marcas nuevas. |
| **Calculadora** | Por campo: cada costo fijo, la comisión, el % digital y la lista de productos (como un todo). Si cambió acá, gana lo de acá; si no, lo de la cuenta. |
| **ROI** | Por campo, con la misma regla. |
| **Mismo campo cambiado en los dos lados** | Gana el dispositivo que sincroniza en ese momento (el que la persona está usando). |
| **Primera vez de un dispositivo con una cuenta** (sin versión conocida) | Se suman las ventas y las marcas; en calculadora y ROI se respeta lo que la cuenta ya tiene y se completa lo vacío con lo del dispositivo. |
| **Datos sin cuenta** | Nunca se asignan a una cuenta sin una acción de la persona (aceptar el aviso o ingresar desde el kit), salvo que ya estén todos en esa cuenta. |
| **Datos de otra cuenta** | Nunca se muestran ni se suben a la cuenta actual. Si tenían cambios pendientes, se guardan aparte y se recuperan cuando vuelve su dueño. |

## 5. Pruebas ejecutadas y resultados
| Suite | Resultado |
|---|---|
| `npm test` · `tests/unit/kit-calc.test.js` (Corrección 1) | ✅ 67/67 |
| `npm test` · `tests/unit/kit-sync.test.js` (nuevo) | ✅ 28/28 |
| `npm run build` | ✅ |
| Navegador · kit completo (regresión) | ✅ 33/33 |
| Navegador · importes (Corrección 1) | ✅ 18/18 |
| Navegador · persistencia (nuevo, contra wrangler + D1 locales, dos cuentas) | ✅ 28/28 |
| Navegador · checklist Cyber Monday (otro recurso, para confirmar que no cambió) | ✅ 23/23 |

Las pruebas en navegador corren contra el servidor local con dos cuentas de prueba y quedaron fuera del repo, igual que en las correcciones anteriores.

**En la suite de regresión del kit cambió una prueba, a propósito.** Antes esperaba que los datos cargados sin cuenta se subieran solos al ingresar. Ahora verifica que el kit **pregunta** y que se suben al tocar "Sumar a mi cuenta" (política nueva).

**Casos que pediste comprobar**
| Caso | Unitarias (servidor simulado) | Navegador (servidor local) |
|---|---|---|
| A inicia y cierra sesión | ✅ | ✅ La vista se limpia y no queda ningún dato de A en el navegador |
| B ingresa en el mismo navegador / no se mezclan | ✅ También si A no cerró sesión y tenía cambios pendientes: B no los ve, y A los recupera al volver | ✅ B no ve ni recibe las ventas de A |
| Ventas sin conexión | ✅ | ✅ Se registran y avisa "Sin conexión. Guardado en este dispositivo." |
| Recuperación de conectividad | ✅ También abriendo el kit sin red | ✅ Sincroniza solo, sin duplicar |
| Ingreso con datos locales pendientes | ✅ Pregunta / suma con "ingreso desde el kit" / "no" los deja en el dispositivo | ✅ Pregunta, no sube nada sin permiso, suma al aceptar |
| Reintentos | ✅ Error 500 dos veces; respuesta perdida después de guardar | ✅ "No se pudo sincronizar. Reintentar" y luego guardado, sin duplicados |
| Recarga durante un guardado | ✅ | ✅ Con el guardado en curso, la venta sigue y queda una sola vez en la cuenta |
| Prevención de duplicados | ✅ Reintentos y conciliaciones idempotentes | ✅ Doble clic y Enter repetido = una venta, sin mensaje de error |
| Estado viejo de la cuenta vs. ventas nuevas | ✅ | — |
| Dos dispositivos de la misma cuenta | ✅ Se suman las ventas | — |
| "Guardado" solo tras confirmar | ✅ | ✅ |
| Compatibilidad con datos existentes | ✅ Migración del formato anterior, estado de la cuenta con la forma de siempre (misma forma al volver a guardar), pestaña vieja escribiendo después de migrar | ✅ Formato anterior que ya está en la cuenta: no pregunta, ve lo mismo y migra a la clave nueva |

## 6. Riesgos pendientes
1. **Carrera entre dos dispositivos en el mismo instante.** La API no tiene control de versión al escribir: entre el `GET` y el `PUT` de un dispositivo (milisegundos), otro puede escribir. Lo que queda:
   - **Ventas:** no se pierden mientras el dispositivo que las cargó vuelva a abrir el kit, porque las que el servidor no confirmó se vuelven a subir.
   - **Ventas borradas:** si se borra una venta en un dispositivo justo en ese instante, puede reaparecer.
   - **Checklist, calculadora y ROI:** en ese instante gana la última escritura.

   **Propuesta (requiere tu autorización, cambia la API):**
   - `PUT /api/state/:resource` acepta `baseUpdatedAt` y responde `409` si la versión del servidor cambió. El motor ya concilia, así que ante un 409 vuelve a leer, concilia y reintenta.
   - El `PUT` devuelve el `updatedAt` nuevo.
   - Es retrocompatible: un `PUT` sin `baseUpdatedAt` se comporta como hoy.
   - Son unas 15 líneas en `functions/api/state/[resource].js` y 3 en `sync.js`, más pruebas. No requiere migración.
2. **Resguardos en el navegador.** Los cambios sin sincronizar de una cuenta quedan en `localStorage` del dispositivo hasta que su dueño vuelve. No se muestran a nadie, pero alguien con acceso técnico al navegador podría leerlos. Es la alternativa a perder esas ventas.
3. **Datos "sin cuenta" que la persona decidió no sumar:** quedan en el dispositivo para usarlos sin cuenta.
4. **Tope de 100.000 caracteres por cuenta** (unas 1.080 ventas): ahora se avisa y los datos quedan en el dispositivo, pero el tope sigue. Es la Etapa 4 de la auditoría.
5. **Pestañas abiertas con la versión anterior** durante el despliegue: si escriben, sus datos se suman al cargar la versión nueva (probado), pero esa pestaña sigue con el comportamiento viejo hasta recargarse.
6. **Identidad del dueño:** es la huella del email de Google. Si una cuenta cambiara de email, el kit la trataría como otra persona, sin pérdida: los datos siguen en la cuenta y se ven al volver a cargar.
7. **El checklist Cyber Monday y la guía** usan el patrón anterior. Quedan fuera de esta corrección, como pediste.

## 7. Instrucciones de despliegue y recuperación
**Despliegue** (cuando lo autorices):
1. Revisar la vista previa de Cloudflare de la rama `fix/kit-feriante-persistencia`. En la vista previa el login no funciona, así que ahí se ve el modo sin cuenta.
2. Integrar en `main` con fast-forward. Incluye la Corrección 1, que tampoco está en `main`.
3. Cloudflare publica solo. **No hay migraciones de base ni secretos nuevos.**
4. Probar en el dominio con tu cuenta:
   - registrar una venta;
   - ver "✓ Guardado en tu cuenta";
   - activar el modo avión, registrar otra y ver "Sin conexión…";
   - desactivar el modo avión y ver que vuelve a "Guardado";
   - abrir el kit en otro dispositivo y ver las dos ventas.

**Qué pasa con los datos existentes al publicar:**
- **En la cuenta:** no cambian. Misma forma, sin migración, y se siguen leyendo igual.
- **En el navegador:** el formato anterior se copia a `relab-kit-feriante:v2`. La clave vieja se borra solo si la copia quedó escrita.
- **Una persona con cuenta cuyo navegador ya coincide con su cuenta** no ve ningún aviso.
- **Datos sin cuenta que no están en la cuenta:** el kit pregunta antes de sumarlos.

**Recuperación:**
- **Volver atrás:** revertir el merge en `main`. La versión anterior lee la cuenta sin problemas, porque es la misma forma. Los datos del navegador en las claves nuevas no los lee: en ese caso, lo que estaba sincronizado se recupera de la cuenta al iniciar sesión.
- **Datos que quedaron en un dispositivo**, por un resguardo o datos sin cuenta: se recuperan ingresando en ese dispositivo con la cuenta correspondiente. En "sin cuenta", siguen visibles en el kit sin iniciar sesión.
- **Respaldo manual:** "Descargar ventas (Excel / CSV)" en Ventas del día.
