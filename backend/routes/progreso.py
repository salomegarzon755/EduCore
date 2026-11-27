"""HU.33 (Familia) y HU.34 (Docente) · Progreso del curso por estudiante.

Familia (sesión del portal «Padre o Madre», que usa la cuenta del estudiante):
  GET /api/familia/estudiantes/<id>/resumen[?id_grupo=]       -> estudiante, grupos y avance por curso
  GET /api/familia/estudiantes/<id>/cursos/<id_curso>/progreso -> temas y resultados de cada actividad
  Solo se consulta al estudiante asociado a la sesión. Cualquier otro id responde 403 con
  codigo=ACCESO_RESTRINGIDO y NO revela datos del otro estudiante (ni siquiera si existe).

Docente (sesión del portal Docente):
  GET /api/docentes/<id>/progreso                                      -> grupos propios y sus cursos
  GET /api/docentes/<id>/grupos/<id_grupo>/progreso[?id_curso=]        -> avance de cada estudiante
  GET /api/docentes/<id>/grupos/<id_grupo>/estudiantes/<id_est>/progreso[?id_curso=] -> detalle
  Solo grupos del propio docente, estudiantes inscritos en ellos y cursos asignados al grupo.
"""
from flask import Blueprint, jsonify, request, g, current_app
from auth import require_auth
from config.database import DatabaseConnection
from dao import progreso_dao as P

progreso_bp = Blueprint('progreso', __name__, url_prefix='/api')


class Rechazo(Exception):
    def __init__(self, mensaje, estado=403, **extra):
        super().__init__(mensaje)
        self.estado, self.extra = estado, extra


def _consultar(fn):
    """Abre conexión de solo lectura, ejecuta fn(cur) y traduce rechazos y errores a JSON."""
    conn = None
    try:
        conn = DatabaseConnection.get_connection()
        with conn.cursor() as cur:
            return jsonify(success=True, **fn(cur)), 200
    except Rechazo as r:
        return jsonify(success=False, message=str(r), **r.extra), r.estado
    except Exception:
        current_app.logger.exception('Error consultando progreso')
        return jsonify(success=False, message='No se pudo consultar el progreso. Intenta nuevamente.'), 500
    finally:
        if conn:
            conn.rollback()
            DatabaseConnection.return_connection(conn)


# ---------------------------------------------------------------- Familia (HU.33)

def _familia(cur, id_estudiante):
    """Valida el portal familiar y que el estudiante pedido sea el asociado a la sesión."""
    if g.identity.get('portal') != 'Padre o Madre':
        raise Rechazo('Acceso reservado al espacio de familias.')
    asociado = P.datos_estudiante(cur, g.identity['id'])
    if not asociado:
        raise Rechazo('Sesión sin estudiante asociado.', 401)
    if id_estudiante != g.identity['id']:
        raise Rechazo('No tienes acceso a estos resultados.', 403, codigo='ACCESO_RESTRINGIDO',
                      estudiante_asociado={'id_estudiante': asociado['id_estudiante'],
                                           'nombre': asociado['nombre']})
    return asociado


@progreso_bp.get('/familia/estudiantes/<int:id_estudiante>/resumen')
@require_auth('Estudiante')
def familia_resumen(id_estudiante):
    id_grupo = request.args.get('id_grupo', type=int)

    def consulta(cur):
        estudiante = _familia(cur, id_estudiante)
        grupos = P.grupos_estudiante(cur, id_estudiante)
        ids = [x['id_grupo'] for x in grupos]
        if id_grupo is not None:
            if id_grupo not in ids:
                raise Rechazo('Este grupo no está asignado al estudiante.', 403, codigo='GRUPO_NO_ASIGNADO')
            ids = [id_grupo]
        cursos = []
        for c in P.cursos_de_grupos(cur, ids):
            prog = P.progreso_curso(cur, id_estudiante, c['id_curso'])
            cursos.append({**P.resumen_progreso(prog), 'id_grupo': c['id_grupo'], 'nombre_grupo': c['nombre_grupo']})
        return {'estudiante': estudiante, 'grupos': grupos,
                'grupo_actual': next((x for x in grupos if x['id_grupo'] in ids), None) if id_grupo else None,
                'cursos': cursos}
    return _consultar(consulta)


@progreso_bp.get('/familia/estudiantes/<int:id_estudiante>/cursos/<int:id_curso>/progreso')
@require_auth('Estudiante')
def familia_progreso_curso(id_estudiante, id_curso):
    def consulta(cur):
        estudiante = _familia(cur, id_estudiante)
        grupos = P.grupos_estudiante(cur, id_estudiante)
        curso = next((c for c in P.cursos_de_grupos(cur, [x['id_grupo'] for x in grupos])
                      if c['id_curso'] == id_curso), None)
        if not curso:
            raise Rechazo('Este curso no está asignado a los grupos del estudiante.', 403, codigo='CURSO_NO_ASIGNADO')
        grupo = next(x for x in grupos if x['id_grupo'] == curso['id_grupo'])
        return {'estudiante': estudiante, 'grupo': grupo,
                'progreso': P.progreso_curso(cur, id_estudiante, id_curso)}
    return _consultar(consulta)


# ---------------------------------------------------------------- Docente (HU.34)

def _docente(id_docente):
    if g.identity.get('portal') != 'Docente' or g.identity['id'] != id_docente:
        raise Rechazo('Acceso no autorizado.')


def _grupo_del_docente(cur, id_docente, id_grupo):
    cur.execute('SELECT id_grupo, nombre_grupo, grado, id_docente FROM grupo WHERE id_grupo=%s', (id_grupo,))
    r = cur.fetchone()
    if not r:
        raise Rechazo('El grupo no existe.', 404)
    if r[3] != id_docente:
        raise Rechazo('No puedes consultar el progreso de un grupo de otro docente.', 403)
    cur.execute('''SELECT c.id_curso, c.titulo_curso FROM grupo_curso gc JOIN curso c ON c.id_curso = gc.id_curso
                   WHERE gc.id_grupo=%s ORDER BY c.id_curso''', (id_grupo,))
    cursos = [{'id_curso': x[0], 'titulo_curso': x[1]} for x in cur.fetchall()]
    return {'id_grupo': r[0], 'nombre_grupo': r[1], 'grado': r[2] or 'Primero', 'cursos': cursos}


def _curso_elegido(grupo):
    """Curso pedido (?id_curso) si pertenece al grupo; si no se indica, el primero del grupo."""
    id_curso = request.args.get('id_curso', type=int)
    if id_curso is None:
        return grupo['cursos'][0]['id_curso'] if grupo['cursos'] else None
    if not any(c['id_curso'] == id_curso for c in grupo['cursos']):
        raise Rechazo('Ese curso no está asignado a este grupo.', 404)
    return id_curso


@progreso_bp.get('/docentes/<int:id_docente>/progreso')
@require_auth('Docente')
def docente_grupos(id_docente):
    def consulta(cur):
        _docente(id_docente)
        cur.execute('''SELECT g.id_grupo, g.nombre_grupo, g.grado,
                              (SELECT COUNT(*) FROM estudiante_grupo eg WHERE eg.id_grupo = g.id_grupo)
                       FROM grupo g WHERE g.id_docente=%s ORDER BY g.nombre_grupo, g.id_grupo''', (id_docente,))
        grupos = [{'id_grupo': r[0], 'nombre_grupo': r[1], 'grado': r[2] or 'Primero', 'total_estudiantes': r[3]}
                  for r in cur.fetchall()]
        for gr in grupos:
            gr['cursos'] = _grupo_del_docente(cur, id_docente, gr['id_grupo'])['cursos']
        return {'grupos': grupos}
    return _consultar(consulta)


@progreso_bp.get('/docentes/<int:id_docente>/grupos/<int:id_grupo>/progreso')
@require_auth('Docente')
def docente_progreso_grupo(id_docente, id_grupo):
    def consulta(cur):
        _docente(id_docente)
        grupo = _grupo_del_docente(cur, id_docente, id_grupo)
        id_curso = _curso_elegido(grupo)
        cur.execute('''SELECT u.id_usuario FROM usuario u JOIN estudiante_grupo eg ON eg.id_estudiante = u.id_usuario
                       WHERE eg.id_grupo=%s ORDER BY u.nombre''', (id_grupo,))
        ids = [r[0] for r in cur.fetchall()]
        estudiantes = []
        for id_est in ids:
            item = P.datos_estudiante(cur, id_est)
            if item and id_curso:
                item.update(P.resumen_progreso(P.progreso_curso(cur, id_est, id_curso)))
            if item:
                estudiantes.append(item)
        curso = next((c for c in grupo['cursos'] if c['id_curso'] == id_curso), None)
        return {'grupo': grupo, 'curso': curso, 'estudiantes': estudiantes}
    return _consultar(consulta)


@progreso_bp.get('/docentes/<int:id_docente>/grupos/<int:id_grupo>/estudiantes/<int:id_estudiante>/progreso')
@require_auth('Docente')
def docente_progreso_estudiante(id_docente, id_grupo, id_estudiante):
    def consulta(cur):
        _docente(id_docente)
        grupo = _grupo_del_docente(cur, id_docente, id_grupo)
        cur.execute('SELECT 1 FROM estudiante_grupo WHERE id_grupo=%s AND id_estudiante=%s', (id_grupo, id_estudiante))
        if not cur.fetchone():
            raise Rechazo('El estudiante no pertenece a este grupo.', 404)
        id_curso = _curso_elegido(grupo)
        if id_curso is None:
            raise Rechazo('El grupo todavía no tiene cursos asignados.', 404)
        return {'grupo': grupo, 'estudiante': P.datos_estudiante(cur, id_estudiante),
                'progreso': P.progreso_curso(cur, id_estudiante, id_curso)}
    return _consultar(consulta)
