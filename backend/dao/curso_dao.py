from config.database import DatabaseConnection
from models.curso import Curso, Unidad, Actividad, PregPunto

class CursoDAO:

    @staticmethod
    def obtener_todos():
        conn = DatabaseConnection.get_connection()
        if not conn: return []
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT id_curso, titulo_curso, descripcion FROM curso ORDER BY id_curso ASC;")
            rows = cursor.fetchall()
            cursor.close()
            return [Curso(r[0], r[1], r[2]).to_dict() for r in rows]
        except Exception as e:
            print(f"Error en CursoDAO.obtener_todos: {e}")
            return []
        finally:
            if conn: DatabaseConnection.return_connection(conn)

    @staticmethod
    def obtener_curso_estudiante(id_estudiante):
        """Obtiene el curso activo asignado al grupo del estudiante."""
        conn = DatabaseConnection.get_connection()
        if not conn: return None
        try:
            cursor = conn.cursor()
            query = """
                SELECT c.id_curso, c.titulo_curso, c.descripcion
                FROM curso c
                JOIN grupo_curso gc ON c.id_curso = gc.id_curso
                JOIN estudiante_grupo ge ON gc.id_grupo = ge.id_grupo
                WHERE ge.id_estudiante = %s
                LIMIT 1;
            """
            cursor.execute(query, (id_estudiante,))
            row = cursor.fetchone()
            cursor.close()
            if row:
                return Curso(row[0], row[1], row[2]).to_dict()
            return CursoDAO.obtener_curso_por_id(1)
        except Exception as e:
            print(f"Error en CursoDAO.obtener_curso_estudiante: {e}")
            return None
        finally:
            if conn: DatabaseConnection.return_connection(conn)

    @staticmethod
    def obtener_curso_por_id(id_curso):
        conn = DatabaseConnection.get_connection()
        if not conn: return None
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT id_curso, titulo_curso, descripcion FROM curso WHERE id_curso = %s;", (id_curso,))
            row = cursor.fetchone()
            cursor.close()
            if row:
                return Curso(row[0], row[1], row[2]).to_dict()
            return None
        except Exception as e:
            print(f"Error en CursoDAO.obtener_curso_por_id: {e}")
            return None
        finally:
            if conn: DatabaseConnection.return_connection(conn)

    @staticmethod
    def obtener_unidades_por_curso(id_curso):
        conn = DatabaseConnection.get_connection()
        if not conn: return []
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id_unidad, titulo_unidad, id_curso 
                FROM unidad 
                WHERE id_curso = %s 
                ORDER BY id_unidad ASC;
            """, (id_curso,))
            rows = cursor.fetchall()
            cursor.close()
            return [Unidad(r[0], r[1], r[2]).to_dict() for r in rows]
        except Exception as e:
            print(f"Error en CursoDAO.obtener_unidades_por_curso: {e}")
            return []
        finally:
            if conn: DatabaseConnection.return_connection(conn)

    @staticmethod
    def obtener_actividades_por_unidad(id_unidad):
        conn = DatabaseConnection.get_connection()
        if not conn: return []
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id_actividad, titulo_actividad, tipo_contenido, id_unidad 
                FROM actividad 
                WHERE id_unidad = %s 
                ORDER BY id_actividad ASC;
            """, (id_unidad,))
            rows = cursor.fetchall()
            cursor.close()
            return [Actividad(r[0], r[1], r[2], r[3]).to_dict() for r in rows]
        except Exception as e:
            print(f"Error en CursoDAO.obtener_actividades_por_unidad: {e}")
            return []
        finally:
            if conn: DatabaseConnection.return_connection(conn)

    @staticmethod
    def obtener_puntos_de_actividad(id_actividad):
        conn = DatabaseConnection.get_connection()
        if not conn: return []
        try:
            cursor = conn.cursor()
            query = """
                SELECT id_punto, id_actividad, enunciado, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta,
                    visual, explicacion, es_opinion
                FROM preg_punto
                WHERE id_actividad = %s
                ORDER BY id_punto ASC;
            """
            cursor.execute(query, (id_actividad,))
            rows = cursor.fetchall()
            cursor.close()

            return [
                PregPunto(*r).to_dict()
                for r in rows
            ]
        except Exception as e:
            print(f"Error en CursoDAO.obtener_puntos_de_actividad: {e}")
            return []
        finally:
            if conn: DatabaseConnection.return_connection(conn)

    @staticmethod
    def obtener_todos_con_contenido():
        conn = DatabaseConnection.get_connection()
        if not conn: return []
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT id_curso, titulo_curso, descripcion FROM curso ORDER BY id_curso ASC;")
            rows_cursos = cursor.fetchall()
            
            lista_cursos = []
            for c_row in rows_cursos:
                c_id, c_titulo, c_desc = c_row[0], c_row[1], c_row[2] or ""
                curso_dict = Curso(c_id, c_titulo, c_desc).to_dict()
                curso_dict["grado"] = "Primero" if c_id == 1 else "Segundo"
                
                cursor.execute("SELECT id_unidad, titulo_unidad FROM unidad WHERE id_curso = %s ORDER BY id_unidad ASC;", (c_id,))
                rows_unidades = cursor.fetchall()
                
                unidades_list = []
                total_actividades_curso = 0

                for u_row in rows_unidades:
                    u_id, u_titulo = u_row[0], u_row[1]
                    cursor.execute("""
                        SELECT id_actividad, titulo_actividad, tipo_contenido 
                        FROM actividad 
                        WHERE id_unidad = %s 
                        ORDER BY id_actividad ASC;
                    """, (u_id,))
                    rows_actividades = cursor.fetchall()
                    
                    actividades = [
                        Actividad(a[0], a[1], a[2], u_id).to_dict()
                        for a in rows_actividades
                    ]
                    
                    total_actividades_curso += len(actividades)
                    u_dict = Unidad(u_id, u_titulo, c_id).to_dict()
                    u_dict["actividades"] = actividades
                    unidades_list.append(u_dict)
                
                curso_dict["unidades"] = unidades_list
                curso_dict["total_unidades"] = len(unidades_list)
                curso_dict["total_actividades"] = total_actividades_curso
                lista_cursos.append(curso_dict)

            cursor.close()
            return lista_cursos
        except Exception as e:
            print(f"Error en CursoDAO.obtener_todos_con_contenido: {e}")
            return []
        finally:
            if conn: DatabaseConnection.return_connection(conn)

    @staticmethod
    def obtener_detalle_completo(id_curso, id_estudiante=None):
        conn = DatabaseConnection.get_connection()
        if not conn: return None
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT id_curso, titulo_curso, descripcion FROM curso WHERE id_curso = %s;", (id_curso,))
            row = cursor.fetchone()
            if not row:
                cursor.close()
                return None
            
            c_id, c_titulo, c_desc = row[0], row[1], row[2] or ""
            curso_dict = Curso(c_id, c_titulo, c_desc).to_dict()
            curso_dict["grado"] = "Primero" if c_id == 1 else "Segundo"

            cursor.execute("SELECT id_unidad, titulo_unidad FROM unidad WHERE id_curso = %s ORDER BY id_unidad ASC;", (c_id,))
            rows_unidades = cursor.fetchall()
            
            unidades_list = []
            total_actividades = 0
            actividades_completadas = 0

            # Si nos pasan id_estudiante, obtenemos el set de IDs de actividades completadas
            completadas_set = set()
            if id_estudiante:
                cursor.execute("""
                    SELECT ra.id_actividad 
                    FROM resultado_actividad ra
                    JOIN actividad a ON ra.id_actividad = a.id_actividad
                    JOIN unidad u ON a.id_unidad = u.id_unidad
                    LEFT JOIN usuario usr ON usr.id_usuario = ra.id_estudiante
                    WHERE u.id_curso = %s 
                        AND (ra.id_estudiante = %s OR usr.id_usuario = %s)
                        AND ra.completada = TRUE;
                """, (id_curso, id_estudiante, id_estudiante))
                completadas_set = {r[0] for r in cursor.fetchall()}

            for u_row in rows_unidades:
                u_id, u_titulo = u_row[0], u_row[1]
                cursor.execute("""
                    SELECT id_actividad, titulo_actividad, tipo_contenido 
                    FROM actividad 
                    WHERE id_unidad = %s 
                    ORDER BY id_actividad ASC;
                """, (u_id,))
                rows_actividades = cursor.fetchall()
                
                actividades = []
                for a in rows_actividades:
                    act_dict = Actividad(a[0], a[1], a[2], u_id).to_dict()
                    es_completada = a[0] in completadas_set
                    act_dict["completada"] = es_completada
                    if es_completada:
                        actividades_completadas += 1
                    actividades.append(act_dict)

                total_actividades += len(actividades)
                u_dict = Unidad(u_id, u_titulo, c_id).to_dict()
                u_dict["actividades"] = actividades
                unidades_list.append(u_dict)

            curso_dict["unidades"] = unidades_list
            curso_dict["total_unidades"] = len(unidades_list)
            curso_dict["total_actividades"] = total_actividades
            curso_dict["actividades_completadas"] = actividades_completadas
            
            # Cálculo del porcentaje
            porcentaje = round((actividades_completadas / total_actividades) * 100) if total_actividades > 0 else 0
            curso_dict["porcentaje_progreso"] = porcentaje

            cursor.close()
            return curso_dict
        except Exception as e:
            print(f"Error en CursoDAO.obtener_detalle_completo: {e}")
            return None
        finally:
            if conn: DatabaseConnection.return_connection(conn)