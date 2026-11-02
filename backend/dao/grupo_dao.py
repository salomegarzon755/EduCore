from config.database import DatabaseConnection
from models.grupo import Grupo

class GrupoDAO:

    @staticmethod
    def crear_grupo(nombre_grupo, grado, descripcion, id_docente, ids_cursos=None):
        conn = DatabaseConnection.get_connection()
        if not conn:
            return None

        try:
            cursor = conn.cursor()

            # 1. Insertar el grupo en la tabla 'grupo'
            query_grupo = """
                INSERT INTO grupo (nombre_grupo, grado, descripcion, id_docente)
                VALUES (%s, %s, %s, %s)
                RETURNING id_grupo;
            """
            cursor.execute(query_grupo, (nombre_grupo, grado, descripcion, id_docente))
            id_grupo = cursor.fetchone()[0]

            # 2. Relacionar en la tabla intermedia 'grupo_curso'
            if ids_cursos and len(ids_cursos) > 0:
                query_curso = """
                    INSERT INTO grupo_curso (id_grupo, id_curso)
                    VALUES (%s, %s);
                """
                for id_curso in ids_cursos:
                    cursor.execute(query_curso, (id_grupo, int(id_curso)))

            conn.commit()
            cursor.close()

            grupo_obj = Grupo(
                id_grupo=id_grupo,
                nombre_grupo=nombre_grupo,
                grado=grado,
                descripcion=descripcion,
                id_docente=id_docente
            )
            resultado = grupo_obj.to_dict()
            resultado["cursos_asociados"] = ids_cursos
            return resultado

        except Exception as e:
            print(f"Error en GrupoDAO.crear_grupo: {e}")
            if conn:
                conn.rollback()
            return None
        finally:
            if conn:
                DatabaseConnection.return_connection(conn)

    @staticmethod
    def obtener_grupos_por_docente(id_docente):
        conn = DatabaseConnection.get_connection()
        if not conn:
            return []

        try:
            cursor = conn.cursor()
            query = """
                SELECT g.id_grupo, g.nombre_grupo, g.grado, g.descripcion,
                    COUNT(DISTINCT eg.id_estudiante) AS total_estudiantes,
                    COUNT(DISTINCT gc.id_curso) AS total_cursos,
                    COALESCE(STRING_AGG(DISTINCT c.titulo_curso, ', '), 'Sin cursos asignados') AS nombres_cursos
                FROM grupo g
                LEFT JOIN estudiante_grupo eg ON g.id_grupo = eg.id_grupo
                LEFT JOIN grupo_curso gc ON g.id_grupo = gc.id_grupo
                LEFT JOIN curso c ON gc.id_curso = c.id_curso
                WHERE g.id_docente = %s
                GROUP BY g.id_grupo, g.nombre_grupo, g.grado, g.descripcion
                ORDER BY g.id_grupo DESC;
            """
            cursor.execute(query, (id_docente,))
            rows = cursor.fetchall()
            cursor.close()

            grupos = []
            for row in rows:
                grupo_obj = Grupo(
                    id_grupo=row[0],
                    nombre_grupo=row[1],
                    grado=row[2] or "Primero",
                    descripcion=row[3] or "",
                    id_docente=id_docente
                )
                grupo_dict = grupo_obj.to_dict()
                grupo_dict["total_estudiantes"] = row[4]
                grupo_dict["total_cursos"] = row[5]
                grupo_dict["nombres_cursos"] = row[6]
                grupos.append(grupo_dict)

            return grupos

        except Exception as e:
            print(f"Error al obtener grupos del docente: {e}")
            return []
        finally:
            if conn:
                DatabaseConnection.return_connection(conn)