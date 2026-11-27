# Estado y pendientes (actualizado: noviembre de 2026)

## Publicado
- Auditoría financiera (noviembre 2026), Fase 1 publicada: horas sin duplicar, comisión fija por venta PRO, tu sueldo en la Calculadora y veredicto del ROI. Fase 2: herramienta Costo y precio. Pendientes Fase 3 (un solo sueldo deseado, nombres claros para los tres "margen", retirado real y plata a acreditar en los sobres, valor del stock) y Fase 4 (tabla de escenarios, "−$0", prueba intermitente de pro-store).
- Kit del feriante gratis (9 herramientas), con las correcciones de importes, guardado y sincronización, "Tu sueldo" en el ROI, el checklist plegable con tareas propias y "Mi sueldo y rentabilidad" (publicado y verificado por Stella en el celular).
- Kit Feriante PRO: Resumen (con Tu sueldo y Primeros pasos), Mis ferias, Mis productos (Importar Excel, favoritos), Ventas PRO (buscador, variantes, aviso de comisión) y Stock.
- Landing `/pro` (gratis 12 meses con Google), códigos de campaña, y el panel `/admin` con registros, contactos y el link "Panel" desde el Kit.
- Aviso de versión nueva y el nombre "Kit del feriante" con bajada turística.
- Migraciones 0001 a 0006 aplicadas en producción.

## Próximos pasos
1. **Piloto con 2 o 3 feriantes de confianza.**
   - Link: `relab.strelacionespublicas.com.ar/pro/?campana=piloto`.
   - Tres mensajes de WhatsApp: la invitación, el link con instrucciones y el pedido de devolución después de la feria.
   - Preguntas para la devolución: si en "Mi sueldo" llegaron hasta los sobres y si entendieron "sueldo objetivo" vs. "sueldo cubierto" (si se pierden: plegar los pasos 1 y 2 completos), qué les costó, cuánto tardaban en registrar una venta, si les sirvió saber cuánto les quedó, qué les faltó y si lo pagarían.
2. **Charla con feriantes:** demo de 20 minutos y registro en vivo con un QR a `/pro/?campana=charla-<mes>`.
3. **Después del piloto, según lo que digan:**
   - etiquetas QR por producto y escáner en Ventas PRO;
   - renombrar "ROI" si no se entiende;
   - revisar si sobran herramientas.
4. **Pendientes de Stella:**
   - verificar que `TEXT_KEY` esté en su gestor de contraseñas;
   - pasar Cloudflare al plan pago (Time Travel de 30 días);
   - revisar las Cache Rules de la zona.
5. **Docs de diseño:** la rama `docs/suscripciones-kit-pro` quedó desactualizada respecto de lo construido (una sola tabla `pro_rows`, stock calculado, la landing en lugar de WooCommerce). Hay que actualizarla si se retoma lo comercial.
6. **Si se decide cobrar:** retomar el diseño de Mercado Pago Suscripciones (Etapa 4a), y antes revisar lo legal (botón de baja, botón de arrepentimiento) y la facturación ante ARCA.
