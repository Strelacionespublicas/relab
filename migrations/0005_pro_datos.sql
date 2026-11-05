-- Datos de Kit Feriante PRO: ferias, productos, ventas, movimientos de stock y configuración.
-- Migración aditiva: crea una tabla y sus índices; no toca nada existente.
--
-- Una fila por registro, con el contenido CIFRADO en `data` (como el resto de Relab): en claro
-- quedan solo los datos técnicos (de quién es, qué tipo de registro, versión y fechas).
-- El stock es un libro de movimientos: existencias iniciales, reposiciones y ajustes son filas
-- 'stock', y cada venta es una salida. El stock actual se calcula sumando, así dos celulares que
-- venden a la vez nunca se pisan. Nada se borra al instante: deleted_at marca la papelera.
CREATE TABLE pro_rows (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('feria', 'producto', 'venta', 'stock', 'config')),
  id TEXT NOT NULL,                  -- creado en el dispositivo: un reintento no duplica
  version INTEGER NOT NULL,          -- sube en cada cambio; las ediciones la comprueban
  data TEXT NOT NULL,                -- contenido cifrado
  last_op TEXT,                      -- id de la última operación aplicada (reintentos idempotentes)
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,                -- papelera
  PRIMARY KEY (user_id, kind, id)
);
CREATE INDEX pro_rows_cambios ON pro_rows (user_id, updated_at);
