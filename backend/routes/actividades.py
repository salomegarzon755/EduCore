from flask import Blueprint, jsonify, request
from dao.actividad_dao import ActividadDAO

actividades_bp = Blueprint('actividades', __name__, url_prefix='/api')


@actividades_bp.route('/actividades/<int:id_actividad>', methods=['GET'])
def meta_actividad(id_actividad):
    meta = ActividadDAO.obtener_meta(id_actividad)
    if not meta:
        return jsonify({"success": False, "message": "Actividad no encontrada"}), 404
    return jsonify({"success": True, "actividad": meta}), 200


@actividades_bp.route('/estudiantes/<int:id_estudiante>/progreso', methods=['GET'])
def progreso_estudiante(id_estudiante):
    id_curso = request.args.get('id_curso', type=int)
    if not id_curso:
        return jsonify({"success": False, "message": "Falta id_curso"}), 400
    return jsonify({"success": True, "progreso": ActividadDAO.obtener_progreso(id_estudiante, id_curso)}), 200


@actividades_bp.route('/resultados', methods=['POST'])
def guardar_resultado():
    d = request.get_json(silent=True) or {}
    try:
        id_est, id_act = int(d['id_estudiante']), int(d['id_actividad'])
        total = max(0, int(d.get('total', 0)))
        aciertos = min(max(0, int(d.get('aciertos', 0))), total)
    except (KeyError, ValueError, TypeError):
        return jsonify({"success": False, "message": "Datos incompletos"}), 400
    
    res = ActividadDAO.guardar_resultado(id_est, id_act, aciertos, total, d.get('respuestas') or [])
    return jsonify(res), (200 if res["success"] else 500)
