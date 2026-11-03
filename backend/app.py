from flask import Flask, request, jsonify
from flask_cors import CORS
from dao.usuario_dao import UsuarioDAO
from models.usuario import Usuario
from dao.curso_dao import CursoDAO
from dao.grupo_dao import GrupoDAO

app = Flask(__name__)
CORS(app)

# --- AUTENTICACIÓN Y REGISTRO ---

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = data.get('usuario')
    password = data.get('contrasena')

    usuario_obj = UsuarioDAO.autenticar(username, password)
    if usuario_obj:
        return jsonify({"success": True, "user": usuario_obj.to_dict()}), 200
    return jsonify({"success": False, "message": "Usuario o contraseña incorrectos"}), 401

@app.route('/api/registro', methods=['POST'])
def registro():
    data = request.get_json() or {}
    nuevo_usuario = Usuario(
        nombre=data.get('nombre'),
        usuario=data.get('usuario'),
        contrasena=data.get('contrasena'),
        rol=data.get('rol', 'Estudiante')
    )
    creado = UsuarioDAO.crear(nuevo_usuario, correo=data.get('correo', ''))
    if creado:
        return jsonify({"success": True, "message": "Usuario registrado exitosamente", "user": nuevo_usuario.to_dict()}), 201
    return jsonify({"success": False, "message": "No se pudo registrar el usuario en la base de datos."}), 400

# --- RUTAS DE CURSOS Y CONTENIDO ---

@app.route('/api/cursos', methods=['GET'])
def obtener_cursos():
    cursos = CursoDAO.obtener_todos()
    return jsonify({"success": True, "cursos": cursos}), 200

@app.route('/api/cursos/completo', methods=['GET'])
def obtener_cursos_completo():
    cursos = CursoDAO.obtener_todos_con_contenido()
    return jsonify({"success": True, "cursos": cursos}), 200

@app.route('/api/cursos/<int:id_curso>/detalle_completo', methods=['GET'])
def get_curso_detalle_completo(id_curso):
    detalle = CursoDAO.obtener_detalle_completo(id_curso)
    if not detalle:
        return jsonify({"success": False, "message": "Curso no encontrado"}), 404
    return jsonify({"success": True, "curso": detalle}), 200

@app.route('/api/estudiantes/<int:id_estudiante>/curso', methods=['GET'])
def obtener_curso_estudiante(id_estudiante):
    curso = CursoDAO.obtener_curso_estudiante(id_estudiante)
    if not curso:
        return jsonify({"success": False, "message": "No hay curso asignado"}), 404
    return jsonify({"success": True, "curso": curso}), 200

@app.route('/api/cursos/<int:id_curso>/unidades', methods=['GET'])
def obtener_unidades_curso(id_curso):
    unidades = CursoDAO.obtener_unidades_por_curso(id_curso)
    return jsonify({"success": True, "unidades": unidades}), 200

@app.route('/api/unidades/<int:id_unidad>/actividades', methods=['GET'])
def obtener_actividades_unidad(id_unidad):
    actividades = CursoDAO.obtener_actividades_por_unidad(id_unidad)
    return jsonify({"success": True, "actividades": actividades}), 200

@app.route('/api/actividades/<int:id_actividad>/puntos', methods=['GET'])
@app.route('/api/actividades/<int:id_actividad>/preguntas', methods=['GET'])
def get_puntos_actividad(id_actividad):
    puntos = CursoDAO.obtener_puntos_de_actividad(id_actividad)
    return jsonify({"success": True, "puntos": puntos, "preguntas": puntos}), 200

# --- RUTAS DE GRUPOS (DOCENTE Y ESTUDIANTE) ---

@app.route('/api/estudiantes/<int:id_estudiante>/grupos', methods=['GET'])
def obtener_grupos_estudiante(id_estudiante):
    """Retorna los grupos en los que está inscrito el estudiante."""
    grupos = GrupoDAO.obtener_grupos_por_estudiante(id_estudiante)
    return jsonify({"success": True, "grupos": grupos}), 200

@app.route('/api/estudiantes/<int:id_estudiante>/cursos', methods=['GET'])
def obtener_cursos_estudiante(id_estudiante):
    """Retorna los cursos asignados a los grupos del estudiante calculando actividades reales de la BD."""
    cursos = GrupoDAO.obtener_cursos_por_estudiante(id_estudiante)
    return jsonify({"success": True, "cursos": cursos}), 200

@app.route('/api/grupos', methods=['POST'])
def crear_grupo():
    data = request.get_json() or {}
    nombre_grupo = data.get('nombre_grupo')
    grado = data.get('grado')
    descripcion = data.get('descripcion', '')
    id_docente = data.get('id_docente')
    ids_cursos = data.get('ids_cursos', [])

    if not nombre_grupo or not id_docente:
        return jsonify({"success": False, "message": "Faltan datos obligatorios"}), 400

    nuevo_grupo = GrupoDAO.crear_grupo(nombre_grupo, grado, descripcion, id_docente, ids_cursos)

    if nuevo_grupo:
        return jsonify({"success": True, "grupo": nuevo_grupo}), 201
    else:
        return jsonify({"success": False, "message": "Error al guardar en BD"}), 500

@app.route('/api/grupos/docente/<int:id_docente>', methods=['GET'])
def obtener_grupos_docente(id_docente):
    grupos = GrupoDAO.obtener_grupos_por_docente(id_docente)
    return jsonify({"success": True, "grupos": grupos}), 200

@app.route('/api/grupos/<int:id_grupo>', methods=['GET'])
def obtener_detalle_grupo(id_grupo):
    grupo = GrupoDAO.obtener_detalle_grupo(id_grupo)
    if not grupo:
        return jsonify({"success": False, "message": "Grupo no encontrado"}), 404
    
    estudiantes = GrupoDAO.obtener_estudiantes_del_grupo(id_grupo)
    grupo["estudiantes"] = estudiantes
    grupo["total_estudiantes"] = len(estudiantes)
    return jsonify({"success": True, "grupo": grupo}), 200

@app.route('/api/grupos/<int:id_grupo>/estudiantes/buscar', methods=['GET'])
def buscar_estudiantes_para_grupo(id_grupo):
    query_texto = request.args.get('q', '').strip()
    estudiantes = GrupoDAO.buscar_estudiantes_para_grupo(query_texto, id_grupo)
    return jsonify({"success": True, "estudiantes": estudiantes}), 200

@app.route('/api/grupos/<int:id_grupo>/estudiantes', methods=['POST'])
def agregar_estudiante_a_grupo(id_grupo):
    data = request.get_json() or {}
    id_estudiante = data.get('id_estudiante')

    if not id_estudiante:
        return jsonify({"success": False, "message": "El ID del estudiante es obligatorio"}), 400

    resultado = GrupoDAO.agregar_estudiante_a_grupo(id_grupo, id_estudiante)
    if resultado["success"]:
        return jsonify(resultado), 201
    else:
        status_code = 409 if resultado.get("codigo") == "DUPLICADO" else 400
        return jsonify(resultado), status_code

@app.route('/api/grupos/<int:id_grupo>/cursos', methods=['GET'])
def obtener_cursos_del_grupo(id_grupo):
    cursos = GrupoDAO.obtener_cursos_por_grupo(id_grupo)
    return jsonify({"success": True, "cursos": cursos}), 200

@app.route('/api/grupos/<int:id_grupo>/cursos/disponibles', methods=['GET'])
def obtener_cursos_disponibles_para_grupo(id_grupo):
    cursos = GrupoDAO.obtener_cursos_disponibles_para_grupo(id_grupo)
    return jsonify({"success": True, "cursos": cursos}), 200

@app.route('/api/grupos/<int:id_grupo>/cursos', methods=['POST'])
def agregar_curso_a_grupo(id_grupo):
    data = request.get_json() or {}
    id_curso = data.get('id_curso')

    if not id_curso:
        return jsonify({"success": False, "message": "El ID del curso es obligatorio"}), 400

    resultado = GrupoDAO.asignar_curso_a_grupo(id_grupo, id_curso)
    if resultado["success"]:
        return jsonify(resultado), 201
    else:
        status_code = 409 if resultado.get("codigo") == "DUPLICADO" else 400
        return jsonify(resultado), status_code

@app.route('/api/grupos/<int:id_grupo>/cursos/<int:id_curso>', methods=['DELETE'])
def quitar_curso_de_grupo(id_grupo, id_curso):
    resultado = GrupoDAO.quitar_curso_de_grupo(id_grupo, id_curso)
    if resultado["success"]:
        return jsonify(resultado), 200
    else:
        return jsonify(resultado), 400

if __name__ == '__main__':
    app.run(debug=True, port=5000)