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
            query_grupo = """
                INSERT INTO grupo (nombre_grupo, grado, descripcion, id_docente)
                VALUES (%s, %s, %s, %s)
                RETURNING id_grupo;
            """
            cursor.execute(query_grupo, (nombre_grupo, grado, descripcion, id_docente))
            id_grupo = cursor.fetchone()[0]

            if ids_cursos and len(ids_cursos) > 0:
                query_curso = "INSERT INTO grupo_curso (id_grupo, id_curso) VALUES (%s, %s);"
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
            res = grupo_obj.to_dict()
            res["cursos_asociados"] = ids_cursos
            return res

        except Exception as e:
            print(f"Error en GrupoDAO.crear_grupo: {e}")
            if conn: conn.rollback()
            return None
        finally:
            if conn: DatabaseConnection.return_connection(conn)

    @staticmethod
    def obtener_grupos_por_docente(id_docente):
        conn = DatabaseConnection.get_connection()
        if not conn: return []

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
                g_dict = grupo_obj.to_dict()
                g_dict["total_estudiantes"] = row[4]
                g_dict["total_cursos"] = row[5]
                g_dict["nombres_cursos"] = row[6]
                grupos.append(g_dict)

            return grupos
        except Exception as e:
            print(f"Error al obtener grupos del docente: {e}")
            return []
        finally:
            if conn: DatabaseConnection.return_connection(conn)

    @staticmethod
    def obtener_grupos_por_estudiante(id_estudiante):
        """Obtiene los grupos en los que está inscrito un estudiante directamente desde PostgreSQL."""
        conn = DatabaseConnection.get_connection()
        if not conn: return []

        try:
            cursor = conn.cursor()
            query = """
                SELECT g.id_grupo, g.nombre_grupo, g.grado, g.descripcion,
                    COUNT(DISTINCT eg2.id_estudiante) AS total_estudiantes,
                    COUNT(DISTINCT gc.id_curso) AS total_cursos,
                    COALESCE(STRING_AGG(DISTINCT c.titulo_curso, ', '), 'Sin cursos asignados') AS nombres_cursos
                FROM grupo g
                JOIN estudiante_grupo eg ON g.id_grupo = eg.id_grupo
                LEFT JOIN estudiante_grupo eg2 ON g.id_grupo = eg2.id_grupo
                LEFT JOIN grupo_curso gc ON g.id_grupo = gc.id_grupo
                LEFT JOIN curso c ON gc.id_curso = c.id_curso
                WHERE eg.id_estudiante = %s
                GROUP BY g.id_grupo, g.nombre_grupo, g.grado, g.descripcion
                ORDER BY g.id_grupo DESC;
            """
            cursor.execute(query, (id_estudiante,))
            rows = cursor.fetchall()
            cursor.close()

            grupos = []
            for row in rows:
                grupo_obj = Grupo(
                    id_grupo=row[0],
                    nombre_grupo=row[1],
                    grado=row[2] or "Primero",
                    descripcion=row[3] or "",
                    id_docente=0
                )
                g_dict = grupo_obj.to_dict()
                g_dict["total_estudiantes"] = row[4] or 0
                g_dict["total_cursos"] = row[5] or 0
                g_dict["nombres_cursos"] = row[6] or "Sin cursos asignados"
                g_dict["codigo_clase"] = f"AC-{row[0] + 100}"
                grupos.append(g_dict)

            return grupos
        except Exception as e:
            print(f"Error en GrupoDAO.obtener_grupos_por_estudiante: {e}")
            return []
        finally:
            if conn: DatabaseConnection.return_connection(conn)

    @staticmethod
    def obtener_cursos_por_estudiante(id_estudiante):
        """Obtiene los cursos asignados a los grupos del estudiante y cuenta sus actividades reales."""
        conn = DatabaseConnection.get_connection()
        if not conn: return []
        try:
            cursor = conn.cursor()
            query = """
                SELECT c.id_curso, c.titulo_curso, c.descripcion,
                       COUNT(DISTINCT a.id_actividad) AS total_actividades,
                       STRING_AGG(DISTINCT g.nombre_grupo, ', ') AS nombres_grupos
                FROM curso c
                JOIN grupo_curso gc ON c.id_curso = gc.id_curso
                JOIN estudiante_grupo eg ON gc.id_grupo = eg.id_grupo
                JOIN grupo g ON g.id_grupo = gc.id_grupo
                LEFT JOIN unidad u ON c.id_curso = u.id_curso
                LEFT JOIN actividad a ON u.id_unidad = a.id_unidad
                WHERE eg.id_estudiante = %s
                GROUP BY c.id_curso, c.titulo_curso, c.descripcion
                ORDER BY c.id_curso ASC;
            """
            cursor.execute(query, (id_estudiante,))
            rows = cursor.fetchall()
            cursor.close()

            cursos = []
            for r in rows:
                cursos.append({
                    "id_curso": r[0],
                    "titulo_curso": r[1],
                    "descripcion": r[2] or "",
                    "total_actividades": r[3] or 0,
                    "actividades_completadas": 0,
                    "nombres_grupos": r[4] or ""
                })
            return cursos
        except Exception as e:
            print(f"Error en GrupoDAO.obtener_cursos_por_estudiante: {e}")
            return []
        finally:
            if conn: DatabaseConnection.return_connection(conn)

    @staticmethod
    def obtener_detalle_grupo(id_grupo):
        conn = DatabaseConnection.get_connection()
        if not conn: return None
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT id_grupo, nombre_grupo, grado, descripcion, id_docente FROM grupo WHERE id_grupo = %s;", (id_grupo,))
            row = cursor.fetchone()
            cursor.close()
            if not row: return None

            return {
                "id_grupo": row[0],
                "nombre_grupo": row[1],
                "grado": row[2] or "Primero",
                "descripcion": row[3] or "",
                "id_docente": row[4],
                "codigo_clase": f"AC-{row[0] + 100}"
            }
        except Exception as e:
            print(f"Error detalle grupo: {e}")
            return None
        finally:
            if conn: DatabaseConnection.return_connection(conn)

    @staticmethod
    def obtener_estudiantes_del_grupo(id_grupo):
        """Estudiantes del grupo con su progreso en cada curso del grupo.

        El progreso vive en resultado_actividad (por estudiante y actividad), no en el grupo:
        por eso un estudiante que llega desde otro grupo con el mismo curso conserva su avance.
        """
        conn = DatabaseConnection.get_connection()
        if not conn: return []
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT u.id_usuario, u.nombre, u.apodo, u.correo
                FROM usuario u
                JOIN estudiante_grupo eg ON u.id_usuario = eg.id_estudiante
                WHERE eg.id_grupo = %s
                ORDER BY u.nombre ASC;
            """, (id_grupo,))
            rows = cursor.fetchall()

            cursor.execute("""
                SELECT eg.id_estudiante, c.id_curso, c.titulo_curso,
                    (SELECT COUNT(*) FROM actividad a
                       JOIN unidad un ON un.id_unidad = a.id_unidad
                      WHERE un.id_curso = c.id_curso) AS total,
                    (SELECT COUNT(*) FROM resultado_actividad r
                       JOIN actividad a ON a.id_actividad = r.id_actividad
                       JOIN unidad un ON un.id_unidad = a.id_unidad
                      WHERE r.id_estudiante = eg.id_estudiante
                        AND un.id_curso = c.id_curso AND r.completada) AS completadas
                FROM estudiante_grupo eg
                JOIN grupo_curso gc ON gc.id_grupo = eg.id_grupo
                JOIN curso c ON c.id_curso = gc.id_curso
                WHERE eg.id_grupo = %s
                ORDER BY c.id_curso;
            """, (id_grupo,))
            progreso = {}
            for r in cursor.fetchall():
                progreso.setdefault(r[0], []).append({
                    "id_curso": r[1], "titulo_curso": r[2],
                    "total_actividades": r[3] or 0, "actividades_completadas": r[4] or 0
                })
            cursor.close()
            return [{
                "id_estudiante": r[0], "id_usuario": r[0],
                "nombre": r[1], "apodo": r[2], "usuario": r[2], "correo": r[3],
                "progreso": progreso.get(r[0], [])
            } for r in rows]
        except Exception as e:
            print(f"Error obtener estudiantes: {e}")
            return []
        finally:
            if conn: DatabaseConnection.return_connection(conn)

    @staticmethod
    def buscar_estudiantes_para_grupo(query_texto, id_grupo):
        """Busca estudiantes por nombre/usuario e indica, para cada uno, si ya está en este grupo
        o si está en OTRO grupo que comparte un curso con este (en ese caso no se puede agregar)."""
        conn = DatabaseConnection.get_connection()
        if not conn: return []
        try:
            cursor = conn.cursor()
            query = """
                SELECT u.id_usuario, u.nombre, u.apodo,
                       (eg.id_grupo IS NOT NULL) AS en_grupo,
                       conf.id_grupo, conf.nombre_grupo, conf.cursos
                FROM usuario u
                LEFT JOIN estudiante_grupo eg
                       ON u.id_usuario = eg.id_estudiante AND eg.id_grupo = %s
                LEFT JOIN LATERAL (
                    SELECT g2.id_grupo, g2.nombre_grupo,
                           STRING_AGG(DISTINCT c2.titulo_curso, ', ') AS cursos
                    FROM estudiante_grupo eg2
                    JOIN grupo g2        ON g2.id_grupo = eg2.id_grupo
                    JOIN grupo_curso gc2 ON gc2.id_grupo = eg2.id_grupo
                    JOIN grupo_curso gco ON gco.id_curso = gc2.id_curso AND gco.id_grupo = %s
                    JOIN curso c2        ON c2.id_curso = gc2.id_curso
                    WHERE eg2.id_estudiante = u.id_usuario AND eg2.id_grupo <> %s
                    GROUP BY g2.id_grupo, g2.nombre_grupo
                    ORDER BY g2.id_grupo
                    LIMIT 1
                ) conf ON TRUE
                WHERE u.rol = 'Estudiante'
                  AND (LOWER(u.nombre) LIKE %s OR LOWER(COALESCE(u.apodo, '')) LIKE %s)
                ORDER BY u.nombre ASC
                LIMIT 15;
            """
            param_search = f"%{query_texto.lower()}%"
            cursor.execute(query, (id_grupo, id_grupo, id_grupo, param_search, param_search))
            rows = cursor.fetchall()
            cursor.close()
            resultado = []
            for r in rows:
                item = {
                    "id_estudiante": r[0], "id_usuario": r[0],
                    "nombre": r[1], "apodo": r[2], "usuario": r[2],
                    "en_grupo": bool(r[3]),
                    "conflicto_curso": r[4] is not None,
                    "grupo_conflicto": None
                }
                if r[4] is not None:
                    item["grupo_conflicto"] = {"id_grupo": r[4], "nombre_grupo": r[5], "cursos": r[6]}
                resultado.append(item)
            return resultado
        except Exception as e:
            print(f"Error buscando estudiantes: {e}")
            return []
        finally:
            if conn: DatabaseConnection.return_connection(conn)

    @staticmethod
    def _conflictos_por_curso(cursor, id_grupo, id_estudiante):
        """Grupos DISTINTOS de `id_grupo` donde el estudiante ya está y que comparten algún curso con él."""
        cursor.execute("""
            SELECT g.id_grupo, g.nombre_grupo, c.id_curso, c.titulo_curso
            FROM estudiante_grupo eg
            JOIN grupo g         ON g.id_grupo = eg.id_grupo
            JOIN grupo_curso gc  ON gc.id_grupo = eg.id_grupo
            JOIN grupo_curso gco ON gco.id_curso = gc.id_curso AND gco.id_grupo = %s
            JOIN curso c         ON c.id_curso = gc.id_curso
            WHERE eg.id_estudiante = %s AND eg.id_grupo <> %s
            ORDER BY g.id_grupo, c.id_curso;
        """, (id_grupo, id_estudiante, id_grupo))
        return [{"id_grupo": r[0], "nombre_grupo": r[1], "id_curso": r[2], "titulo_curso": r[3]}
                for r in cursor.fetchall()]

    @staticmethod
    def _progreso_en_cursos_del_grupo(cursor, id_grupo, id_estudiante):
        """Actividades completadas por el estudiante en cada curso del grupo (lo que ya traía de antes)."""
        cursor.execute("""
            SELECT c.id_curso, c.titulo_curso,
                (SELECT COUNT(*) FROM actividad a JOIN unidad un ON un.id_unidad = a.id_unidad
                  WHERE un.id_curso = c.id_curso) AS total,
                (SELECT COUNT(*) FROM resultado_actividad r
                   JOIN actividad a ON a.id_actividad = r.id_actividad
                   JOIN unidad un ON un.id_unidad = a.id_unidad
                  WHERE r.id_estudiante = %s AND un.id_curso = c.id_curso AND r.completada) AS completadas
            FROM grupo_curso gc JOIN curso c ON c.id_curso = gc.id_curso
            WHERE gc.id_grupo = %s
            ORDER BY c.id_curso;
        """, (id_estudiante, id_grupo))
        return [{"id_curso": r[0], "titulo_curso": r[1],
                 "total_actividades": r[2] or 0, "actividades_completadas": r[3] or 0}
                for r in cursor.fetchall()]

    @staticmethod
    def agregar_estudiante_a_grupo(id_grupo, id_estudiante):
        """Inscribe al estudiante en el grupo.

        Regla: un estudiante no puede estar en dos grupos que compartan un curso. Si ya está en uno,
        debe salir primero (quitar_estudiante_de_grupo). Su progreso NO se borra al salir, así que al
        entrar al grupo nuevo se reporta y se ve de inmediato.
        """
        conn = DatabaseConnection.get_connection()
        if not conn: return {"success": False, "message": "Error de conexión BD"}
        try:
            cursor = conn.cursor()
            # Bloquea la fila del estudiante: evita que dos altas simultáneas se salten la validación.
            cursor.execute("SELECT nombre FROM usuario WHERE id_usuario = %s AND rol = 'Estudiante' FOR UPDATE;", (id_estudiante,))
            est = cursor.fetchone()
            if not est:
                conn.rollback(); cursor.close()
                return {"success": False, "codigo": "NO_ENCONTRADO", "message": "El estudiante no existe"}
            nombre_est = est[0]

            cursor.execute("SELECT 1 FROM grupo WHERE id_grupo = %s;", (id_grupo,))
            if not cursor.fetchone():
                conn.rollback(); cursor.close()
                return {"success": False, "codigo": "NO_ENCONTRADO", "message": "El grupo no existe"}

            cursor.execute("SELECT 1 FROM estudiante_grupo WHERE id_grupo = %s AND id_estudiante = %s;", (id_grupo, id_estudiante))
            if cursor.fetchone():
                conn.rollback(); cursor.close()
                return {"success": False, "codigo": "DUPLICADO", "message": "Este estudiante ya forma parte del grupo"}

            conflictos = GrupoDAO._conflictos_por_curso(cursor, id_grupo, id_estudiante)
            if conflictos:
                conn.rollback(); cursor.close()
                primero = conflictos[0]
                cursos = ", ".join(sorted({c["titulo_curso"] for c in conflictos}))
                return {
                    "success": False, "codigo": "CURSO_DUPLICADO", "conflictos": conflictos,
                    "message": (f"{nombre_est} ya está en el grupo «{primero['nombre_grupo']}», que tiene el mismo curso "
                                f"({cursos}). Primero debe salir de ese grupo para poder entrar a este.")
                }

            cursor.execute("INSERT INTO estudiante_grupo (id_grupo, id_estudiante) VALUES (%s, %s);", (id_grupo, id_estudiante))
            progreso = GrupoDAO._progreso_en_cursos_del_grupo(cursor, id_grupo, id_estudiante)
            conn.commit()
            cursor.close()

            con_avance = [p for p in progreso if p["actividades_completadas"] > 0]
            mensaje = "Estudiante agregado con éxito"
            if con_avance:
                detalle = "; ".join(f"{p['titulo_curso']}: {p['actividades_completadas']} de {p['total_actividades']} actividades"
                                    for p in con_avance)
                mensaje += f". Se conservó su progreso ({detalle})"
            return {"success": True, "message": mensaje, "progreso_recuperado": progreso}
        except Exception as e:
            if conn: conn.rollback()
            return {"success": False, "message": str(e)}
        finally:
            if conn: DatabaseConnection.return_connection(conn)

    @staticmethod
    def quitar_estudiante_de_grupo(id_grupo, id_estudiante):
        """Saca al estudiante del grupo. Solo borra la inscripción: el progreso (resultado_actividad,
        respuesta_estudiante) no se toca, para que reaparezca si entra a otro grupo con el mismo curso."""
        conn = DatabaseConnection.get_connection()
        if not conn: return {"success": False, "message": "Error de conexión BD"}
        try:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM estudiante_grupo WHERE id_grupo = %s AND id_estudiante = %s;", (id_grupo, id_estudiante))
            borrados = cursor.rowcount
            conn.commit()
            cursor.close()
            if borrados == 0:
                return {"success": False, "codigo": "NO_ENCONTRADO", "message": "El estudiante no pertenece a este grupo"}
            return {"success": True, "message": "Estudiante retirado del grupo. Su progreso se conserva."}
        except Exception as e:
            if conn: conn.rollback()
            return {"success": False, "message": str(e)}
        finally:
            if conn: DatabaseConnection.return_connection(conn)

    @staticmethod
    def obtener_cursos_por_grupo(id_grupo):
        conn = DatabaseConnection.get_connection()
        if not conn: return []
        try:
            cursor = conn.cursor()
            query = """
                SELECT c.id_curso, c.titulo_curso, c.descripcion, COUNT(DISTINCT u.id_unidad) AS total_unidades
                FROM curso c
                JOIN grupo_curso gc ON c.id_curso = gc.id_curso
                LEFT JOIN unidad u ON c.id_curso = u.id_curso
                WHERE gc.id_grupo = %s
                GROUP BY c.id_curso, c.titulo_curso, c.descripcion
                ORDER BY c.id_curso ASC;
            """
            cursor.execute(query, (id_grupo,))
            rows = cursor.fetchall()
            cursor.close()
            cursos = []
            for r in rows:
                cursos.append({
                    "id_curso": r[0],
                    "titulo_curso": r[1],
                    "descripcion": r[2] or "",
                    "total_unidades": r[3] or 0
                })
            return cursos
        except Exception as e:
            print(f"Error en GrupoDAO.obtener_cursos_por_grupo: {e}")
            return []
        finally:
            if conn: DatabaseConnection.return_connection(conn)

    @staticmethod
    def obtener_cursos_disponibles_para_grupo(id_grupo):
        conn = DatabaseConnection.get_connection()
        if not conn: return []
        try:
            cursor = conn.cursor()
            query = """
                SELECT c.id_curso, c.titulo_curso, c.descripcion
                FROM curso c
                WHERE c.id_curso NOT IN (
                    SELECT id_curso FROM grupo_curso WHERE id_grupo = %s
                )
                ORDER BY c.id_curso ASC;
            """
            cursor.execute(query, (id_grupo,))
            rows = cursor.fetchall()
            cursor.close()
            return [
                {
                    "id_curso": r[0],
                    "titulo_curso": r[1],
                    "descripcion": r[2] or "Sin descripción.",
                    "unidades": 0
                } for r in rows
            ]
        except Exception as e:
            print(f"Error obtener cursos disponibles: {e}")
            return []
        finally:
            if conn: DatabaseConnection.return_connection(conn)

    @staticmethod
    def asignar_curso_a_grupo(id_grupo, id_curso):
        conn = DatabaseConnection.get_connection()
        if not conn: return {"success": False, "message": "Error de conexión BD"}
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM grupo_curso WHERE id_grupo = %s AND id_curso = %s;", (id_grupo, id_curso))
            if cursor.fetchone():
                cursor.close()
                return {"success": False, "codigo": "DUPLICADO", "message": "Este grupo ya tiene este curso"}

            # Un miembro de este grupo que ya tenga ese curso en OTRO grupo quedaría con el curso repetido.
            cursor.execute("""
                SELECT u.nombre, g.nombre_grupo
                FROM estudiante_grupo eg
                JOIN estudiante_grupo eg_otro ON eg_otro.id_estudiante = eg.id_estudiante AND eg_otro.id_grupo <> eg.id_grupo
                JOIN grupo_curso gc ON gc.id_grupo = eg_otro.id_grupo AND gc.id_curso = %s
                JOIN grupo g ON g.id_grupo = eg_otro.id_grupo
                JOIN usuario u ON u.id_usuario = eg.id_estudiante
                WHERE eg.id_grupo = %s
                ORDER BY u.nombre;
            """, (id_curso, id_grupo))
            choques = cursor.fetchall()
            if choques:
                cursor.close()
                lista = "; ".join(f"{n} (ya lo tiene en «{g}»)" for n, g in choques[:5])
                extra = f" y {len(choques) - 5} más" if len(choques) > 5 else ""
                return {"success": False, "codigo": "CURSO_DUPLICADO",
                        "message": f"No se puede asignar este curso: hay estudiantes del grupo que ya lo tienen en otro grupo: {lista}{extra}."}

            cursor.execute("INSERT INTO grupo_curso (id_grupo, id_curso) VALUES (%s, %s);", (id_grupo, id_curso))
            conn.commit()
            cursor.close()
            return {"success": True, "message": "Curso asignado con éxito"}
        except Exception as e:
            if conn: conn.rollback()
            return {"success": False, "message": str(e)}
        finally:
            if conn: DatabaseConnection.return_connection(conn)

    @staticmethod
    def quitar_curso_de_grupo(id_grupo, id_curso):
        conn = DatabaseConnection.get_connection()
        if not conn: return {"success": False, "message": "Error de conexión BD"}
        try:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM grupo_curso WHERE id_grupo = %s AND id_curso = %s;", (id_grupo, id_curso))
            conn.commit()
            cursor.close()
            return {"success": True, "message": "Curso quitado del grupo con éxito"}
        except Exception as e:
            if conn: conn.rollback()
            return {"success": False, "message": str(e)}
        finally:
            if conn: DatabaseConnection.return_connection(conn)