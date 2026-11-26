"""HU.31 · Resumen al finalizar cada módulo (Estudiante).

GET /api/estudiantes/<id>/unidades/<id_unidad>/resumen
  - Un "módulo" es una unidad del curso.
  - Usa el ÚLTIMO intento de cada actividad de la unidad (respuesta_estudiante).
  - CA-01: preguntas correctas e incorrectas (respuesta elegida / correcta).
  - CA-02: temas por practicar = preguntas falladas, con la actividad para volver a practicar.
Solo el propio estudiante (con su sesión del portal Estudiante) puede consultar su resumen.
"""
from flask import Blueprint, jsonify, g
from auth import require_auth
from config.database import DatabaseConnection

resumen_bp = Blueprint('resumen_modulo', __name__, url_prefix='/api')


def _texto_opcion(fila, letra):
    """Texto de la opción A-D de una pregunta (fila: opcion_a..opcion_d)."""
    i = 'ABCD'.find((letra or '').strip().upper())
    if i < 0:
        return None
    v = fila[i]
    return v if v and v != 'NULL' else None


@resumen_bp.get('/estudiantes/<int:id_estudiante>/unidades/<int:id_unidad>/resumen')
@require_auth('Estudiante')
def resumen_modulo(id_estudiante, id_unidad):
    if g.identity['id'] != id_estudiante or g.identity.get('portal') != 'Estudiante':
        return jsonify(success=False, message='No autorizado para consultar este resumen.'), 403
    conn = DatabaseConnection.get_connection()
    if not conn:
        return jsonify(success=False, message='Sin conexión'), 503
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT u.id_unidad, u.titulo_unidad, c.id_curso, c.titulo_curso,
                   (SELECT COUNT(*) FROM unidad u2 WHERE u2.id_curso = c.id_curso AND u2.id_unidad <= u.id_unidad)
            FROM unidad u JOIN curso c ON c.id_curso = u.id_curso WHERE u.id_unidad = %s;""", (id_unidad,))
        u = cur.fetchone()
        if not u:
            return jsonify(success=False, message='No encontramos ese módulo.'), 404

        # Actividades del módulo y si el estudiante ya las completó
        cur.execute("""
            SELECT a.id_actividad, a.titulo_actividad,
                   EXISTS (SELECT 1 FROM resultado_actividad r
                           WHERE r.id_actividad = a.id_actividad AND r.id_estudiante = %s AND r.completada) AS hecha
            FROM actividad a WHERE a.id_unidad = %s ORDER BY a.id_actividad;""", (id_estudiante, id_unidad))
        actividades = cur.fetchall()
        total_act = len(actividades)
        hechas = sum(1 for a in actividades if a[2])

        # Preguntas con respuesta correcta (sin teoría ni encuestas) y la respuesta del ÚLTIMO intento
        cur.execute("""
            WITH ultimo AS (
                SELECT p.id_actividad, MAX(re.intento) AS intento
                FROM respuesta_estudiante re JOIN preg_punto p ON p.id_punto = re.id_punto
                JOIN actividad a ON a.id_actividad = p.id_actividad
                WHERE re.id_estudiante = %s AND a.id_unidad = %s
                GROUP BY p.id_actividad
            )
            SELECT p.id_punto, p.id_actividad, a.titulo_actividad, p.enunciado,
                   p.opcion_a, p.opcion_b, p.opcion_c, p.opcion_d, p.respuesta_correcta,
                   re.opcion_elegida, re.es_correcta
            FROM preg_punto p
            JOIN actividad a ON a.id_actividad = p.id_actividad
            JOIN ultimo ul ON ul.id_actividad = p.id_actividad
            JOIN LATERAL (
                SELECT r.opcion_elegida, r.es_correcta FROM respuesta_estudiante r
                WHERE r.id_estudiante = %s AND r.id_punto = p.id_punto AND r.intento = ul.intento
                ORDER BY r.id_respuesta DESC LIMIT 1
            ) re ON TRUE
            WHERE a.id_unidad = %s AND p.opcion_a IS NOT NULL AND p.opcion_a <> 'NULL'
              AND NOT COALESCE(p.es_opinion, FALSE)
            ORDER BY p.id_actividad, p.id_punto;""", (id_estudiante, id_unidad, id_estudiante, id_unidad))
        filas = cur.fetchall()

        # Pista de la HU.27 (si existe la columna) para orientar el repaso
        pistas = {}
        try:
            cur.execute("""SELECT p.id_punto, p.pista FROM preg_punto p JOIN actividad a ON a.id_actividad = p.id_actividad
                           WHERE a.id_unidad = %s;""", (id_unidad,))
            pistas = dict(cur.fetchall())
        except Exception:
            conn.rollback()
        cur.close()

        preguntas, temas = [], []
        for n, f in enumerate(filas, start=1):
            opciones = f[4:8]
            pregunta = {
                "numero": n, "id_punto": f[0], "id_actividad": f[1], "actividad": f[2], "enunciado": f[3],
                "tu_respuesta": _texto_opcion(opciones, f[9]) or '—',
                "correcta": _texto_opcion(opciones, f[8]) or '—',
                "es_correcta": bool(f[10])
            }
            preguntas.append(pregunta)
            if not pregunta["es_correcta"]:
                temas.append({"numero": n, "enunciado": f[3], "id_actividad": f[1], "actividad": f[2],
                              "pista": pistas.get(f[0])})
        correctas = sum(1 for p in preguntas if p["es_correcta"])
        total = len(preguntas)
        return jsonify(success=True, resumen={
            "id_unidad": u[0], "titulo_unidad": u[1], "id_curso": u[2], "titulo_curso": u[3], "numero": u[4],
            "actividades_total": total_act, "actividades_hechas": hechas,
            "completo": total_act > 0 and hechas == total_act,
            "correctas": correctas, "incorrectas": total - correctas,
            "puntuacion": round(correctas * 100 / total) if total else None,
            "preguntas": preguntas, "temas": temas
        }), 200
    except Exception as e:
        print('Error en resumen_modulo:', e)
        return jsonify(success=False, message='No se pudo cargar el resumen del módulo.'), 500
    finally:
        DatabaseConnection.return_connection(conn)
