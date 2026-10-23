-- Título para los grupos de hashtags ("Turismo", "Institucional"…).
ALTER TABLE tag_sets ADD COLUMN title TEXT NOT NULL DEFAULT '';
