"""HU.28 · Unidades y actividades de un curso para el Administrador.

Una actividad creada aquí es una "Práctica" con una pregunta de opción múltiple:
- enunciado (texto sencillo), respuesta correcta y 2-3 opciones más,
- pista (HU.27), imagen de la galería de EduCore (visual) y sonido con la voz del navegador
  (la actividad lee el enunciado en voz alta, no se guardan archivos de audio).
"""
import json
from config.database import DatabaseConnection


class ContenidoAdminDAO:

    # ---------------- Unidades ----------------
    @staticmethod
    def listar_unidades(id_curso):
        """Unidades del curso con su número de actividades. None si el curso no existe."""
        conn = DatabaseConnection.get_connection()
        try:
            cur = conn.cursor()
            cur.execute("SELECT 1 FROM curso WHERE id_curso = %s;", (id_curso,))
            if not cur.fetchone():
                return None
            cur.execute("""
                SELECT u.id_unidad, u.titulo_unidad,
                       (SELECT COUNT(*) FROM actividad a WHERE a.id_unidad = u.id_unidad) AS total_actividades
                FROM unidad u
                WHERE u.id_curso = %s
                ORDER BY u.id_unidad ASC;
            """, (id_curso,))
            filas = cur.fetchall()
            cur.close()
            return [{"id_unidad": r[0], "titulo_unidad": r[1], "total_actividades": r[2]} for r in filas]
        finally:
            DatabaseConnection.return_connection(conn)

    @staticmethod
    def crear_unidad(id_curso, titulo):
        """Crea una unidad al final del curso. None si el curso no existe."""
        conn = DatabaseConnection.get_connection()
        try:
            cur = conn.cursor()
            cur.execute("SELECT 1 FROM curso WHERE id_curso = %s FOR UPDATE;", (id_curso,))
            if not cur.fetchone():
                conn.rollback()
                return None
            cur.execute("INSERT INTO unidad (titulo_unidad, id_curso) VALUES (%s, %s) RETURNING id_unidad;",
                        (titulo, id_curso))
            id_unidad = cur.fetchone()[0]
            conn.commit()
            cur.close()
            return {"id_unidad": id_unidad, "titulo_unidad": titulo, "total_actividades": 0}
        except Exception:
            conn.rollback()
            raise
        finally:
            DatabaseConnection.return_connection(conn)

    # ---------------- Actividades ----------------
    @staticmethod
    def detalle_unidad(id_unidad):
        """Unidad con su curso y sus actividades (con la primera pregunta). None si no existe."""
        conn = DatabaseConnection.get_connection()
        try:
            cur = conn.cursor()
            cur.execute("""
                SELECT u.id_unidad, u.titulo_unidad, c.id_curso, c.titulo_curso,
                       (SELECT COUNT(*) FROM unidad u2 WHERE u2.id_curso = c.id_curso AND u2.id_unidad <= u.id_unidad) AS numero
                FROM unidad u JOIN curso c ON c.id_curso = u.id_curso
                WHERE u.id_unidad = %s;
            """, (id_unidad,))
            u = cur.fetchone()
            if not u:
                return None
            cur.execute("""
                SELECT a.id_actividad, a.titulo_actividad, a.tipo_contenido,
                       p.enunciado, p.respuesta_correcta, p.opcion_a, p.opcion_b, p.opcion_c, p.opcion_d,
                       p.visual,
                       (SELECT COUNT(*) FROM preg_punto x WHERE x.id_actividad = a.id_actividad) AS total_preguntas
                FROM actividad a
                LEFT JOIN LATERAL (
                    SELECT * FROM preg_punto pp WHERE pp.id_actividad = a.id_actividad ORDER BY pp.id_punto LIMIT 1
                ) p ON TRUE
                WHERE a.id_unidad = %s
                ORDER BY a.id_actividad ASC;
            """, (id_unidad,))
            filas = cur.fetchall()
            pistas = {}
            try:   # la pista viene de la migración de la HU.27; si no existe, se omite
                cur.execute("""SELECT pp.id_actividad, pp.pista FROM preg_punto pp
                               JOIN actividad a ON a.id_actividad = pp.id_actividad
                               WHERE a.id_unidad = %s ORDER BY pp.id_punto DESC;""", (id_unidad,))
                for id_act, pista in cur.fetchall():
                    pistas[id_act] = pista   # queda la de la primera pregunta (orden descendente)
            except Exception:
                conn.rollback()
            cur.close()
            actividades = []
            for r in filas:
                letra = (r[4] or '').strip().upper()
                opciones = {'A': r[5], 'B': r[6], 'C': r[7], 'D': r[8]}
                visual = r[9] if isinstance(r[9], dict) else (json.loads(r[9]) if r[9] else None)
                imagen = None
                if visual and isinstance(visual.get('q'), list):
                    imagen = next((t for t in visual['q'] if isinstance(t, dict) and t.get('i')), None)
                actividades.append({
                    "id_actividad": r[0], "titulo_actividad": r[1], "tipo_contenido": r[2],
                    "pregunta": r[3], "respuesta_correcta": opciones.get(letra),
                    "pista": pistas.get(r[0]), "imagen": imagen, "total_preguntas": r[10]
                })
            return {"id_unidad": u[0], "titulo_unidad": u[1], "id_curso": u[2], "titulo_curso": u[3],
                    "numero": u[4], "actividades": actividades}
        finally:
            DatabaseConnection.return_connection(conn)

    @staticmethod
    def crear_actividad(id_unidad, titulo, pregunta, correcta, otras, pista, imagen, cantidad):
        """Crea la actividad y su pregunta en una sola transacción. None si la unidad no existe."""
        conn = DatabaseConnection.get_connection()
        try:
            cur = conn.cursor()
            cur.execute("SELECT 1 FROM unidad WHERE id_unidad = %s FOR UPDATE;", (id_unidad,))
            if not cur.fetchone():
                conn.rollback()
                return None
            cur.execute("""INSERT INTO actividad (titulo_actividad, tipo_contenido, id_unidad)
                           VALUES (%s, 'Práctica', %s) RETURNING id_actividad;""", (titulo, id_unidad))
            id_actividad = cur.fetchone()[0]
            # La correcta se guarda como opción A; la actividad del estudiante baraja las opciones.
            opciones = [correcta] + list(otras) + [None] * (3 - len(otras))
            visual = json.dumps({"q": [{"i": imagen, "n": cantidad}]})
            cur.execute("""INSERT INTO preg_punto (id_actividad, enunciado, opcion_a, opcion_b, opcion_c, opcion_d,
                                                   respuesta_correcta, visual, es_opinion, pista)
                           VALUES (%s, %s, %s, %s, %s, %s, 'A', %s::jsonb, FALSE, %s);""",
                        (id_actividad, pregunta, *opciones, visual, pista or None))
            conn.commit()
            cur.close()
            return {"id_actividad": id_actividad, "titulo_actividad": titulo}
        except Exception:
            conn.rollback()
            raise
        finally:
            DatabaseConnection.return_connection(conn)

    # ======================================================================
    # HU.29 · Editar el contenido de una actividad
    # ======================================================================
    @staticmethod
    def _tipo_pregunta(opcion_a, es_opinion):
        if not opcion_a or opcion_a == 'NULL':
            return 'teoria'
        return 'opinion' if es_opinion else 'pregunta'

    @staticmethod
    def obtener_actividad(id_actividad):
        """Actividad con su unidad, su curso y TODAS sus preguntas. None si no existe."""
        conn = DatabaseConnection.get_connection()
        try:
            cur = conn.cursor()
            cur.execute("""
                SELECT a.id_actividad, a.titulo_actividad, a.tipo_contenido, u.id_unidad, u.titulo_unidad,
                       c.id_curso, c.titulo_curso,
                       (SELECT COUNT(*) FROM unidad u2 WHERE u2.id_curso = c.id_curso AND u2.id_unidad <= u.id_unidad)
                FROM actividad a JOIN unidad u ON u.id_unidad = a.id_unidad JOIN curso c ON c.id_curso = u.id_curso
                WHERE a.id_actividad = %s;
            """, (id_actividad,))
            a = cur.fetchone()
            if not a:
                return None
            try:
                cur.execute("""SELECT id_punto, enunciado, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta,
                                      visual, es_opinion, pista
                               FROM preg_punto WHERE id_actividad = %s ORDER BY id_punto ASC;""", (id_actividad,))
            except Exception:   # sin la migración de la HU.27 no existe la columna pista
                conn.rollback()
                cur = conn.cursor()
                cur.execute("""SELECT id_punto, enunciado, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta,
                                      visual, es_opinion, NULL
                               FROM preg_punto WHERE id_actividad = %s ORDER BY id_punto ASC;""", (id_actividad,))
            preguntas = []
            for r in cur.fetchall():
                opciones = {L: v for L, v in zip('ABCD', r[2:6]) if v and v != 'NULL'}
                letra = (r[6] or '').strip().upper()
                tipo = ContenidoAdminDAO._tipo_pregunta(r[2], r[8])
                visual = r[7] if isinstance(r[7], dict) else (json.loads(r[7]) if r[7] else None)
                q = (visual or {}).get('q') if isinstance(visual, dict) else None
                simple = (isinstance(q, list) and len(q) == 1 and isinstance(q[0], dict) and q[0].get('i')
                          and not str(q[0]['i']).startswith('mat_'))
                preguntas.append({
                    "id_punto": r[0], "enunciado": r[1], "tipo": tipo, "pista": r[9],
                    "correcta": opciones.get(letra) if tipo == 'pregunta' else None,
                    "otras": [v for L, v in opciones.items() if not (tipo == 'pregunta' and L == letra)],
                    "imagen": ({"i": q[0]['i'], "n": int(q[0].get('n') or 1)} if simple else None),
                    "tiene_visual": bool(q)
                })
            cur.close()
            return {"id_actividad": a[0], "titulo_actividad": a[1], "tipo_contenido": a[2],
                    "id_unidad": a[3], "titulo_unidad": a[4], "id_curso": a[5], "titulo_curso": a[6], "numero": a[7],
                    "preguntas": preguntas}
        finally:
            DatabaseConnection.return_connection(conn)

    @staticmethod
    def actualizar_actividad(id_actividad, titulo, id_punto, cambios):
        """Actualiza el título y UNA pregunta en una sola transacción (si algo falla, no cambia nada).
        cambios: {enunciado, correcta, otras, pista, imagen, cantidad} según el tipo de la pregunta.
        Devuelve None si la actividad no existe, 'PREGUNTA_NO_EXISTE' si la pregunta no es de la actividad."""
        conn = DatabaseConnection.get_connection()
        try:
            cur = conn.cursor()
            cur.execute("SELECT 1 FROM actividad WHERE id_actividad = %s FOR UPDATE;", (id_actividad,))
            if not cur.fetchone():
                conn.rollback()
                return None
            cur.execute("""SELECT opcion_a, respuesta_correcta, es_opinion, visual
                           FROM preg_punto WHERE id_punto = %s AND id_actividad = %s FOR UPDATE;""", (id_punto, id_actividad))
            p = cur.fetchone()
            if not p:
                conn.rollback()
                return 'PREGUNTA_NO_EXISTE'
            tipo = ContenidoAdminDAO._tipo_pregunta(p[0], p[2])
            cur.execute("UPDATE actividad SET titulo_actividad = %s WHERE id_actividad = %s;", (titulo, id_actividad))

            sets, vals = ["enunciado = %s"], [cambios['enunciado']]
            if tipo != 'teoria':
                # La correcta conserva su letra (el historial de respuestas guarda letras); las demás llenan el resto
                letra = (p[1] or 'A').strip().upper() if tipo == 'pregunta' else None
                textos = list(cambios['otras'])
                opciones = {}
                for L in 'ABCD':
                    if L == letra:
                        opciones[L] = cambios['correcta']
                    else:
                        opciones[L] = textos.pop(0) if textos else None
                sets += ["opcion_a = %s", "opcion_b = %s", "opcion_c = %s", "opcion_d = %s"]
                vals += [opciones['A'], opciones['B'], opciones['C'], opciones['D']]
                if tipo == 'pregunta':
                    sets.append("pista = %s")
                    vals.append(cambios.get('pista') or None)
            if cambios.get('imagen'):
                # Imagen nueva de la galería: reemplaza la del enunciado y quita la "solución" anterior (ya no coincidiría)
                visual = {"q": [{"i": cambios['imagen'], "n": cambios.get('cantidad') or 1}]}
                sets.append("visual = %s::jsonb")
                vals.append(json.dumps(visual))
            cur.execute(f"UPDATE preg_punto SET {', '.join(sets)} WHERE id_punto = %s;", (*vals, id_punto))
            conn.commit()
            cur.close()
            return {"id_actividad": id_actividad, "titulo_actividad": titulo, "id_punto": id_punto, "tipo": tipo}
        except Exception:
            conn.rollback()
            raise
        finally:
            DatabaseConnection.return_connection(conn)
