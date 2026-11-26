# Kit del feriante y Kit Feriante PRO

## Nombre y público
El kit se llama "**Kit del feriante**", con la bajada "Para ferias turísticas, fiestas regionales, festivales, mercados y expos". Fue decisión de Stella: un título amplio para no excluir a nadie, y lo turístico en la bajada, porque es su nicho y su puerta de entrada con municipios. El caso de ejemplo en todas las herramientas es **Rosa, tejedora de Belén**, que vende en el Festival del Poncho.

## Gratis (7 herramientas, nunca se recortan)
- **Antes de la feria:** Checklist, Calculadora (se puede cargar con los números de Rosa) y Cobros.
- **Durante:** Pitch y ventas, Visitantes y Ventas del día (simple, con descarga CSV).
- **Después:** ROI post feria. Trae las ventas del tracker e incluye "Tu sueldo": ganancia por jornada y por hora, porcentaje del sueldo cubierto y lo que le queda o le falta al negocio.

Funciona sin cuenta. Con Google se guarda en la cuenta y en varios dispositivos.

## PRO (grupo "Kit PRO")
- **Resumen:**
  - "Te quedó $…", cobrado, comisiones, mercadería y gastos;
  - comparación entre ferias, lo que más se vende y el producto de mejor margen, cómo te pagan, alerta de stock;
  - **Tu sueldo**, por mes o por jornada, con horas opcionales: porcentaje cubierto y "después de pagarte, al negocio le quedan / le faltan";
  - la guía "Empezá en 3 pasos" para cuentas nuevas;
  - filtros: este mes, 3 meses, este año o todo.
- **Mis ferias:** nombre, lugar, fechas, gastos y jornadas trabajadas (si no se cargan, se cuentan por las fechas). Feria activa. Cada feria muestra su resultado y "por jornada", con la etiqueta de sueldo cubierto.
- **Mis productos:**
  - carga manual o **Importar desde Excel, CSV o filas pegadas**: plantilla, vista previa, el mismo nombre actualiza en lugar de duplicar, y la columna Stock carga o ajusta existencias;
  - variantes, aviso de stock bajo y ⭐ favoritos.
- **Ventas PRO:**
  - el formulario va arriba, con los productos ordenados por favoritos y más vendidos;
  - buscador: Enter suma el producto si queda uno solo;
  - al tocar un producto con variantes, pregunta cuál;
  - cantidades, descuento en $ o %, medio de pago y comisiones por medio, con aviso si falta cargarla;
  - editar, borrar a la papelera y exportar CSV.
- **Stock:** existencias, reponer y ajustar. Cada venta descuenta sola.
- Con PRO activo, "Ventas del día" aparece como "(simple)" y avisa que existe Ventas PRO.

## Modelo de acceso vigente
- **Lanzamiento gratis por 12 meses, sin cobros.** La entrada es **`/pro`**: la persona entra con Google, completa localidad, rubro, WhatsApp opcional, ferias por mes y la casilla de novedades (viene sin marcar), y queda con PRO por 365 días, una sola vez por persona.
- **`?campana=`** (por ejemplo `/pro/?campana=piloto`) registra de dónde vino cada persona, y se ve en el panel.
- **Códigos de campaña** (`FERIA-XXXX-XXXX`): siguen existiendo, para instituciones o capacitaciones. Se crean en `/admin` con cupo, días y fecha límite. El link para el mail es `/kit-feriante/?codigo=…`.
- **La invitación a PRO es visible para todos:** aviso en el Kit, tarjeta en la vitrina y botón "PRO gratis".
- **Los cobros automáticos están diseñados, pero postergados.** La idea es Mercado Pago Suscripciones manejado desde RELAB, con pedidos en WooCommerce como opción. El diseño está en la rama `docs/suscripciones-kit-pro` (`docs/suscripciones/`).
  - Lo verificado: el plugin oficial de MP no funciona con WooCommerce Subscriptions, Payway trabaja por lotes con archivos TXT y GoCuotas no hace cobros recurrentes.
  - Si algún día se cobra: Etapa 4a (cobro y acceso) y 4b (pedidos en Woo, solo si la facturación sale de Woo).

## Panel `/admin` (solo Stella)
- Se entra con el link "Panel" del Kit, que solo ve quien es admin.
- **Muestra:** cuántas personas se registraron, cuántas aceptaron novedades, cuántas cuentas PRO tienen productos y cuántas tienen ventas, por campaña y por rubro.
- **Descargar contactos (CSV):** solo de quienes aceptaron novedades, y cada descarga queda registrada en `admin_audit`.
- **Códigos:** crear, desactivar y reactivar.
- Nunca muestra ventas, productos ni datos cargados.
