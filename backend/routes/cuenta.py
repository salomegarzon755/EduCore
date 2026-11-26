from flask import Blueprint, request, jsonify, g, current_app
from auth import require_auth
from models.avatar import avatar_valido
from config.database import DatabaseConnection

cuenta_bp = Blueprint('cuenta', __name__)

@cuenta_bp.route('/api/cuenta', methods=['GET', 'PATCH'])
@require_auth('Estudiante', 'Docente')
def cuenta():
    if g.identity.get('portal') != g.identity.get('rol'):
        return jsonify(success=False, message='Este portal es de consulta.'), 403
    uid = g.identity['id']
    data = request.get_json(silent=True) if request.method == 'PATCH' else None
    if request.method == 'PATCH':
        if not isinstance(data, dict):
            return jsonify(success=False, message='Datos inválidos.'), 400
        errors = {}
        for key in ('nombre', 'apellidos'):
            value = data.get(key)
            if not isinstance(value, str) or not value.strip() or len(value.strip()) > 100:
                errors[key] = 'Escribe un valor de 1 a 100 caracteres.'
        if errors:
            return jsonify(success=False, errors=errors, message='Revisa los campos obligatorios.'), 400
    conn = None
    try:
        conn = DatabaseConnection.get_connection()
        with conn.cursor() as cur:
            if data is not None:
                nombre, apellidos = (data[k].strip() for k in ('nombre', 'apellidos'))
                cur.execute('''UPDATE usuario SET nombre=%s, nombres_cuenta=%s, apellidos_cuenta=%s
                    WHERE id_usuario=%s AND rol=%s RETURNING id_usuario, nombre, rol, nombres_cuenta, apellidos_cuenta, avatar''',
                    (nombre+' '+apellidos, nombre, apellidos, uid, g.identity['rol']))
            else:
                cur.execute('''SELECT id_usuario, nombre, rol, nombres_cuenta, apellidos_cuenta, avatar
                    FROM usuario WHERE id_usuario=%s AND rol=%s''', (uid, g.identity['rol']))
            row = cur.fetchone()
        if not row:
            conn.rollback()
            return jsonify(success=False, message='Cuenta no encontrada.'), 404
        conn.commit()
        return jsonify(success=True, cuenta=dict(id_usuario=row[0], nombre_completo=row[1], rol=row[2], nombre=row[3], apellidos=row[4], avatar=row[5]))
    except Exception:
        if conn is not None: conn.rollback()
        current_app.logger.exception('Error en cuenta HU16')
        return jsonify(success=False, message='No fue posible consultar o guardar la cuenta.'), 500
    finally:
        if conn is not None: DatabaseConnection.return_connection(conn)


@cuenta_bp.route('/api/cuenta/avatar', methods=['PATCH'])
@require_auth('Estudiante', 'Docente')
def cambiar_avatar():
    if g.identity.get('portal') != g.identity.get('rol'):
        return jsonify(success=False, message='Este portal es de consulta.'), 403
    data = request.get_json(silent=True)
    avatar = data.get('avatar') if isinstance(data, dict) else None
    if not avatar_valido(avatar):
        return jsonify(success=False, message='Elige un avatar válido.'), 400
    conn = None
    try:
        conn = DatabaseConnection.get_connection()
        with conn.cursor() as cur:
            cur.execute('UPDATE usuario SET avatar=%s WHERE id_usuario=%s AND rol=%s RETURNING avatar',
                        (avatar, g.identity['id'], g.identity['rol']))
            row = cur.fetchone()
        if not row:
            conn.rollback()
            return jsonify(success=False, message='Cuenta no encontrada.'), 404
        conn.commit()
        return jsonify(success=True, avatar=row[0])
    except Exception:
        if conn is not None: conn.rollback()
        current_app.logger.exception('Error al guardar avatar HU17')
        return jsonify(success=False, message='No fue posible guardar el avatar.'), 500
    finally:
        if conn is not None: DatabaseConnection.return_connection(conn)
