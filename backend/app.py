import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dao.usuario_dao import UsuarioDAO
from models.usuario import Usuario
from models.avatar import avatar_valido
from dao.curso_dao import CursoDAO
from dao.grupo_dao import GrupoDAO
from routes.actividades import actividades_bp
from routes.seguimiento import seguimiento_bp
from routes.admin_cursos import admin_cursos_bp
from routes.cuenta import cuenta_bp
from routes.resumen_modulo import resumen_bp
from routes.gestion_grupos import gestion_grupos_bp, autorizar_gestion_grupo, autorizar_consulta_grupo, retirar_integrante
from config.database import DatabaseConnection
from auth import issue_token, require_auth, validar_sesion
from models.credenciales import correo_valido
from flask import g

app = Flask(__name__)
# En produccion define FRONTEND_ORIGIN con la URL del sitio estatico (sin barra final).
# Varias URLs se separan con coma. Por defecto (*) acepta cualquier origen.
_origenes = [o.strip() for o in os.getenv('FRONTEND_ORIGIN', '*').split(',') if o.strip()]
CORS(app, origins=_origenes)
app.register_blueprint(actividades_bp)   # actividades y resultados
app.register_blueprint(seguimiento_bp)   # HU.15 · seguimiento docente, estudiante y familia
app.register_blueprint(admin_cursos_bp)  # HU.23 · cursos predefinidos (Administrador)
app.register_blueprint(cuenta_bp)
app.register_blueprint(gestion_grupos_bp)
app.register_blueprint(resumen_bp)     # HU.31 · resumen al finalizar cada módulo (Estudiante)

# Las rutas académicas privadas requieren sesión; se conservan las consultas
# públicas de catálogo y salud. Las rutas de cuenta verifican además el portal.
@app.before_request
def proteger_sesion():
    if request.method == 'OPTIONS' or not request.path.startswith('/api/'):
        return None
    if request.endpoint in ('login', 'registro', 'health'):
        return None
    publicos = ('obtener_cursos', 'obtener_cursos_completo', 'obtener_unidades_curso',
                'obtener_actividades_unidad', 'get_puntos_actividad', 'actividades.meta_actividad')
    if request.method == 'GET' and request.endpoint in publicos and not request.headers.get('Authorization'):
        return None
    return validar_sesion()

@app.route('/api/sesion', methods=['GET'])
@require_auth('Estudiante', 'Docente', 'Administrador')
def sesion():
    return jsonify(success=True)

# --- AUTENTICACIÓN Y REGISTRO ---

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = data.get('usuario')
    password = data.get('contrasena')
    rol_esperado = data.get('rol_esperado')  # 'Estudiante', 'Docente' o 'Padre o Madre'

    usuario_obj = UsuarioDAO.autenticar(username, password)

    if usuario_obj == "inactiva":
        return jsonify(success=False, message="Cuenta eliminada. No puedes ingresar."), 401

    if usuario_obj:
        user_dict = usuario_obj.to_dict()
        rol_real = user_dict.get('rol')

        if rol_esperado == 'Padre o Madre' and rol_real != 'Estudiante':
            return jsonify(success=False, message="El acceso familiar requiere una cuenta de estudiante"), 403

        # HU.23 · Portal de administración: solo cuentas con rol Administrador,
        # y una cuenta de administrador no entra por los demás portales.
        if rol_esperado == 'Administrador' and rol_real != 'Administrador':
            return jsonify(success=False, message="Esta cuenta no tiene permisos de administración."), 403
        if rol_real == 'Administrador' and rol_esperado and rol_esperado != 'Administrador':
            return jsonify(success=False, message="Esta cuenta es de administración. Ingresa desde «Soy administrador»."), 403

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
            "user": user_dict,
            "token": issue_token(user_dict, rol_esperado or rol_real, usuario_obj.version_sesion)
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

    nombres = data.get('nombres')
    apellidos = data.get('apellidos')
    if rol not in ('Estudiante', 'Docente'):
        return jsonify(success=False, message='Rol no disponible para registro.'), 400
    if not all(isinstance(v, str) and v.strip() for v in (nombre, username, password)) or len(password) > 1024:
        return jsonify(success=False, message='Completa los datos de registro.'), 400
    if not correo_valido(correo):
        return jsonify(success=False, message='Escribe un correo válido.'), 400
    if nombres is not None or apellidos is not None:
        if not all(isinstance(v, str) and 0 < len(v.strip()) <= 100 for v in (nombres, apellidos)):
            return jsonify(success=False, message='Revisa nombres y apellidos.'), 400
        nombres, apellidos = nombres.strip(), apellidos.strip()
        nombre = nombres + ' ' + apellidos
    username, correo = username.strip(), correo.strip()
    avatar = data.get('avatar')
    if rol in ('Estudiante', 'Docente') and not avatar_valido(avatar):
        return jsonify(success=False, message='Elige un avatar válido.'), 400
    if rol not in ('Estudiante', 'Docente'):
        avatar = 'kokoi'

    nuevo_usuario = Usuario(
        nombre=nombre,
        usuario=username,
        contrasena=password,
        rol=rol, avatar=avatar
    )

    try:
        creado = UsuarioDAO.crear(
            nuevo_usuario,
            correo=correo,
            nombres=nombres,
            apellidos=apellidos
        )

    except Exception:
        app.logger.exception('Error al registrar usuario')

        return jsonify(
            success=False,
            message='No fue posible registrar la cuenta.'
        ), 500

    if not creado:
        return jsonify(
            success=False,
            message='El nombre de usuario o correo electrónico ya está en uso. Por favor, utiliza otro.'
        ), 409

    return jsonify({
        "success": True,
        "message": "Usuario registrado exitosamente",
        "user": nuevo_usuario.to_dict()
    }), 201

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
    id_estudiante = request.args.get('id_estudiante', type=int)
    detalle = CursoDAO.obtener_detalle_completo(id_curso, id_estudiante)
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

@app.route('/api/familia/grupos', methods=['GET'])
@require_auth('Estudiante')
def grupos_familia():
    if g.identity.get('portal') != 'Padre o Madre':
        return jsonify(success=False, message='Acceso reservado al portal familiar'), 403
    grupos = GrupoDAO.obtener_grupos_por_estudiante(g.identity['id'])
    return jsonify(success=True, grupos=[{'id_grupo': x['id_grupo'], 'nombre_grupo': x['nombre_grupo'], 'grado': x.get('grado'), 'codigo_clase': x.get('codigo_clase')} for x in grupos])

@app.route('/api/estudiantes/<int:id_estudiante>/grupos', methods=['GET'])
@require_auth('Estudiante')
def obtener_grupos_estudiante(id_estudiante):
    if g.identity['id'] != id_estudiante:
        return jsonify(success=False, message='Acceso no autorizado.'), 403
    grupos = GrupoDAO.obtener_grupos_por_estudiante(id_estudiante)
    return jsonify({"success": True, "grupos": grupos}), 200

@app.route('/api/estudiantes/<int:id_estudiante>/cursos', methods=['GET'])
@require_auth('Estudiante')
def obtener_cursos_estudiante(id_estudiante):
    if g.identity['id'] != id_estudiante:
        return jsonify(success=False, message='Acceso no autorizado.'), 403
    cursos = GrupoDAO.obtener_cursos_por_estudiante(id_estudiante)
    return jsonify({"success": True, "cursos": cursos}), 200

@app.route('/api/grupos', methods=['POST'])
@require_auth('Docente')
def crear_grupo():
    if g.identity.get('portal') != 'Docente':
        return jsonify(success=False, message='Acceso reservado a docentes.'), 403
    data = request.get_json() or {}
    nombre_grupo = data.get('nombre_grupo')
    grado = data.get('grado')
    descripcion = data.get('descripcion', '')
    id_docente = g.identity['id']
    ids_cursos = data.get('ids_cursos', [])

    if not isinstance(nombre_grupo, str) or not nombre_grupo.strip() or not id_docente:
        return jsonify(success=False, message='El nombre del grupo es obligatorio.'), 400
    if not isinstance(descripcion, str) or grado not in ('Primero', 'Segundo'):
        return jsonify(success=False, message='Revisa el grado y la descripción.'), 400
    nombre_grupo, descripcion = nombre_grupo.strip(), descripcion.strip()
    if len(nombre_grupo) > 100 or len(descripcion) > 1000 or any(c in nombre_grupo or c in descripcion for c in ('<', '>')):
        return jsonify(success=False, message='Revisa la longitud y los caracteres de los datos del grupo.'), 400

    nuevo_grupo = GrupoDAO.crear_grupo(nombre_grupo, grado, descripcion, id_docente, ids_cursos)

    if nuevo_grupo:
        return jsonify({"success": True, "grupo": nuevo_grupo}), 201
    else:
        return jsonify({"success": False, "message": "Error al guardar en BD"}), 500

@app.route('/api/grupos/docente/<int:id_docente>', methods=['GET'])
@require_auth('Docente')
def obtener_grupos_docente(id_docente):
    if g.identity.get('portal') != 'Docente' or g.identity['id'] != id_docente:
        return jsonify(success=False, message='Acceso no autorizado.'), 403
    grupos = GrupoDAO.obtener_grupos_por_docente(id_docente)
    return jsonify({"success": True, "grupos": grupos}), 200

@app.route('/api/grupos/<int:id_grupo>', methods=['GET'])
def obtener_detalle_grupo(id_grupo):
    error = autorizar_consulta_grupo(id_grupo)
    if error is not None:
        return error
    grupo = GrupoDAO.obtener_detalle_grupo(id_grupo)
    if not grupo:
        return jsonify({"success": False, "message": "Grupo no encontrado"}), 404
    
    estudiantes = GrupoDAO.obtener_estudiantes_del_grupo(id_grupo)
    if g.identity.get('rol') == 'Docente':
        grupo["estudiantes"] = estudiantes
    grupo["total_estudiantes"] = len(estudiantes)
    return jsonify({"success": True, "grupo": grupo}), 200

@app.route('/api/grupos/<int:id_grupo>/estudiantes/buscar', methods=['GET'])
def buscar_estudiantes_para_grupo(id_grupo):
    error = autorizar_gestion_grupo(id_grupo)
    if error is not None:
        return error
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
    error = autorizar_gestion_grupo(id_grupo)
    if error is not None:
        return error
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
    return retirar_integrante(id_grupo, id_estudiante)

@app.route('/api/grupos/<int:id_grupo>/cursos', methods=['GET'])
def obtener_cursos_del_grupo(id_grupo):
    error = autorizar_consulta_grupo(id_grupo)
    if error is not None:
        return error
    cursos = GrupoDAO.obtener_cursos_por_grupo(id_grupo)
    return jsonify({"success": True, "cursos": cursos}), 200

@app.route('/api/grupos/<int:id_grupo>/cursos/disponibles', methods=['GET'])
def obtener_cursos_disponibles_para_grupo(id_grupo):
    error = autorizar_gestion_grupo(id_grupo)
    if error is not None:
        return error
    cursos = GrupoDAO.obtener_cursos_disponibles_para_grupo(id_grupo)
    return jsonify({"success": True, "cursos": cursos}), 200

@app.route('/api/grupos/<int:id_grupo>/cursos', methods=['POST'])
def agregar_curso_a_grupo(id_grupo):
    error = autorizar_gestion_grupo(id_grupo)
    if error is not None:
        return error
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
    error = autorizar_gestion_grupo(id_grupo)
    if error is not None:
        return error
    resultado = GrupoDAO.quitar_curso_de_grupo(id_grupo, id_curso)
    if resultado["success"]:
        return jsonify(resultado), 200
    else:
        return jsonify(resultado), 400

@app.route('/api/health', methods=['GET'])
def health():
    """Comprobacion del despliegue: abre /api/health en el navegador."""
    try:
        conn = DatabaseConnection.get_connection()
        try:
            cur = conn.cursor()
            cur.execute('SELECT 1')
            cur.close()
            conn.rollback()
        finally:
            DatabaseConnection.return_connection(conn)
        return jsonify({"status": "ok", "db": "ok"}), 200
    except Exception as e:
        print(f"Error en /api/health: {e}")
        return jsonify({"status": "error", "db": "error"}), 503

if __name__ == '__main__':
    app.run(debug=True, port=5000)