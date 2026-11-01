from flask import Flask, request, jsonify
from flask_cors import CORS
from dao.usuario_dao import UsuarioDAO
from models.usuario import Usuario

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

    # Enviamos también el campo correo
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

if __name__ == '__main__':
    app.run(debug=True, port=5000)