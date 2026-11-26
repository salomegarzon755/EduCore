"""Hash de contraseñas y compatibilidad explícita con registros antiguos."""
import hashlib
import hmac
import secrets
import re

ITERACIONES = 600_000


def hash_contrasena(password):
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, ITERACIONES)
    return f'pbkdf2:sha256:{ITERACIONES}${salt.hex()}${digest.hex()}'


def verificar_contrasena(password, stored):
    if not isinstance(password, str) or not isinstance(stored, str) or len(password) > 1024:
        return False
    if not stored.startswith('pbkdf2:'):
        return hmac.compare_digest(password.encode(), stored.encode())
    try:
        metodo, salt, digest = stored.split('$')
        if metodo != f'pbkdf2:sha256:{ITERACIONES}' or len(salt) != 32 or len(digest) != 64:
            return False
        expected = bytes.fromhex(digest)
        actual = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), ITERACIONES)
        return hmac.compare_digest(actual, expected)
    except ValueError:
        return False


def correo_valido(value):
    return isinstance(value, str) and len(value) <= 254 and bool(re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', value))


def correo_ocupado(cur, correo, uid=None):
    # Incluye cuentas inactivas para reservar sus datos.
    cur.execute('SELECT 1 FROM usuario WHERE lower(trim(correo))=lower(%s) AND (%s::integer IS NULL OR id_usuario<>%s) LIMIT 1',
                (correo, uid, uid))
    return cur.fetchone() is not None
