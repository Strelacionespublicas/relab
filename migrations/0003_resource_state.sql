-- Avance de cada persona en cada recurso (checklists, etc.), cifrado como el resto del contenido.
CREATE TABLE resource_state (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, resource)
);
