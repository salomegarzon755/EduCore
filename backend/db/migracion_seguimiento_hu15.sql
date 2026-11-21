-- HU.15 · Seguimiento docente. Migración aditiva e idempotente.
-- No altera ni elimina resultados existentes.
BEGIN;
CREATE TABLE IF NOT EXISTS seguimiento_docente (
  id_seguimiento SERIAL PRIMARY KEY,
  id_docente INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  id_estudiante INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  id_grupo INTEGER NOT NULL REFERENCES grupo(id_grupo) ON DELETE CASCADE,
  estado VARCHAR(20) NOT NULL DEFAULT 'en_progreso'
    CHECK (estado IN ('buen_desempeno','en_progreso','necesita_apoyo')),
  comentario TEXT NOT NULL DEFAULT '',
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id_docente, id_estudiante, id_grupo)
);
CREATE INDEX IF NOT EXISTS idx_seguimiento_estudiante ON seguimiento_docente(id_estudiante);
CREATE INDEX IF NOT EXISTS idx_seguimiento_docente ON seguimiento_docente(id_docente, id_grupo);
COMMIT;
