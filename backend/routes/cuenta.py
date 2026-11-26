from flask import Blueprint, request, jsonify, g, current_app
from psycopg2 import IntegrityError
from auth import require_auth
from models.avatar import avatar_valido
from models.credenciales import correo_valido, correo_ocupado, verificar_contrasena, hash_contrasena
from config.database import DatabaseConnection

cuenta_bp = Blueprint('cuenta', __name__)
CAMPOS = 'id_usuario, nombre, rol, nombres_cuenta, apellidos_cuenta, avatar, apodo, correo'


def cuenta_dict(row):
    return dict(zip(('id_usuario', 'nombre_completo', 'rol', 'nombre', 'apellidos', 'avatar', 'usuario', 'correo'), row))


def portal_propio():
    return g.identity.get('portal') == g.identity.get('rol')


def identidad():
    return (g.identity['id'], g.identity['rol'], g.identity['version'])


FILTRO = 'id_usuario=%s AND rol=%s AND activo AND version_sesion=%s'


def sesion_finalizada():
    return jsonify(success=False, message='Sesión finalizada. Inicia sesión nuevamente.'), 401


@cuenta_bp.route('/api/cuenta', methods=['GET', 'PATCH'])
@require_auth('Estudiante', 'Docente')
def cuenta():
    if not portal_propio():
        return jsonify(success=False, message='Este portal es de consulta.'), 403
    data = request.get_json(silent=True) if request.method == 'PATCH' else None
    if request.method == 'PATCH':
        if not isinstance(data, dict):
            return jsonify(success=False, message='Datos inválidos.'), 400
        errors = {}
        # Las cuentas antiguas pueden tener nombres sin separar. No se inventan apellidos.
        for key in ('nombre', 'apellidos'):
            if key in data and (not isinstance(data[key], str) or not 0 < len(data[key].strip()) <= 100):
                errors[key] = 'Escribe un valor de 1 a 100 caracteres.'
        if 'correo' in data and not correo_valido(data['correo']):
            errors['correo'] = 'Escribe un correo válido.'
        if ('nombre' in data) != ('apellidos' in data):
            errors['nombre'] = 'Envía nombres y apellidos juntos.'
        if errors or not any(k in data for k in ('nombre', 'correo')):
            return jsonify(success=False, errors=errors, message='Revisa los datos.'), 400
    conn = None
    try:
        conn = DatabaseConnection.get_connection()
        with conn.cursor() as cur:
            if data is not None:
                if 'correo' in data:
                    cur.execute('SELECT pg_advisory_xact_lock(1819001)')
                    if correo_ocupado(cur, data['correo'], g.identity['id']):
                        conn.rollback()
                        return jsonify(success=False, errors={'correo': 'Este correo ya está registrado.'}, message='Correo no disponible.'), 409
                sets, values = [], []
                if 'nombre' in data:
                    nombre, apellidos = (data[k].strip() for k in ('nombre', 'apellidos'))
                    sets.extend(['nombre=%s', 'nombres_cuenta=%s', 'apellidos_cuenta=%s'])
                    values.extend([nombre+' '+apellidos, nombre, apellidos])
                if 'correo' in data:
                    sets.append('correo=%s')
                    values.append(data['correo'])
                cur.execute('UPDATE usuario SET '+', '.join(sets)+' WHERE '+FILTRO+' RETURNING '+CAMPOS,
                            (*values, *identidad()))
            else:
                cur.execute('SELECT '+CAMPOS+' FROM usuario WHERE '+FILTRO, identidad())
            row = cur.fetchone()
        if not row:
            conn.rollback()
            return sesion_finalizada()
        conn.commit()
        return jsonify(success=True, cuenta=cuenta_dict(row))
    except IntegrityError:
        conn.rollback()
        return jsonify(success=False, message='El correo o los datos no están disponibles.'), 409
    except Exception:
        if conn is not None: conn.rollback()
        current_app.logger.exception('Error en cuenta')
        return jsonify(success=False, message='No fue posible consultar o guardar la cuenta.'), 500
    finally:
        if conn is not None: DatabaseConnection.return_connection(conn)


@cuenta_bp.route('/api/cuenta/avatar', methods=['PATCH'])
@require_auth('Estudiante', 'Docente')
def cambiar_avatar():
    if not portal_propio():
        return jsonify(success=False, message='Este portal es de consulta.'), 403
    data = request.get_json(silent=True)
    avatar = data.get('avatar') if isinstance(data, dict) else None
    if not avatar_valido(avatar):
        return jsonify(success=False, message='Elige un avatar válido.'), 400
    conn = None
    try:
        conn = DatabaseConnection.get_connection()
        with conn.cursor() as cur:
            cur.execute('UPDATE usuario SET avatar=%s WHERE '+FILTRO+' RETURNING avatar', (avatar, *identidad()))
            row = cur.fetchone()
        if not row:
            conn.rollback()
            return sesion_finalizada()
        conn.commit()
        return jsonify(success=True, avatar=row[0])
    except Exception:
        if conn is not None: conn.rollback()
        current_app.logger.exception('Error al guardar avatar HU17')
        return jsonify(success=False, message='No fue posible guardar el avatar.'), 500
    finally:
        if conn is not None: DatabaseConnection.return_connection(conn)


@cuenta_bp.route('/api/cuenta/contrasena', methods=['PATCH'])
@cuenta_bp.route('/api/cuenta', methods=['DELETE'])
@require_auth('Estudiante', 'Docente')
def modificar_credenciales():
    if not portal_propio():
        return jsonify(success=False, message='Este portal es de consulta.'), 403
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or not isinstance(data.get('contrasena_actual'), str):
        return jsonify(success=False, message='Ingresa tu contraseña actual.'), 400
    eliminar = request.method == 'DELETE'
    actual = data['contrasena_actual'].strip()
    if eliminar and data.get('confirmar') is not True:
        return jsonify(success=False, message='Confirma la eliminación.'), 400
    nueva = data.get('contrasena_nueva')
    if not eliminar:
        if not isinstance(nueva, str) or not 1 <= len(nueva.strip()) <= 1024 or nueva != data.get('confirmacion'):
            return jsonify(success=False, message='Ingresa y confirma la nueva contraseña.'), 400
        nueva = nueva.strip()
        if nueva == actual:
            return jsonify(success=False, message='Elige una contraseña diferente.'), 400
    conn = None
    try:
        conn = DatabaseConnection.get_connection()
        with conn.cursor() as cur:
            cur.execute('SELECT contrasena FROM usuario WHERE '+FILTRO+' FOR UPDATE', identidad())
            row = cur.fetchone()
            if not row:
                conn.rollback()
                return sesion_finalizada()
            if not verificar_contrasena(actual, row[0]):
                conn.rollback()
                return jsonify(success=False, message='La contraseña actual es incorrecta.'), 400
            if eliminar:
                # No se borran relaciones ni se modifica la contraseña existente.
                cur.execute('UPDATE usuario SET activo=false, version_sesion=version_sesion+1 WHERE '+FILTRO,
                            identidad())
            else:
                cur.execute('UPDATE usuario SET contrasena=%s, version_sesion=version_sesion+1 WHERE '+FILTRO,
                            (hash_contrasena(nueva), *identidad()))
        conn.commit()
        return jsonify(success=True, message='Cuenta eliminada.' if eliminar else 'Contraseña actualizada.')
    except Exception:
        if conn is not None: conn.rollback()
        current_app.logger.exception('Error al modificar credenciales')
        return jsonify(success=False, message='No fue posible completar la operación.'), 500
    finally:
        if conn is not None: DatabaseConnection.return_connection(conn)
