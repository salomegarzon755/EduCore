"""HU.23 · Crear curso predefinido (rol Administrador).

GET  /api/admin/cursos       -> listado de cursos disponibles (nombre, grado, descripción)
GET  /api/admin/cursos/<id>  -> HU.24 · detalle de un curso (nombre, grado y descripción)
DELETE /api/admin/cursos/<id> -> HU.26 · elimina un curso sin grupos ni contenido
POST /api/admin/cursos  -> registra un curso predefinido; nombre, grado y descripción
                           son obligatorios (CA-02: si falta alguno no se guarda).
"""
from flask import Blueprint, jsonify, request
from auth import require_auth
from dao.curso_dao import CursoDAO

admin_cursos_bp = Blueprint('admin_cursos', __name__, url_prefix='/api/admin')

GRADOS_VALIDOS = (1, 2)
MAX_NOMBRE = 150
MAX_DESCRIPCION = 500

ETIQUETAS = {'nombre': 'el nombre', 'grado': 'el grado', 'descripcion': 'la descripción'}


def _validar(data):
    """Devuelve (valores_limpios, errores_por_campo)."""
    nombre = (data.get('nombre') or '').strip()
    descripcion = (data.get('descripcion') or '').strip()
    grado_raw = data.get('grado')
    errores = {}

    if not nombre:
        errores['nombre'] = 'Escribe el nombre del curso.'
    elif len(nombre) > MAX_NOMBRE:
        errores['nombre'] = f'El nombre no puede superar {MAX_NOMBRE} caracteres.'

    grado = None
    try:
        grado = int(grado_raw) if grado_raw not in (None, '') else None
    except (TypeError, ValueError):
        grado = None
    if grado is None:
        errores['grado'] = 'Selecciona el grado del curso.'
    elif grado not in GRADOS_VALIDOS:
        errores['grado'] = 'El grado debe ser 1.° o 2.° de primaria.'

    if not descripcion:
        errores['descripcion'] = 'Escribe la descripción del curso.'
    elif len(descripcion) > MAX_DESCRIPCION:
        errores['descripcion'] = f'La descripción no puede superar {MAX_DESCRIPCION} caracteres.'

    return {'nombre': nombre, 'grado': grado, 'descripcion': descripcion}, errores


def _mensaje_faltantes(errores, valores):
    faltan = [ETIQUETAS[c] for c in ('nombre', 'grado', 'descripcion')
              if c in errores and not valores[c]]
    if not faltan:
        return 'Revisa los campos marcados para guardar el curso.'
    if len(faltan) == 1:
        return f'Falta {faltan[0]}. Completa el campo para guardar.'
    return f"Faltan {', '.join(faltan[:-1])} y {faltan[-1]}. Completa los campos para guardar."


@admin_cursos_bp.route('/cursos', methods=['GET'])
@require_auth('Administrador')
def listar_cursos():
    cursos = CursoDAO.listar_para_admin()
    if cursos is None:
        return jsonify(success=False, message='No se pudo cargar el listado de cursos.'), 500
    return jsonify(success=True, cursos=cursos), 200


@admin_cursos_bp.route('/cursos', methods=['POST'])
@require_auth('Administrador')
def crear_curso():
    valores, errores = _validar(request.get_json(silent=True) or {})
    if errores:
        return jsonify(success=False, message=_mensaje_faltantes(errores, valores), errores=errores), 400

    curso = CursoDAO.crear_predefinido(valores['nombre'], valores['grado'], valores['descripcion'])
    if not curso:
        return jsonify(success=False, message='No se pudo guardar el curso. Intenta de nuevo.'), 500
    return jsonify(success=True,
                   message=f"{curso['titulo_curso']} se guardó correctamente.",
                   curso=curso), 201


@admin_cursos_bp.route('/cursos/<int:id_curso>', methods=['GET'])
@require_auth('Administrador')
def detalle_curso(id_curso):
    """HU.24 · CA-02: nombre, grado y descripción del curso seleccionado."""
    try:
        curso = CursoDAO.obtener_para_admin(id_curso)
    except Exception as e:
        print(f"Error en detalle_curso: {e}")
        return jsonify(success=False, message='No se pudo cargar el curso. Intenta de nuevo.'), 500
    if not curso:
        return jsonify(success=False, message='No encontramos ese curso.'), 404
    return jsonify(success=True, curso=curso), 200


@admin_cursos_bp.route('/cursos/<int:id_curso>', methods=['DELETE'])
@require_auth('Administrador')
def eliminar_curso(id_curso):
    """HU.26 · CA-01: quita el curso de la plataforma y confirma.
    Solo se eliminan cursos sin grupos asignados y sin contenido, para no borrar el progreso de estudiantes."""
    try:
        r = CursoDAO.eliminar_si_sin_uso(id_curso)
    except Exception as e:
        print(f"Error en eliminar_curso: {e}")
        return jsonify(success=False, message='No se pudo eliminar el curso. Intenta de nuevo.'), 500
    if r["ok"]:
        return jsonify(success=True, message=f"Se eliminó el curso {r['curso']['titulo_curso']}.", curso=r["curso"]), 200
    if r["codigo"] == "NO_ENCONTRADO":
        return jsonify(success=False, message='Ese curso ya no existe.'), 404
    motivos = []
    if r["total_grupos"]:
        motivos.append(f"está asignado a {r['total_grupos']} grupo{'s' if r['total_grupos'] != 1 else ''}")
    if r["total_unidades"]:
        motivos.append("ya tiene contenido (unidades y actividades)")
    return jsonify(success=False, codigo='EN_USO',
                   message=f"No se puede eliminar {r['titulo_curso']}: {' y '.join(motivos)}."), 409
