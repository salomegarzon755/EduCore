from flask import Flask, request, jsonify
from flask_cors import CORS
from dao.usuario_dao import UsuarioDAO
from models.usuario import Usuario
from dao.curso_dao import CursoDAO
from dao.grupo_dao import GrupoDAO
from routes.actividades import actividades_bp

app = Flask(__name__)
CORS(app)
app.register_blueprint(actividades_bp)   # /api/actividades/<id>, /api/resultados, /api/estudiantes/<id>/progreso

# --- AUTENTICACIÓN Y REGISTRO ---

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = data.get('usuario')
    password = data.get('contrasena')
    rol_esperado = data.get('rol_esperado')  # 'Estudiante', 'Docente' o 'Padre o Madre'

    usuario_obj = UsuarioDAO.autenticar(username, password)

    if usuario_obj:
        user_dict = usuario_obj.to_dict()
        rol_real = user_dict.get('rol')

        # Validación estricta por rol si se especifica en el Login
        if rol_esperado:
            if rol_esperado == 'Estudiante' and rol_real != 'Estudiante':
                return jsonify({
                    "success": False,
                    "message": "Esta cuenta pertenece a un docente. Debes ingresar desde el portal para docentes."
                }), 403
            elif rol_esperado == 'Docente' and rol_real != 'Docente':
                return jsonify({
                    "success": False,
                    "message": "Esta cuenta pertenece a un estudiante. Debes ingresar desde el portal para estudiantes."
                }), 403

        return jsonify({
            "success": True,
            "user": user_dict
        }), 200
    else:
        return jsonify({
            "success": False,
            "message": "Usuario o contraseña incorrectos"
        }), 401

@app.route('/api/registro', methods=['POST'])
def registro():
    data = request.get_json() or {}
    
    nombre = data.get('nombre')
    username = data.get('usuario')
    correo = data.get('correo', '')
    password = data.get('contrasena')
    rol = data.get('rol', 'Estudiante')

    nuevo_usuario = Usuario(
        nombre=nombre,
        usuario=username,
        contrasena=password,
        rol=rol
    )

    creado = UsuarioDAO.crear(nuevo_usuario, correo=correo)

    if creado:
        return jsonify({
            "success": True,
            "message": "Usuario registrado exitosamente",
            "user": nuevo_usuario.to_dict()
        }), 201
    else:
        return jsonify({
            "success": False,
            "message": "No se pudo registrar el usuario en la base de datos."
        }), 400

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

# --- RUTAS DE GRUPOS ---

@app.route('/api/estudiantes/<int:id_estudiante>/grupos', methods=['GET'])
def obtener_grupos_estudiante(id_estudiante):
    grupos = GrupoDAO.obtener_grupos_por_estudiante(id_estudiante)
    return jsonify({"success": True, "grupos": grupos}), 200

@app.route('/api/estudiantes/<int:id_estudiante>/cursos', methods=['GET'])
def obtener_cursos_estudiante(id_estudiante):
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

def _status_por_codigo(resultado):
    """409 = choque con una regla (ya está en el grupo / curso repetido), 404 = no existe, 400 = otro error."""
    codigo = resultado.get("codigo")
    if codigo in ("DUPLICADO", "CURSO_DUPLICADO"):
        return 409
    if codigo == "NO_ENCONTRADO":
        return 404
    return 400

@app.route('/api/grupos/<int:id_grupo>/estudiantes', methods=['POST'])
def agregar_estudiante_a_grupo(id_grupo):
    data = request.get_json() or {}
    # Acepta id_estudiante (lo que envía el panel docente) o id_usuario como alias.
    id_estudiante = data.get('id_estudiante') or data.get('id_usuario')

    try:
        id_estudiante = int(id_estudiante)
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "El ID del estudiante es obligatorio"}), 400

    resultado = GrupoDAO.agregar_estudiante_a_grupo(id_grupo, id_estudiante)
    if resultado["success"]:
        return jsonify(resultado), 201
    return jsonify(resultado), _status_por_codigo(resultado)

@app.route('/api/grupos/<int:id_grupo>/estudiantes/<int:id_estudiante>', methods=['DELETE'])
def quitar_estudiante_de_grupo(id_grupo, id_estudiante):
    resultado = GrupoDAO.quitar_estudiante_de_grupo(id_grupo, id_estudiante)
    if resultado["success"]:
        return jsonify(resultado), 200
    return jsonify(resultado), _status_por_codigo(resultado)

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
    return jsonify(resultado), _status_por_codigo(resultado)

@app.route('/api/grupos/<int:id_grupo>/cursos/<int:id_curso>', methods=['DELETE'])
def quitar_curso_de_grupo(id_grupo, id_curso):
    resultado = GrupoDAO.quitar_curso_de_grupo(id_grupo, id_curso)
    if resultado["success"]:
        return jsonify(resultado), 200
    else:
        return jsonify(resultado), 400

if __name__ == '__main__':
    app.run(debug=True, port=5000)