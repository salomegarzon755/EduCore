-- ============================================================
-- EduCore · Datos de PRUEBA LOCAL (no ejecutar en Neon/producción)
-- Contenido y cuentas mínimas; los resultados se generan desde la API
-- en backend/tests/test_hu32_hu34.py (flujo real de juego).
-- Contraseñas en texto plano: el backend las acepta como registros antiguos.
-- ============================================================
INSERT INTO usuario (id_usuario, nombre, apodo, correo, contrasena, rol, avatar) VALUES
 (101, 'Ana Mosquera',      'ana.docente',  'ana@test.local',   'Clave123', 'Docente',    'kokoi'),
 (102, 'Mariana Palacios',  'mariana',      'mar@test.local',   'Clave123', 'Estudiante', 'tortuga'),
 (103, 'Samuel Córdoba',    'samuel',       'sam@test.local',   'Clave123', 'Estudiante', 'leopardo'),
 (104, 'Valentina Mena',    'valentina',    'val@test.local',   'Clave123', 'Estudiante', 'kokoi'),
 (105, 'Juan Mosquera',     'juan',         'juan@test.local',  'Clave123', 'Estudiante', 'leopardo'),
 (106, 'Pedro Otro',        'pedro.docente','pedro@test.local', 'Clave123', 'Docente',    'kokoi'),
 (107, 'Lucía Ajena',       'lucia',        'lucia@test.local', 'Clave123', 'Estudiante', 'gato');
SELECT setval(pg_get_serial_sequence('usuario','id_usuario'), 107);

INSERT INTO curso (id_curso, titulo_curso, descripcion) VALUES
 (1, 'Exploradores de los números', 'Contar y reconocer números del 1 al 20'),
 (2, 'Matemáticas de segundo', 'Sumas y restas');

INSERT INTO unidad (id_unidad, titulo_unidad, id_curso) VALUES
 (1, 'Números del 1 al 5', 1), (2, 'Números del 6 al 10', 1),
 (3, 'Números del 11 al 15', 1), (4, 'Números del 16 al 20', 1),
 (5, 'Sumas hasta 100', 2);

INSERT INTO actividad (id_actividad, titulo_actividad, tipo_contenido, id_unidad) VALUES
 (1, 'Conteo del 1 al 5', 'actividad', 1),
 (2, 'Conteo del 6 al 10', 'actividad', 2),
 (3, 'Números del 11 al 15', 'actividad', 3),
 (4, 'Números del 16 al 20', 'actividad', 4),
 (5, 'Sumas de decenas', 'actividad', 5),
 (6, 'Teoría: ¿qué es contar?', 'teoria', 1);

-- 5 preguntas por actividad (respuesta correcta siempre A) + 1 punto de teoría (actividad 6)
INSERT INTO preg_punto (id_actividad, enunciado, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta)
SELECT a, 'Pregunta ' || n || ' de la actividad ' || a, 'Correcta', 'Incorrecta 1', 'Incorrecta 2', 'Incorrecta 3', 'A'
FROM generate_series(1,5) a, generate_series(1,5) n ORDER BY a, n;
INSERT INTO preg_punto (id_actividad, enunciado) VALUES (6, 'Contar es decir los números en orden.');

INSERT INTO grupo (id_grupo, nombre_grupo, grado, descripcion, id_docente) VALUES
 (1, 'Primero A', 'Primero', 'Grupo de prueba', 101),
 (2, 'Segundo B', 'Segundo', 'Grupo de otro docente', 106);
SELECT setval(pg_get_serial_sequence('grupo','id_grupo'), 2);
INSERT INTO grupo_curso VALUES (1, 1), (2, 2);
INSERT INTO estudiante_grupo VALUES (1, 102), (1, 103), (1, 104), (1, 105), (2, 107);
