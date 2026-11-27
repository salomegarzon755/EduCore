-- ============================================================
-- EduCore · Esquema base SOLO PARA PRUEBAS LOCALES
-- Reconstruido a partir de las consultas del backend (el volcado real
-- de Neon no está en el repositorio). NO ejecutar en Neon/producción.
-- Después de este archivo se aplican las migraciones de backend/db/ en orden.
-- ============================================================
CREATE TABLE usuario (
  id_usuario SERIAL PRIMARY KEY,
  nombre     VARCHAR(200) NOT NULL,
  apodo      VARCHAR(100) NOT NULL,
  correo     VARCHAR(254),
  contrasena VARCHAR(255) NOT NULL,
  rol        VARCHAR(30) NOT NULL CHECK (rol IN ('Estudiante','Docente'))
);
CREATE TABLE curso (
  id_curso SERIAL PRIMARY KEY,
  titulo_curso VARCHAR(200) NOT NULL,
  descripcion TEXT
);
CREATE TABLE unidad (
  id_unidad SERIAL PRIMARY KEY,
  titulo_unidad VARCHAR(200) NOT NULL,
  id_curso INTEGER NOT NULL REFERENCES curso(id_curso)
);
CREATE TABLE actividad (
  id_actividad SERIAL PRIMARY KEY,
  titulo_actividad VARCHAR(200) NOT NULL,
  tipo_contenido VARCHAR(50),
  id_unidad INTEGER NOT NULL REFERENCES unidad(id_unidad)
);
CREATE TABLE preg_punto (
  id_punto SERIAL PRIMARY KEY,
  id_actividad INTEGER NOT NULL REFERENCES actividad(id_actividad),
  enunciado TEXT NOT NULL,
  opcion_a TEXT, opcion_b TEXT, opcion_c TEXT, opcion_d TEXT,
  respuesta_correcta CHAR(1)
);
CREATE TABLE grupo (
  id_grupo SERIAL PRIMARY KEY,
  nombre_grupo VARCHAR(100) NOT NULL,
  grado VARCHAR(20),
  descripcion TEXT,
  id_docente INTEGER REFERENCES usuario(id_usuario)
);
CREATE TABLE estudiante_grupo (
  id_grupo INTEGER NOT NULL REFERENCES grupo(id_grupo),
  id_estudiante INTEGER NOT NULL REFERENCES usuario(id_usuario),
  PRIMARY KEY (id_grupo, id_estudiante)
);
CREATE TABLE grupo_curso (
  id_grupo INTEGER NOT NULL REFERENCES grupo(id_grupo),
  id_curso INTEGER NOT NULL REFERENCES curso(id_curso),
  PRIMARY KEY (id_grupo, id_curso)
);
