-- Acceso PRO por códigos (Kit Feriante PRO, lanzamiento gratis). Migración aditiva: solo crea tablas.
-- No guarda contenido de nadie: códigos (solo su hash), canjes y permisos con fechas.

-- Códigos por campaña ("Lanzamiento", "Charla nov 2026", "Municipio X"). El código en texto se ve
-- una sola vez, al crearlo en el panel; acá queda solo su SHA-256.
CREATE TABLE access_codes (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  product TEXT NOT NULL DEFAULT 'kit-feriante-pro',
  days INTEGER NOT NULL DEFAULT 365,
  redeem_until INTEGER,               -- NULL = sin fecha límite de canje
  max_uses INTEGER NOT NULL,
  uses INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

-- Un canje por persona y código. entitlement_id une el canje con el permiso que generó
-- (así el canje, la suma del uso y el permiso se hacen juntos y una sola vez).
CREATE TABLE redemptions (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_id TEXT NOT NULL REFERENCES access_codes(id),
  entitlement_id TEXT NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (user_id, code_id)
);

-- La única fuente de "¿tiene PRO?": un permiso activo con starts_at <= ahora < ends_at.
CREATE TABLE entitlements (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  product TEXT NOT NULL,
  source TEXT NOT NULL,               -- 'code' (más adelante: 'subscription', 'manual')
  ref TEXT,                           -- id del código o de la suscripción
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX entitlements_vigentes ON entitlements (user_id, product, ends_at);

-- Qué se hizo en el panel de administración (sin contenido de usuarios).
CREATE TABLE admin_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  at INTEGER NOT NULL
);
