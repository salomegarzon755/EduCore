-- Ejecutar SOLO en rama Neon hu15-pruebas. Migración aditiva.
BEGIN;
CREATE TABLE IF NOT EXISTS intento_actividad (
 id_intento BIGSERIAL PRIMARY KEY,
 id_estudiante INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
 id_actividad INTEGER NOT NULL REFERENCES actividad(id_actividad) ON DELETE CASCADE,
 numero_intento INTEGER NOT NULL,
 aciertos INTEGER NOT NULL,
 total INTEGER NOT NULL,
 estrellas SMALLINT NOT NULL,
 semaforo VARCHAR(10),
 fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(id_estudiante,id_actividad,numero_intento)
);
CREATE INDEX IF NOT EXISTS idx_intento_actividad_est ON intento_actividad(id_estudiante,id_actividad);
-- La tabla antigua se conserva para compatibilidad y progreso. Su fila existente
-- se importa como un intento histórico conocido; intentos anteriores NO pueden reconstruirse
-- fielmente a partir de la fila resumida.
INSERT INTO intento_actividad(id_estudiante,id_actividad,numero_intento,aciertos,total,estrellas,semaforo,fecha)
SELECT id_estudiante,id_actividad,GREATEST(1,intentos),aciertos,total,estrellas,
 CASE WHEN total=0 THEN NULL WHEN aciertos::numeric/total>=0.8 THEN 'verde'
 WHEN aciertos::numeric/total>=0.6 THEN 'amarillo' ELSE 'rojo' END,fecha
FROM resultado_actividad
ON CONFLICT(id_estudiante,id_actividad,numero_intento) DO NOTHING;
CREATE TABLE IF NOT EXISTS comentario_actividad (
 id_comentario BIGSERIAL PRIMARY KEY,
 id_docente INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
 id_estudiante INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
 id_grupo INTEGER NOT NULL REFERENCES grupo(id_grupo) ON DELETE CASCADE,
 id_actividad INTEGER NOT NULL REFERENCES actividad(id_actividad) ON DELETE CASCADE,
 comentario TEXT NOT NULL DEFAULT '',
 actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(id_docente,id_estudiante,id_grupo,id_actividad)
);
CREATE INDEX IF NOT EXISTS idx_comentario_actividad_est ON comentario_actividad(id_estudiante,id_actividad);
COMMIT;
