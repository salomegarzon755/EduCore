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
