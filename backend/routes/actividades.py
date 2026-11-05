from flask import Blueprint, jsonify, request
from dao.actividad_dao import ActividadDAO
from dao.curso_dao import CursoDAO

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


@actividades_bp.route('/estudiantes/<int:id_estudiante>/cursos', methods=['GET'])
def obtener_cursos_estudiante(id_estudiante):
    try:
        # 1. Intentar obtener el curso asignado al estudiante por su grupo
        curso_basico = CursoDAO.obtener_curso_estudiante(id_estudiante)
        
        # 2. Si no devuelve curso, usar id_curso = 1 (Matemáticas) como fallback
        id_curso = curso_basico['id_curso'] if curso_basico else 1

        # 3. Obtener el detalle completo calculando el progreso del id_estudiante
        detalle_curso = CursoDAO.obtener_detalle_completo(id_curso, id_estudiante=id_estudiante)

        return jsonify({
            'success': True,
            'cursos': [detalle_curso] if detalle_curso else []
        }), 200
    except Exception as e:
        print(f"Error al obtener cursos del estudiante: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500