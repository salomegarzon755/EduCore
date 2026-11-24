-- ============================================================
-- EduCore · HU.23 Crear curso predefinido (rol Administrador)
-- Migración ADITIVA e idempotente: se puede ejecutar varias veces.
-- Ejecutar primero en una rama de pruebas de Neon:
--   psql "$DATABASE_URL" -f backend/db/migracion_hu23_cursos_admin.sql
--
-- Qué hace:
--   1) Agrega la columna curso.grado (1 o 2) y rellena los cursos existentes
--      (id 1 → 1.°, id 2 → 2.°, igual que hoy lo deduce el frontend).
--   2) Permite el rol 'Administrador' en usuario.rol (si la columna tiene un
--      CHECK o es un ENUM, se amplía conservando los valores ya usados).
--   3) Crea una cuenta de administrador de DEMOSTRACIÓN (cambia la contraseña).
-- No borra ni modifica datos existentes fuera de rellenar curso.grado vacío.
-- ============================================================

-- ---------- Parte 1: estructura ----------
BEGIN;

ALTER TABLE curso ADD COLUMN IF NOT EXISTS grado SMALLINT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'curso'::regclass AND conname = 'ck_curso_grado') THEN
    ALTER TABLE curso ADD CONSTRAINT ck_curso_grado CHECK (grado IN (1, 2));
  END IF;
END $$;

UPDATE curso SET grado = 1 WHERE id_curso = 1 AND grado IS NULL;
UPDATE curso SET grado = 2 WHERE id_curso = 2 AND grado IS NULL;

-- Sincroniza el contador de id_curso: los cursos existentes se insertaron con id fijo
-- y el contador quedó atrasado (provocaba "duplicate key ... curso_pkey" al crear un curso).
SELECT setval(pg_get_serial_sequence('curso', 'id_curso'),
              GREATEST((SELECT COALESCE(MAX(id_curso), 0) FROM curso), 1));

-- Rol Administrador en usuario.rol
DO $$
DECLARE
  v_tipo    text;
  v_udt     text;
  r         record;
  v_valores text;
BEGIN
  SELECT data_type, udt_name INTO v_tipo, v_udt
  FROM information_schema.columns
  WHERE table_schema = current_schema() AND table_name = 'usuario' AND column_name = 'rol';

  -- a) Si rol es un ENUM, se agrega el valor
  IF v_tipo = 'USER-DEFINED' THEN
    EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', v_udt, 'Administrador');
  END IF;

  -- b) Si hay un CHECK sobre rol que no admite 'Administrador', se amplía
  FOR r IN
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = 'usuario'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%rol%'
  LOOP
    IF r.def NOT LIKE '%Administrador%' THEN
      SELECT string_agg(DISTINCT quote_literal(v.rol), ', ') INTO v_valores
      FROM (SELECT rol::text AS rol FROM usuario WHERE rol IS NOT NULL
            UNION SELECT unnest(ARRAY['Estudiante', 'Docente', 'Administrador'])) v;
      EXECUTE format('ALTER TABLE usuario DROP CONSTRAINT %I', r.conname);
      EXECUTE format('ALTER TABLE usuario ADD CONSTRAINT %I CHECK (rol::text IN (%s))', r.conname, v_valores);
      RAISE NOTICE 'Restricción % ampliada para admitir Administrador', r.conname;
    END IF;
  END LOOP;
END $$;

COMMIT;

-- ---------- Parte 2: cuenta de administrador de demostración ----------
-- Usuario: admin.educore · Contraseña: Admin.Educore2026  (CÁMBIALA después de probar)
BEGIN;
INSERT INTO usuario (nombre, apodo, correo, contrasena, rol)
SELECT 'Carlos Rivas', 'admin.educore', 'admin@educore.local', 'Admin.Educore2026', 'Administrador'
WHERE NOT EXISTS (SELECT 1 FROM usuario WHERE apodo = 'admin.educore');
COMMIT;

-- Verificación rápida:
--   SELECT id_curso, titulo_curso, grado FROM curso ORDER BY id_curso;
--   SELECT id_usuario, nombre, apodo, rol FROM usuario WHERE rol = 'Administrador';
