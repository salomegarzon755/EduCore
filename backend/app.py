from flask import Flask, request, jsonify
from flask_cors import CORS
from dao.usuario_dao import UsuarioDAO
from models.usuario import Usuario
from dao.curso_dao import CursoDAO
from dao.grupo_dao import GrupoDAO

app = Flask(__name__)
CORS(app)  # Permite peticiones desde el navegador (Frontend)

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('usuario')
    password = data.get('contrasena')

    usuario_obj = UsuarioDAO.autenticar(username, password)

    if usuario_obj:
        return jsonify({
            "success": True,
            "user": usuario_obj.to_dict()
        }), 200
    else:
        return jsonify({
            "success": False,
            "message": "Usuario o contraseña incorrectos"
        }), 401

@app.route('/api/registro', methods=['POST'])
def registro():
    data = request.get_json()
    
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

@app.route('/api/cursos', methods=['GET'])
def obtener_cursos():
    cursos = CursoDAO.obtener_todos()
    return jsonify({"success": True, "cursos": cursos}), 200

@app.route('/api/grupos', methods=['POST'])
def crear_grupo():
    data = request.get_json()
    
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

# --- NUEVAS RUTAS HU.06 (AGREGAR ESTUDIANTES AL GRUPO) ---

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

if __name__ == '__main__':
    app.run(debug=True, port=5000)