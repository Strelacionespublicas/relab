-- Registro a Kit Feriante PRO (lanzamiento gratis): datos de contacto que la persona deja al
-- activar PRO desde /pro. Migración aditiva: crea una tabla; no toca nada existente.
-- Nombre y email ya están en users (login con Google). El WhatsApp va cifrado; localidad, rubro y
-- campaña en claro para poder contar. Solo se exporta a quien aceptó recibir novedades.
CREATE TABLE pro_registros (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  whatsapp TEXT,                     -- cifrado
  localidad TEXT,
  rubro TEXT,
  ferias_mes TEXT,                   -- "1", "2-3", "4+", "ocasional"
  acepta_novedades INTEGER NOT NULL DEFAULT 0,
  campana TEXT,                      -- de dónde vino (?campana=charla-nov)
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
