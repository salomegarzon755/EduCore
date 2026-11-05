from config.database import DatabaseConnection
from models.resultado import Resultado


class ActividadDAO:

    @staticmethod
    def obtener_meta(id_actividad):
        """Datos de la actividad + unidad + curso (título y botón «Volver a mi camino»)."""
        conn = DatabaseConnection.get_connection()
        if not conn:
            return None
        try:
            cur = conn.cursor()
            cur.execute("""
                SELECT a.id_actividad, a.titulo_actividad, a.tipo_contenido,
                    u.id_unidad, u.titulo_unidad, u.id_curso, c.titulo_curso
                FROM actividad a
                JOIN unidad u ON u.id_unidad = a.id_unidad
                JOIN curso  c ON c.id_curso  = u.id_curso
                WHERE a.id_actividad = %s;""", (id_actividad,))
            r = cur.fetchone()
            cur.close()
            if not r:
                return None
            return {"id_actividad": r[0], "titulo_actividad": r[1], "tipo_contenido": r[2],
                    "id_unidad": r[3], "titulo_unidad": r[4], "id_curso": r[5], "titulo_curso": r[6]}
        except Exception as e:
            print(f"Error en ActividadDAO.obtener_meta: {e}")
            return None
        finally:
            DatabaseConnection.return_connection(conn)

    @staticmethod
    def obtener_progreso(id_estudiante, id_curso):
        """Resultados del estudiante en un curso -> {id_actividad: {...}} (alimenta Mi camino)."""
        conn = DatabaseConnection.get_connection()
        if not conn:
            return {}
        try:
            cur = conn.cursor()
            cur.execute("""
                SELECT r.id_actividad, r.aciertos, r.total, r.estrellas, r.semaforo, r.completada, r.intentos
                FROM resultado_actividad r
                JOIN actividad a ON a.id_actividad = r.id_actividad
                JOIN unidad u    ON u.id_unidad = a.id_unidad
                WHERE r.id_estudiante = %s AND u.id_curso = %s;""", (id_estudiante, id_curso))
            rows = cur.fetchall()
            cur.close()
            return {r[0]: Resultado(*r).to_dict() for r in rows}
        except Exception as e:
            print(f"Error en ActividadDAO.obtener_progreso: {e}")
            return {}
        finally:
            DatabaseConnection.return_connection(conn)

    @staticmethod
    def guardar_resultado(id_estudiante, id_actividad, aciertos, total, respuestas):
        """Upsert del resultado + detalle de respuestas. La nota la calcula el servidor."""
        conn = DatabaseConnection.get_connection()
        if not conn:
            return {"success": False, "message": "Sin conexión a la base de datos"}
        try:
            estrellas, semaforo = Resultado.calcular(aciertos, total)
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO resultado_actividad
                    (id_estudiante, id_actividad, aciertos, total, estrellas, semaforo, completada, intentos, fecha)
                VALUES (%s, %s, %s, %s, %s, %s, TRUE, 1, NOW())
                ON CONFLICT (id_estudiante, id_actividad) DO UPDATE SET
                    aciertos = EXCLUDED.aciertos, total = EXCLUDED.total,
                    estrellas = EXCLUDED.estrellas, semaforo = EXCLUDED.semaforo,
                    completada = TRUE, intentos = resultado_actividad.intentos + 1, fecha = NOW()
                RETURNING intentos;""",
                (id_estudiante, id_actividad, aciertos, total, estrellas, semaforo))
            intentos = cur.fetchone()[0]
            for r in respuestas:
                cur.execute("""
                    INSERT INTO respuesta_estudiante (id_estudiante, id_punto, intento, opcion_elegida, es_correcta)
                    VALUES (%s, %s, %s, %s, %s);""",
                    (id_estudiante, r["id_punto"], intentos, r.get("elegida"), bool(r.get("correcta"))))
            conn.commit()
            cur.close()
            return {"success": True, "resultado": Resultado(
                id_actividad, aciertos, total, estrellas, semaforo, True, intentos).to_dict()}
        except Exception as e:
            conn.rollback()
            print(f"Error en ActividadDAO.guardar_resultado: {e}")
            return {"success": False, "message": "No se pudo guardar el resultado"}
        finally:
            DatabaseConnection.return_connection(conn)
