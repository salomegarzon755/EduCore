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

    @staticmethod
    def obtener_detalle_grupo(id_grupo):
        conn = DatabaseConnection.get_connection()
        if not conn:
            return None
        try:
            cursor = conn.cursor()
            query = """
                SELECT g.id_grupo, g.nombre_grupo, g.grado, g.descripcion, g.id_docente
                FROM grupo g
                WHERE g.id_grupo = %s;
            """
            cursor.execute(query, (id_grupo,))
            row = cursor.fetchone()
            cursor.close()

            if not row:
                return None

            return {
                "id_grupo": row[0],
                "nombre_grupo": row[1],
                "grado": row[2] or "Primero",
                "descripcion": row[3] or "",
                "id_docente": row[4],
                "codigo_clase": f"AC-{row[0] + 100}"
            }
        except Exception as e:
            print(f"Error al obtener detalle del grupo: {e}")
            return None
        finally:
            if conn:
                DatabaseConnection.return_connection(conn)

    @staticmethod
    def obtener_estudiantes_del_grupo(id_grupo):
        conn = DatabaseConnection.get_connection()
        if not conn:
            return []
        try:
            cursor = conn.cursor()
            query = """
                SELECT u.id_usuario, u.nombre, u.apodo, u.correo
                FROM usuario u
                JOIN estudiante_grupo eg ON u.id_usuario = eg.id_estudiante
                WHERE eg.id_grupo = %s
                ORDER BY u.nombre ASC;
            """
            cursor.execute(query, (id_grupo,))
            rows = cursor.fetchall()
            cursor.close()

            return [
                {
                    "id_estudiante": r[0],
                    "nombre": r[1],
                    "apodo": r[2],
                    "correo": r[3]
                } for r in rows
            ]
        except Exception as e:
            print(f"Error al obtener estudiantes del grupo: {e}")
            return []
        finally:
            if conn:
                DatabaseConnection.return_connection(conn)

    @staticmethod
    def buscar_estudiantes_para_grupo(query_texto, id_grupo):
        conn = DatabaseConnection.get_connection()
        if not conn:
            return []
        try:
            cursor = conn.cursor()
            query = """
                SELECT u.id_usuario, u.nombre, u.apodo,
                       CASE WHEN eg.id_grupo IS NOT NULL THEN TRUE ELSE FALSE END AS en_grupo
                FROM usuario u
                LEFT JOIN estudiante_grupo eg ON u.id_usuario = eg.id_estudiante AND eg.id_grupo = %s
                WHERE u.rol = 'Estudiante'
                  AND (LOWER(u.nombre) LIKE %s OR LOWER(u.apodo) LIKE %s)
                ORDER BY u.nombre ASC
                LIMIT 15;
            """
            param_search = f"%{query_texto.lower()}%"
            cursor.execute(query, (id_grupo, param_search, param_search))
            rows = cursor.fetchall()
            cursor.close()

            return [
                {
                    "id_estudiante": r[0],
                    "nombre": r[1],
                    "apodo": r[2],
                    "en_grupo": r[3]
                } for r in rows
            ]
        except Exception as e:
            print(f"Error buscando estudiantes: {e}")
            return []
        finally:
            if conn:
                DatabaseConnection.return_connection(conn)

    @staticmethod
    def agregar_estudiante_a_grupo(id_grupo, id_estudiante):
        conn = DatabaseConnection.get_connection()
        if not conn:
            return {"success": False, "message": "Error de conexión a la BD"}
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT 1 FROM estudiante_grupo WHERE id_grupo = %s AND id_estudiante = %s;",
                (id_grupo, id_estudiante)
            )
            if cursor.fetchone():
                cursor.close()
                return {"success": False, "codigo": "DUPLICADO", "message": "Este estudiante ya forma parte del grupo"}

            cursor.execute(
                "INSERT INTO estudiante_grupo (id_grupo, id_estudiante) VALUES (%s, %s);",
                (id_grupo, id_estudiante)
            )
            conn.commit()
            cursor.close()
            return {"success": True, "message": "Estudiante agregado con éxito"}
        except Exception as e:
            print(f"Error al asociar estudiante al grupo: {e}")
            if conn:
                conn.rollback()
            return {"success": False, "message": str(e)}
        finally:
            if conn:
                DatabaseConnection.return_connection(conn)