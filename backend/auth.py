import os
from functools import wraps
from flask import request, jsonify, g
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from config.database import DatabaseConnection


def _serializer():
    secret = os.getenv('AUTH_SECRET_KEY')
    if not secret or len(secret) < 32:
        raise RuntimeError('Configure AUTH_SECRET_KEY con al menos 32 caracteres aleatorios')
    return URLSafeTimedSerializer(secret, salt='educore-auth-v1')


def issue_token(user, portal, version=0):
    return _serializer().dumps({'id': user['id_usuario'], 'rol': user['rol'], 'portal': portal, 'version': version})


def validar_sesion():
    if getattr(g, 'identity', None) is not None:
        return None
    token = request.headers.get('Authorization', '')
    if not token.startswith('Bearer '):
        return jsonify(success=False, message='Inicia sesión para continuar.'), 401
    try:
        identity = _serializer().loads(token[7:], max_age=8*60*60)
        if not isinstance(identity, dict) or 'version' not in identity or 'id' not in identity:
            raise BadSignature('token anterior')
    except (BadSignature, SignatureExpired):
        return jsonify(success=False, message='Sesión inválida o vencida.'), 401
    conn = DatabaseConnection.get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute('SELECT activo, version_sesion, rol FROM usuario WHERE id_usuario=%s', (identity['id'],))
            row = cur.fetchone()
    finally:
        conn.rollback()
        DatabaseConnection.return_connection(conn)
    if not row or not row[0] or row[1] != identity['version'] or row[2] != identity.get('rol'):
        return jsonify(success=False, message='Sesión finalizada. Inicia sesión nuevamente.'), 401
    g.identity = identity
    return None


def require_auth(*roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            error = validar_sesion()
            if error is not None:
                return error
            if g.identity.get('rol') not in roles:
                return jsonify(success=False, message='Acceso no autorizado'), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator
