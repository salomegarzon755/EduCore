-- ============================================================
-- EduCore · Un estudiante NO puede estar en dos grupos con el mismo curso
-- Idempotente: se puede ejecutar varias veces.
--   psql -d educore_db -f backend/db/migracion_curso_unico_por_estudiante.sql
--
-- La API (GrupoDAO) ya valida esta regla y devuelve un mensaje claro; estos
-- triggers son la red de seguridad por si alguien inserta directo en la BD
-- (pgAdmin, scripts, otro servicio).
-- ============================================================

-- 0) Diagnóstico previo: estudiantes que HOY ya incumplen la regla (debería devolver 0 filas).
--    SELECT eg.id_estudiante, gc.id_curso, ARRAY_AGG(eg.id_grupo) AS grupos
--    FROM estudiante_grupo eg
--    JOIN grupo_curso gc ON gc.id_grupo = eg.id_grupo
--    GROUP BY eg.id_estudiante, gc.id_curso
--    HAVING COUNT(DISTINCT eg.id_grupo) > 1;

BEGIN;

-- 1) Al inscribir a un estudiante en un grupo
CREATE OR REPLACE FUNCTION fn_curso_unico_al_inscribir() RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM estudiante_grupo eg
    JOIN grupo_curso gc  ON gc.id_grupo = eg.id_grupo
    JOIN grupo_curso gco ON gco.id_curso = gc.id_curso AND gco.id_grupo = NEW.id_grupo
    WHERE eg.id_estudiante = NEW.id_estudiante
      AND eg.id_grupo <> NEW.id_grupo
  ) THEN
    RAISE EXCEPTION 'El estudiante % ya está en otro grupo que tiene el mismo curso; debe salir de ese grupo primero.',
      NEW.id_estudiante USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_curso_unico_al_inscribir ON estudiante_grupo;
CREATE TRIGGER trg_curso_unico_al_inscribir
  BEFORE INSERT OR UPDATE OF id_estudiante, id_grupo ON estudiante_grupo
  FOR EACH ROW EXECUTE FUNCTION fn_curso_unico_al_inscribir();

-- 2) Al asignar un curso a un grupo que ya tiene estudiantes
CREATE OR REPLACE FUNCTION fn_curso_unico_al_asignar_curso() RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM estudiante_grupo eg
    JOIN estudiante_grupo eg_otro
      ON eg_otro.id_estudiante = eg.id_estudiante AND eg_otro.id_grupo <> eg.id_grupo
    JOIN grupo_curso gc ON gc.id_grupo = eg_otro.id_grupo AND gc.id_curso = NEW.id_curso
    WHERE eg.id_grupo = NEW.id_grupo
  ) THEN
    RAISE EXCEPTION 'No se puede asignar el curso % al grupo %: hay estudiantes del grupo que ya lo tienen en otro grupo.',
      NEW.id_curso, NEW.id_grupo USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_curso_unico_al_asignar_curso ON grupo_curso;
CREATE TRIGGER trg_curso_unico_al_asignar_curso
  BEFORE INSERT OR UPDATE OF id_grupo, id_curso ON grupo_curso
  FOR EACH ROW EXECUTE FUNCTION fn_curso_unico_al_asignar_curso();

COMMIT;

-- Nota sobre el progreso: resultado_actividad / respuesta_estudiante se guardan por
-- (estudiante, actividad), NO por grupo. Salir de un grupo solo borra la fila de
-- estudiante_grupo, así que el avance se conserva y reaparece al entrar a otro grupo
-- que tenga el mismo curso.
