from flask import Blueprint, jsonify, request, g
from dao.actividad_dao import ActividadDAO

actividades_bp = Blueprint('actividades', __name__, url_prefix='/api')


@actividades_bp.route('/actividades/<int:id_actividad>', methods=['GET'])
def meta_actividad(id_actividad):
    meta = ActividadDAO.obtener_meta(id_actividad)
    if not meta:
        return jsonify({"success": False, "message": "Actividad no encontrada"}), 404
    return jsonify({"success": True, "actividad": meta}), 200


def _es_el_estudiante(id_estudiante):
    """La sesión (validada en app.before_request) debe ser la del propio estudiante en su portal."""
    ident = getattr(g, 'identity', None) or {}
    return (ident.get('rol') == 'Estudiante' and ident.get('portal') == 'Estudiante'
            and ident.get('id') == id_estudiante)


@actividades_bp.route('/estudiantes/<int:id_estudiante>/progreso', methods=['GET'])
def progreso_estudiante(id_estudiante):
    if not _es_el_estudiante(id_estudiante):
        return jsonify({"success": False, "message": "No autorizado para consultar este progreso."}), 403
    id_curso = request.args.get('id_curso', type=int)
    if not id_curso:
        return jsonify({"success": False, "message": "Falta id_curso"}), 400
    return jsonify({"success": True, "progreso": ActividadDAO.obtener_progreso(id_estudiante, id_curso)}), 200


@actividades_bp.route('/resultados', methods=['POST'])
def guardar_resultado():
    """Guarda un intento. HU.32: devuelve la puntuación del intento y el mensaje de felicitación.
    La nota se calcula en el servidor a partir de las respuestas; aciertos/total del cliente se ignoran."""
    d = request.get_json(silent=True) or {}
    try:
        id_est, id_act = int(d['id_estudiante']), int(d['id_actividad'])
    except (KeyError, ValueError, TypeError):
        return jsonify({"success": False, "message": "Datos incompletos"}), 400
    if not _es_el_estudiante(id_est):
        return jsonify({"success": False, "message": "Solo puedes guardar tus propios resultados."}), 403
    respuestas = d.get('respuestas') or []
    if not isinstance(respuestas, list) or len(respuestas) > 200:
        return jsonify({"success": False, "message": "Respuestas inválidas"}), 400

    res = ActividadDAO.guardar_resultado(id_est, id_act, respuestas)
    if not res["success"]:
        estado = {"NO_ENCONTRADA": 404, "SIN_RESPUESTAS": 400}.get(res.get("codigo"), 500)
        return jsonify(res), estado
    res["felicitacion"] = ActividadDAO.mensaje_felicitacion(res["intento"]["aciertos"], res["intento"]["total"])
    return jsonify(res), 200
