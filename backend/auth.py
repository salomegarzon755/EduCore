import os
from functools import wraps
from flask import request, jsonify, g
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired


def _serializer():
    secret = os.getenv('AUTH_SECRET_KEY')
    if not secret or len(secret) < 32:
        raise RuntimeError('Configure AUTH_SECRET_KEY con al menos 32 caracteres aleatorios')
    return URLSafeTimedSerializer(secret, salt='educore-auth-v1')


def issue_token(user, portal):
    return _serializer().dumps({'id': user['id_usuario'], 'rol': user['rol'], 'portal': portal})


def require_auth(*roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            token = request.headers.get('Authorization', '')
            if not token.startswith('Bearer '):
                return jsonify(success=False, message='Sesión requerida'), 401
            try:
                identity = _serializer().loads(token[7:], max_age=8*60*60)
            except (BadSignature, SignatureExpired):
                return jsonify(success=False, message='Sesión inválida o vencida'), 401
            if identity.get('rol') not in roles:
                return jsonify(success=False, message='Acceso no autorizado'), 403
            g.identity = identity
            return fn(*args, **kwargs)
        return wrapper
    return decorator
