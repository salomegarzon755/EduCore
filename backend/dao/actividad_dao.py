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
    def _calificar(cur, id_actividad, respuestas):
        """HU.32 · La nota la calcula el servidor con las respuestas correctas guardadas en preg_punto.
        Solo cuenta la primera respuesta de cada pregunta de ESTA actividad (los reintentos de HU.27
        son para aprender). Las encuestas de opinión cuentan como acierto, igual que en el juego.
        Devuelve (aciertos, total, respuestas_validas, preguntas_calificables) o None si no existe."""
        cur.execute("SELECT 1 FROM actividad WHERE id_actividad = %s", (id_actividad,))
        if not cur.fetchone():
            return None
        cur.execute("""SELECT id_punto, respuesta_correcta, COALESCE(es_opinion, FALSE) FROM preg_punto
                       WHERE id_actividad = %s AND opcion_a IS NOT NULL AND opcion_a <> 'NULL'""", (id_actividad,))
        preguntas = {r[0]: (str(r[1] or '').strip().upper(), r[2]) for r in cur.fetchall()}
        validas, vistas = [], set()
        for r in respuestas if isinstance(respuestas, list) else []:
            try:
                id_punto = int(r.get("id_punto"))
            except (AttributeError, TypeError, ValueError):
                continue
            if id_punto not in preguntas or id_punto in vistas:
                continue
            vistas.add(id_punto)
            elegida = str(r.get("elegida") or '').strip().upper()[:1]
            elegida = elegida if elegida in ('A', 'B', 'C', 'D') else None
            correcta, opinion = preguntas[id_punto]
            validas.append({"id_punto": id_punto, "elegida": elegida,
                            "correcta": bool(opinion or (elegida and elegida == correcta))})
        return sum(1 for v in validas if v["correcta"]), len(validas), validas, len(preguntas)

    @staticmethod
    def mensaje_felicitacion(aciertos, total):
        """HU.32 · Mensaje según el desempeño, tomado al azar de la tabla mensaje_felicitacion.
        Teoría (total 0) no lleva mensaje de puntuación."""
        if total <= 0:
            return None
        tipo = ('sin_errores' if aciertos == total
                else 'puntaje_alto' if aciertos / total >= 0.8 else 'seguir_practicando')
        conn = DatabaseConnection.get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("""SELECT titulo, mensaje FROM mensaje_felicitacion
                               WHERE tipo = %s AND activo ORDER BY random() LIMIT 1""", (tipo,))
                fila = cur.fetchone()
        except Exception as e:
            # Sin la migración HU.32 el juego sigue funcionando con un mensaje base.
            print(f"Aviso: sin mensajes de felicitación en BD ({e.__class__.__name__}). ¿Ejecutaste migracion_hu32_hu34_progreso.sql?")
            fila = None
        finally:
            conn.rollback()
            DatabaseConnection.return_connection(conn)
        base = {'sin_errores': ('¡Excelente trabajo!', '¡Sigue explorando y aprendiendo!'),
                'puntaje_alto': ('¡Muy buen trabajo!', '¡Sigue así!'),
                'seguir_practicando': ('Resultado del reto', 'Practicar te ayuda a aprender.')}[tipo]
        titulo, mensaje = fila or base
        return {"tipo": tipo, "titulo": titulo, "mensaje": mensaje}

    @staticmethod
    def guardar_resultado(id_estudiante, id_actividad, respuestas):
        """Upsert del resultado + detalle de respuestas. La nota la calcula el servidor (HU.32)."""
        conn = DatabaseConnection.get_connection()
        if not conn:
            return {"success": False, "message": "Sin conexión a la base de datos"}
        try:
            cur = conn.cursor()
            calificacion = ActividadDAO._calificar(cur, id_actividad, respuestas)
            if calificacion is None:
                conn.rollback()
                return {"success": False, "codigo": "NO_ENCONTRADA", "message": "Actividad no encontrada"}
            aciertos, total, respuestas, calificables = calificacion
            if calificables and not total:
                # Una actividad con preguntas no se puede marcar como hecha sin responderlas.
                conn.rollback()
                return {"success": False, "codigo": "SIN_RESPUESTAS", "message": "Responde las preguntas de la actividad."}
            estrellas, semaforo = Resultado.calcular(aciertos, total)
            # Serializar intentos por estudiante/actividad, incluso si dos peticiones llegan a la vez.
            cur.execute("SELECT pg_advisory_xact_lock(%s, %s)", (id_estudiante, id_actividad))
            cur.execute("SELECT COALESCE(MAX(numero_intento), 0) FROM intento_actividad WHERE id_estudiante=%s AND id_actividad=%s", (id_estudiante,id_actividad))
            intentos = cur.fetchone()[0] + 1
            cur.execute("""INSERT INTO intento_actividad
                (id_estudiante,id_actividad,numero_intento,aciertos,total,estrellas,semaforo)
                VALUES (%s,%s,%s,%s,%s,%s,%s)""",
                (id_estudiante,id_actividad,intentos,aciertos,total,estrellas,semaforo))
            # Resultado principal = mejor intento (empate: el más reciente).
            cur.execute("""SELECT aciertos,total,estrellas,semaforo
                FROM intento_actividad WHERE id_estudiante=%s AND id_actividad=%s
                ORDER BY CASE WHEN total>0 THEN aciertos::numeric/total ELSE -1 END DESC,
                         numero_intento DESC LIMIT 1""", (id_estudiante,id_actividad))
            mejor = cur.fetchone()
            cur.execute("""INSERT INTO resultado_actividad
                (id_estudiante,id_actividad,aciertos,total,estrellas,semaforo,completada,intentos,fecha)
                VALUES (%s,%s,%s,%s,%s,%s,TRUE,%s,NOW())
                ON CONFLICT(id_estudiante,id_actividad) DO UPDATE SET
                aciertos=EXCLUDED.aciertos,total=EXCLUDED.total,
                estrellas=EXCLUDED.estrellas,semaforo=EXCLUDED.semaforo,
                completada=TRUE,intentos=EXCLUDED.intentos,fecha=NOW()""",
                (id_estudiante,id_actividad,*mejor,intentos))
            for r in respuestas:
                cur.execute("""
                    INSERT INTO respuesta_estudiante (id_estudiante, id_punto, intento, opcion_elegida, es_correcta)
                    VALUES (%s, %s, %s, %s, %s);""",
                    (id_estudiante, r["id_punto"], intentos, r.get("elegida"), bool(r.get("correcta"))))
            conn.commit()
            cur.close()
            return {"success": True,
                    "resultado": Resultado(id_actividad, mejor[0], mejor[1], mejor[2], mejor[3], True, intentos).to_dict(),
                    # HU.32 · puntuación de ESTE intento (la pantalla final muestra lo que acaba de hacer)
                    "intento": {"numero": intentos, "aciertos": aciertos, "total": total,
                                "incorrectas": total - aciertos,
                                "porcentaje": int(aciertos * 100 / total + 0.5) if total else None,
                                "estrellas": estrellas, "semaforo": semaforo}}
        except Exception as e:
            conn.rollback()
            print(f"Error en ActividadDAO.guardar_resultado: {e}")
            return {"success": False, "message": "No se pudo guardar el resultado"}
        finally:
            DatabaseConnection.return_connection(conn)
