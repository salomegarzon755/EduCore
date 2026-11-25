-- ============================================================
-- EduCore · HU.28 Crear actividades interactivas en una unidad
-- Migración idempotente: solo sincroniza contadores (no cambia datos).
--   psql "$DATABASE_URL" -f backend/db/migracion_hu28_contadores.sql
--
-- Las unidades, actividades y preguntas iniciales se insertaron con id fijo,
-- igual que los cursos (ver migracion_hu23_cursos_admin.sql). Si el contador
-- quedó atrasado, crear una unidad o actividad nueva fallaría con
-- "duplicate key". Esto lo pone al día con el id más alto existente.
-- ============================================================
SELECT setval(pg_get_serial_sequence('unidad', 'id_unidad'),
              GREATEST((SELECT COALESCE(MAX(id_unidad), 0) FROM unidad), 1));
SELECT setval(pg_get_serial_sequence('actividad', 'id_actividad'),
              GREATEST((SELECT COALESCE(MAX(id_actividad), 0) FROM actividad), 1));
SELECT setval(pg_get_serial_sequence('preg_punto', 'id_punto'),
              GREATEST((SELECT COALESCE(MAX(id_punto), 0) FROM preg_punto), 1));
