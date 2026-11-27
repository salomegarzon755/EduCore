-- ============================================================
-- EduCore · Sprint 3 · HU.32, HU.33 y HU.34
--   HU.32 Mensajes de felicitación al terminar un reto (Estudiante)
--   HU.33 Ver resultados de las actividades del hijo (Familia)
--   HU.34 Ver progreso del curso por estudiante (Docente)
--
-- Migración ADITIVA e idempotente: se puede ejecutar varias veces.
-- No borra ni modifica datos existentes (solo crea una tabla nueva,
-- inserta mensajes si faltan y agrega índices de consulta).
--   psql "$DATABASE_URL" -f backend/db/migracion_hu32_hu34_progreso.sql
-- Requisitos previos: migracion_actividades.sql y migracion_hu15_intentos.sql
-- ============================================================
BEGIN;

-- HU.32 · Mensajes de felicitación administrables desde la base de datos.
--   sin_errores        -> el estudiante respondió todo bien
--   puntaje_alto       -> 80 % o más (la misma regla del semáforo verde)
--   seguir_practicando -> por debajo del 80 %: se muestra la puntuación y se anima a practicar
--
CREATE TABLE IF NOT EXISTS mensaje_felicitacion (
  id_mensaje SERIAL PRIMARY KEY,
  tipo       VARCHAR(20)  NOT NULL CHECK (tipo IN ('sin_errores', 'puntaje_alto', 'seguir_practicando')),
  titulo     VARCHAR(120) NOT NULL,
  mensaje    VARCHAR(300) NOT NULL,
  activo     BOOLEAN      NOT NULL DEFAULT TRUE,
  creado_en  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (tipo, titulo)
);

INSERT INTO mensaje_felicitacion (tipo, titulo, mensaje) VALUES
  ('sin_errores',        '¡Excelente trabajo!',    '¡Sigue explorando y aprendiendo!'),
  ('sin_errores',        '¡Lo hiciste perfecto!',  'Cada respuesta fue correcta. ¡Eres un gran explorador!'),
  ('sin_errores',        '¡Increíble!',            'Resolviste todo el reto sin equivocarte. ¡Qué orgullo!'),
  ('puntaje_alto',       '¡Muy buen trabajo!',     'Casi todo te salió bien. ¡Sigue así!'),
  ('puntaje_alto',       '¡Lo lograste!',          'Tu esfuerzo se nota. ¡Vas por muy buen camino!'),
  ('seguir_practicando', 'Resultado del reto',     'Practicar te ayuda a aprender. ¡Puedes volver a intentarlo cuando quieras!'),
  ('seguir_practicando', '¡Sigue practicando!',    'Cada intento te hace más fuerte. ¡Inténtalo otra vez!')
ON CONFLICT (tipo, titulo) DO NOTHING;

-- Índices para las consultas de progreso (HU.33 y HU.34). Solo aceleran lecturas.
CREATE INDEX IF NOT EXISTS idx_resultado_act_est   ON resultado_actividad (id_actividad, id_estudiante);
CREATE INDEX IF NOT EXISTS idx_estudiante_grupo_est ON estudiante_grupo (id_estudiante);
CREATE INDEX IF NOT EXISTS idx_grupo_curso_curso    ON grupo_curso (id_curso);
CREATE INDEX IF NOT EXISTS idx_actividad_unidad     ON actividad (id_unidad);
CREATE INDEX IF NOT EXISTS idx_unidad_curso         ON unidad (id_curso);
CREATE INDEX IF NOT EXISTS idx_grupo_docente        ON grupo (id_docente);

COMMIT;

-- Verificación:
--   SELECT tipo, COUNT(*) FROM mensaje_felicitacion WHERE activo GROUP BY tipo;
