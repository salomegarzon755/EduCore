from config.database import DatabaseConnection
from models.usuario import Usuario
from models.credenciales import (
    hash_contrasena,
    verificar_contrasena,
    correo_ocupado
)
from psycopg2.errors import UniqueViolation


class UsuarioDAO:

    @staticmethod
    def autenticar(username, password, rol=None):
        if not isinstance(username, str) or not isinstance(password, str):
            return None

        username = username.strip()

        if not username or not password:
            return None

        conn = DatabaseConnection.get_connection()

        try:
            with conn.cursor() as cur:
                consulta = '''
                    SELECT id_usuario, nombre, apodo, contrasena,
                        rol, avatar, activo, version_sesion
                    FROM usuario
                    WHERE lower(trim(apodo)) = lower(trim(%s))
                '''

                parametros = [username]

                if rol:
                    consulta += " AND lower(rol) = lower(%s)"
                    parametros.append(rol)

                cur.execute(consulta, tuple(parametros))
                filas = cur.fetchall()

                coincidencias = [
                    row for row in filas
                    if verificar_contrasena(password, row[3])
                ]

                if len(coincidencias) != 1:
                    conn.rollback()
                    return None

                row = coincidencias[0]

                if not row[6]:
                    conn.rollback()
                    return 'inactiva'

                user = Usuario(
                    id_usuario=row[0],
                    nombre=row[1],
                    usuario=row[2],
                    rol=row[4],
                    avatar=row[5]
                )

                user.version_sesion = row[7]

            conn.commit()
            return user

        except Exception:
            conn.rollback()
            raise

        finally:
            DatabaseConnection.return_connection(conn)

    @staticmethod
    def crear(usuario_obj, correo='', nombres=None, apellidos=None):

        if not isinstance(usuario_obj.usuario, str):
            return False

        apodo = usuario_obj.usuario.strip()

        if not apodo:
            return False

        if not isinstance(correo, str):
            return False

        correo = correo.strip()

        conn = DatabaseConnection.get_connection()

        try:
            with conn.cursor() as cur:

                # Serializa registros y cambios de correo.
                cur.execute(
                    'SELECT pg_advisory_xact_lock(1819001)'
                )

                # Verifica si el apodo ya existe,
                # incluyendo las cuentas inactivas.
                cur.execute(
                    '''
                    SELECT 1
                    FROM usuario
                    WHERE lower(trim(apodo)) = lower(trim(%s))
                    LIMIT 1
                    ''',
                    (apodo,)
                )

                if cur.fetchone():
                    conn.rollback()
                    return False

                # Verifica si el correo ya está registrado.
                if correo_ocupado(cur, correo):
                    conn.rollback()
                    return False

                # Registra la cuenta con una contraseña protegida.
                cur.execute(
                    '''
                    INSERT INTO usuario (
                        nombre,
                        apodo,
                        correo,
                        contrasena,
                        rol,
                        avatar,
                        nombres_cuenta,
                        apellidos_cuenta
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id_usuario
                    ''',
                    (
                        usuario_obj.nombre,
                        apodo,
                        correo,
                        hash_contrasena(usuario_obj.contrasena),
                        usuario_obj.rol,
                        usuario_obj.avatar,
                        nombres,
                        apellidos
                    )
                )

                usuario_obj._id_usuario = cur.fetchone()[0]

            conn.commit()
            return True

        except UniqueViolation:
            conn.rollback()
            return False

        except Exception:
            conn.rollback()
            raise

        finally:
            DatabaseConnection.return_connection(conn)