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


# ======================================================================
# HU.28 · Unidades y actividades interactivas (rol Administrador)
#   GET  /api/admin/cursos/<id>/unidades        -> unidades del curso
#   POST /api/admin/cursos/<id>/unidades        -> agrega una unidad (solo nombre)
#   GET  /api/admin/unidades/<id>/actividades   -> actividades de la unidad
#   POST /api/admin/unidades/<id>/actividades   -> crea una actividad (CA-01 / CA-02)
# ======================================================================
from dao.contenido_admin_dao import ContenidoAdminDAO

# Galería de imágenes de EduCore (img/files/EduCore_Identidad/04_decorativos/png/<nombre>.png)
GALERIA = ('ave_tuki', 'banano', 'coco', 'estrella', 'flor_coral', 'flor_lila', 'flor_rosa', 'helecho',
           'hoja_palma', 'hoja_tropical', 'mango', 'manos', 'mariposa', 'nube', 'papaya', 'piedra',
           'pina', 'rana_kokoi', 'sandia')
MAX_TITULO, MAX_TEXTO, MAX_OPCION = 150, 300, 60


@admin_cursos_bp.route('/cursos/<int:id_curso>/unidades', methods=['GET'])
@require_auth('Administrador')
def listar_unidades(id_curso):
    try:
        unidades = ContenidoAdminDAO.listar_unidades(id_curso)
    except Exception as e:
        print(f"Error en listar_unidades: {e}")
        return jsonify(success=False, message='No se pudieron cargar las unidades.'), 500
    if unidades is None:
        return jsonify(success=False, message='No encontramos ese curso.'), 404
    return jsonify(success=True, unidades=unidades), 200


@admin_cursos_bp.route('/cursos/<int:id_curso>/unidades', methods=['POST'])
@require_auth('Administrador')
def crear_unidad(id_curso):
    titulo = ((request.get_json(silent=True) or {}).get('titulo') or '').strip()
    if not titulo:
        return jsonify(success=False, message='Escribe el nombre de la unidad.', errores={'titulo': 'Escribe el nombre de la unidad.'}), 400
    if len(titulo) > MAX_TITULO:
        return jsonify(success=False, message=f'El nombre no puede superar {MAX_TITULO} caracteres.'), 400
    try:
        unidad = ContenidoAdminDAO.crear_unidad(id_curso, titulo)
    except Exception as e:
        print(f"Error en crear_unidad: {e}")
        return jsonify(success=False, message='No se pudo crear la unidad. Intenta de nuevo.'), 500
    if unidad is None:
        return jsonify(success=False, message='No encontramos ese curso.'), 404
    return jsonify(success=True, message=f"Se agregó la unidad {titulo}.", unidad=unidad), 201


@admin_cursos_bp.route('/unidades/<int:id_unidad>/actividades', methods=['GET'])
@require_auth('Administrador')
def listar_actividades_unidad(id_unidad):
    try:
        unidad = ContenidoAdminDAO.detalle_unidad(id_unidad)
    except Exception as e:
        print(f"Error en listar_actividades_unidad: {e}")
        return jsonify(success=False, message='No se pudieron cargar las actividades.'), 500
    if unidad is None:
        return jsonify(success=False, message='No encontramos esa unidad.'), 404
    return jsonify(success=True, unidad=unidad), 200


ETIQUETAS_ACT = {'titulo': 'el título', 'pregunta': 'la pregunta', 'correcta': 'la respuesta correcta',
                 'otras': 'las otras opciones', 'imagen': 'la imagen'}


def _validar_actividad(d):
    t = lambda k: (d.get(k) or '').strip() if isinstance(d.get(k), str) else ''
    titulo, pregunta, correcta, pista = t('titulo'), t('pregunta'), t('correcta'), t('pista')
    otras = [o.strip() for o in (d.get('otras') or []) if isinstance(o, str) and o.strip()]
    imagen = d.get('imagen') if isinstance(d.get('imagen'), str) else ''
    try:
        cantidad = int(d.get('cantidad') or 1)
    except (TypeError, ValueError):
        cantidad = 0
    e, faltan = {}, []
    if not titulo: e['titulo'] = 'Escribe el título de la actividad.'; faltan.append('titulo')
    elif len(titulo) > MAX_TITULO: e['titulo'] = f'El título no puede superar {MAX_TITULO} caracteres.'
    if not pregunta: e['pregunta'] = 'Escribe el texto de la pregunta.'; faltan.append('pregunta')
    elif len(pregunta) > MAX_TEXTO: e['pregunta'] = f'La pregunta no puede superar {MAX_TEXTO} caracteres.'
    if not correcta: e['correcta'] = 'Escribe la respuesta correcta.'; faltan.append('correcta')
    elif len(correcta) > MAX_OPCION: e['correcta'] = f'La respuesta no puede superar {MAX_OPCION} caracteres.'
    if len(otras) < 2: e['otras'] = 'Escribe al menos 2 opciones más para que el estudiante elija.'; faltan.append('otras')
    elif len(otras) > 3 or any(len(o) > MAX_OPCION for o in otras): e['otras'] = f'Máximo 3 opciones de hasta {MAX_OPCION} caracteres.'
    else:
        normal = [x.lower() for x in [correcta] + otras]
        if len(set(normal)) != len(normal): e['otras'] = 'Las opciones no pueden repetirse ni ser iguales a la respuesta correcta.'
    if imagen not in GALERIA: e['imagen'] = 'Elige una imagen de la galería.'; faltan.append('imagen')
    if not 1 <= cantidad <= 12: e['cantidad'] = 'La cantidad de imágenes debe estar entre 1 y 12.'
    if len(pista) > MAX_TEXTO: e['pista'] = f'La pista no puede superar {MAX_TEXTO} caracteres.'
    valores = dict(titulo=titulo, pregunta=pregunta, correcta=correcta, otras=otras, pista=pista,
                   imagen=imagen, cantidad=cantidad)
    return valores, e, faltan


@admin_cursos_bp.route('/unidades/<int:id_unidad>/actividades', methods=['POST'])
@require_auth('Administrador')
def crear_actividad(id_unidad):
    """HU.28 · CA-01: crea la actividad dentro de la unidad. CA-02: si falta algo, la indica y no la crea."""
    v, errores, faltan = _validar_actividad(request.get_json(silent=True) or {})
    if errores:
        if faltan:
            nombres = [ETIQUETAS_ACT[k] for k in faltan]
            msg = f"Completa {nombres[0]}." if len(nombres) == 1 else f"Completa {', '.join(nombres[:-1])} y {nombres[-1]}."
        else:
            msg = 'Revisa los campos marcados para guardar la actividad.'
        return jsonify(success=False, message=msg, errores=errores), 400
    try:
        act = ContenidoAdminDAO.crear_actividad(id_unidad, v['titulo'], v['pregunta'], v['correcta'],
                                                v['otras'], v['pista'], v['imagen'], v['cantidad'])
    except Exception as e:
        print(f"Error en crear_actividad: {e}")
        return jsonify(success=False, message='No se pudo crear la actividad. Intenta de nuevo.'), 500
    if act is None:
        return jsonify(success=False, message='No encontramos esa unidad.'), 404
    return jsonify(success=True, message='Actividad creada en la unidad.', actividad=act), 201


# ======================================================================
# HU.29 · Editar el contenido de una actividad (rol Administrador)
#   GET /api/admin/actividades/<id>  -> título y todas sus preguntas
#   PUT /api/admin/actividades/<id>  -> guarda el título y UNA pregunta (CA-01);
#                                       si algo es inválido, no cambia nada (CA-02)
# ======================================================================
@admin_cursos_bp.route('/actividades/<int:id_actividad>', methods=['GET'])
@require_auth('Administrador')
def obtener_actividad_admin(id_actividad):
    try:
        act = ContenidoAdminDAO.obtener_actividad(id_actividad)
    except Exception as e:
        print(f"Error en obtener_actividad_admin: {e}")
        return jsonify(success=False, message='No se pudo cargar la actividad.'), 500
    if act is None:
        return jsonify(success=False, message='No encontramos esa actividad.'), 404
    return jsonify(success=True, actividad=act), 200


VACIOS = {'titulo': 'Título vacío', 'enunciado': 'Texto vacío', 'correcta': 'Respuesta vacía',
          'otras': 'Faltan opciones'}


@admin_cursos_bp.route('/actividades/<int:id_actividad>', methods=['PUT'])
@require_auth('Administrador')
def actualizar_actividad_admin(id_actividad):
    d = request.get_json(silent=True) or {}
    t = lambda k: (d.get(k) or '').strip() if isinstance(d.get(k), str) else ''
    titulo, enunciado, correcta, pista = t('titulo'), t('enunciado'), t('correcta'), t('pista')
    otras = [o.strip() for o in (d.get('otras') or []) if isinstance(o, str) and o.strip()]
    imagen = d.get('imagen') if isinstance(d.get('imagen'), str) and d.get('imagen') else None
    try:
        id_punto = int(d.get('id_punto'))
        cantidad = int(d.get('cantidad') or 1)
    except (TypeError, ValueError):
        return jsonify(success=False, message='Datos inválidos. No se guardaron cambios.'), 400

    try:
        act = ContenidoAdminDAO.obtener_actividad(id_actividad)
    except Exception as e:
        print(f"Error en actualizar_actividad_admin: {e}")
        return jsonify(success=False, message='No se pudo cargar la actividad.'), 500
    if act is None:
        return jsonify(success=False, message='No encontramos esa actividad.'), 404
    pregunta = next((p for p in act['preguntas'] if p['id_punto'] == id_punto), None)
    if pregunta is None:
        return jsonify(success=False, message='Esa pregunta no pertenece a la actividad.'), 404
    tipo = pregunta['tipo']

    # CA-02: validación según el tipo de pregunta (teoría / opinión / pregunta)
    e, vacios = {}, []
    if not titulo: e['titulo'] = 'Escribe el título de la actividad.'; vacios.append('titulo')
    elif len(titulo) > MAX_TITULO: e['titulo'] = f'El título no puede superar {MAX_TITULO} caracteres.'
    if not enunciado: e['enunciado'] = 'Escribe el texto.'; vacios.append('enunciado')
    elif len(enunciado) > MAX_TEXTO: e['enunciado'] = f'El texto no puede superar {MAX_TEXTO} caracteres.'
    if tipo == 'pregunta':
        if not correcta: e['correcta'] = 'Escribe la respuesta correcta.'; vacios.append('correcta')
        elif len(correcta) > MAX_OPCION: e['correcta'] = f'La respuesta no puede superar {MAX_OPCION} caracteres.'
        if len(otras) < 2: e['otras'] = 'Escribe al menos 2 opciones más para que el estudiante elija.'; vacios.append('otras')
        elif len(otras) > 3 or any(len(o) > MAX_OPCION for o in otras): e['otras'] = f'Máximo 3 opciones de hasta {MAX_OPCION} caracteres.'
        else:
            todas = [x.lower() for x in [correcta] + otras]
            if len(set(todas)) != len(todas): e['otras'] = 'Las opciones no pueden repetirse ni ser iguales a la respuesta correcta.'
        if len(pista) > MAX_TEXTO: e['pista'] = f'La pista no puede superar {MAX_TEXTO} caracteres.'
    elif tipo == 'opinion':
        if len(otras) < 2: e['otras'] = 'Escribe al menos 2 opciones.'; vacios.append('otras')
        elif len(otras) > 4 or any(len(o) > MAX_OPCION for o in otras): e['otras'] = f'Máximo 4 opciones de hasta {MAX_OPCION} caracteres.'
        elif len({o.lower() for o in otras}) != len(otras): e['otras'] = 'Las opciones no pueden repetirse.'
    if imagen is not None:
        if imagen not in GALERIA: e['imagen'] = 'Elige una imagen de la galería.'
        if not 1 <= cantidad <= 12: e['cantidad'] = 'La cantidad de imágenes debe estar entre 1 y 12.'
    if e:
        if len(vacios) == 1:
            msg = f"{VACIOS[vacios[0]]}. No se guardaron cambios."
        elif vacios:
            msg = 'Hay campos vacíos. No se guardaron cambios.'
        else:
            msg = 'Contenido inválido. No se guardaron cambios.'
        return jsonify(success=False, message=msg, errores=e), 400

    try:
        r = ContenidoAdminDAO.actualizar_actividad(id_actividad, titulo, id_punto, {
            'enunciado': enunciado, 'correcta': correcta, 'otras': otras, 'pista': pista,
            'imagen': imagen, 'cantidad': cantidad})
    except Exception as ex:
        print(f"Error en actualizar_actividad_admin: {ex}")
        return jsonify(success=False, message='No se pudieron guardar los cambios. Se conserva la versión anterior.'), 500
    if r is None:
        return jsonify(success=False, message='No encontramos esa actividad.'), 404
    if r == 'PREGUNTA_NO_EXISTE':
        return jsonify(success=False, message='Esa pregunta no pertenece a la actividad.'), 404
    return jsonify(success=True, message='Cambios guardados.', actividad=r), 200
