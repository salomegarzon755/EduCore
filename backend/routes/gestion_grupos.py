# HU20-HU22: gestión de grupos sin eliminar cuentas ni historial académico.
from flask import Blueprint, g, jsonify, request, current_app
from psycopg2 import sql, errors
from config.database import DatabaseConnection
from auth import validar_sesion


gestion_grupos_bp = Blueprint('gestion_grupos', __name__, url_prefix='/api')


class OperacionRechazada(Exception):
    def __init__(self, mensaje, estado=409):
        super().__init__(mensaje)
        self.estado = estado


def _identidad_docente():
    error = validar_sesion()
    if error is not None:
        return error
    if g.identity.get('rol') != 'Docente' or g.identity.get('portal') != 'Docente':
        return jsonify(success=False, message='Acceso reservado a docentes.'), 403
    return None


def _grupo_propio(cur, id_grupo, bloquear=False):
    consulta = 'SELECT id_docente FROM grupo WHERE id_grupo=%s'
    if bloquear:
        consulta += ' FOR UPDATE'
    cur.execute(consulta, (id_grupo,))
    fila = cur.fetchone()
    if not fila:
        raise OperacionRechazada('El grupo no existe.', 404)
    if fila[0] != g.identity['id']:
        raise OperacionRechazada('No puedes gestionar un grupo de otro docente.', 403)


def _ejecutar(id_grupo, operacion, bloquear=True, salida_estudiante=None):
    error = validar_sesion()
    if error is not None:
        return error
    estudiante_propio = (
        salida_estudiante is not None
        and g.identity.get('rol') == 'Estudiante'
        and g.identity.get('portal') == 'Estudiante'
        and g.identity['id'] == salida_estudiante
    )
    error = None if estudiante_propio else _identidad_docente()
    if error is not None:
        return error
    conn = None
    try:
        conn = DatabaseConnection.get_connection()
        with conn.cursor() as cur:
            if estudiante_propio:
                cur.execute('SELECT 1 FROM grupo WHERE id_grupo=%s FOR UPDATE', (id_grupo,))
                if not cur.fetchone():
                    raise OperacionRechazada('El grupo no existe.', 404)
            else:
                _grupo_propio(cur, id_grupo, bloquear)
            respuesta = operacion(cur)
        conn.commit()
        return respuesta
    except OperacionRechazada as exc:
        if conn:
            conn.rollback()
        return jsonify(success=False, message=str(exc)), exc.estado
    except (errors.ForeignKeyViolation, errors.CheckViolation, errors.UniqueViolation):
        if conn:
            conn.rollback()
        return jsonify(success=False, message='La operación entra en conflicto con datos existentes. No se guardaron cambios.'), 409
    except errors.DataError:
        if conn:
            conn.rollback()
        return jsonify(success=False, message='Revisa la longitud y el formato de los datos.'), 400
    except Exception:
        if conn:
            conn.rollback()
        current_app.logger.exception('Error de gestión del grupo')
        return jsonify(success=False, message='No se pudo completar la operación. No se guardaron cambios.'), 500
    finally:
        if conn:
            DatabaseConnection.return_connection(conn)


def autorizar_gestion_grupo(id_grupo):
    # Las rutas de gestión existentes conservan sus DAO y contratos de respuesta.
    return _ejecutar(id_grupo, lambda cur: None, bloquear=False)


def autorizar_consulta_grupo(id_grupo):
    error = validar_sesion()
    if error is not None:
        return error
    if g.identity.get('rol') == 'Docente' and g.identity.get('portal') == 'Docente':
        return autorizar_gestion_grupo(id_grupo)
    if g.identity.get('rol') != 'Estudiante' or g.identity.get('portal') not in ('Estudiante', 'Padre o Madre'):
        return jsonify(success=False, message='Acceso no autorizado.'), 403
    conn = None
    try:
        conn = DatabaseConnection.get_connection()
        with conn.cursor() as cur:
            cur.execute('SELECT 1 FROM estudiante_grupo WHERE id_grupo=%s AND id_estudiante=%s',
                        (id_grupo, g.identity['id']))
            if not cur.fetchone():
                return jsonify(success=False, message='No perteneces a este grupo.'), 403
        return None
    except Exception:
        current_app.logger.exception('Error al autorizar consulta del grupo')
        return jsonify(success=False, message='No se pudo consultar el grupo.'), 500
    finally:
        if conn:
            conn.rollback()
            DatabaseConnection.return_connection(conn)


def _proteger_dependencias(cur, tabla, id_grupo, id_estudiante=None, permitir=()):
    '''Rechaza si alguna FK apunta a filas que se borrarían, salvo asociaciones explícitas.

    Se consultan los metadatos reales, no solo las migraciones conocidas. Los nombres
    SQL proceden del catálogo y se escapan con Identifier; los valores se parametrizan.
    '''
    cur.execute('''SELECT ns.nspname, ch.relname, pns.nspname, pa.relname,
                          array_agg(ca.attname ORDER BY k.ord),
                          array_agg(ra.attname ORDER BY k.ord)
                   FROM pg_constraint co
                   JOIN pg_class ch ON ch.oid=co.conrelid
                   JOIN pg_namespace ns ON ns.oid=ch.relnamespace
                   JOIN pg_class pa ON pa.oid=co.confrelid
                   JOIN pg_namespace pns ON pns.oid=pa.relnamespace
                   CROSS JOIN LATERAL unnest(co.conkey, co.confkey)
                     WITH ORDINALITY AS k(child_att, parent_att, ord)
                   JOIN pg_attribute ca ON ca.attrelid=ch.oid AND ca.attnum=k.child_att
                   JOIN pg_attribute ra ON ra.attrelid=pa.oid AND ra.attnum=k.parent_att
                   WHERE co.contype='f' AND co.confrelid=to_regclass(%s)
                   GROUP BY co.oid, ns.nspname, ch.relname, pns.nspname, pa.relname''', (tabla,))
    for schema, hija, esquema_padre, padre, cols_hija, cols_padre in cur.fetchall():
        if (schema, hija) in permitir:
            continue
        condiciones = sql.SQL(' AND ').join(
            sql.SQL('h.{} = p.{}').format(sql.Identifier(h), sql.Identifier(p))
            for h, p in zip(cols_hija, cols_padre)
        )
        consulta = sql.SQL('SELECT EXISTS (SELECT 1 FROM {} h JOIN {} p ON {} WHERE p.id_grupo=%s').format(
            sql.Identifier(schema, hija), sql.Identifier(esquema_padre, padre), condiciones)
        parametros = [id_grupo]
        if id_estudiante is not None:
            consulta += sql.SQL(' AND p.id_estudiante=%s')
            parametros.append(id_estudiante)
        consulta += sql.SQL(')')
        cur.execute(consulta, tuple(parametros))
        if cur.fetchone()[0]:
            raise OperacionRechazada('No se puede eliminar: existen registros históricos o dependencias que deben conservarse.')


def _bloquear_asociaciones(cur, tabla, id_grupo, id_estudiante=None):
    consulta = sql.SQL('SELECT 1 FROM {} WHERE id_grupo=%s').format(sql.Identifier(tabla))
    parametros = [id_grupo]
    if id_estudiante is not None:
        consulta += sql.SQL(' AND id_estudiante=%s')
        parametros.append(id_estudiante)
    consulta += sql.SQL(' FOR UPDATE')
    cur.execute(consulta, tuple(parametros))
    return len(cur.fetchall())


@gestion_grupos_bp.patch('/grupos/<int:id_grupo>')
def actualizar_grupo(id_grupo):
    def operacion(cur):
        datos = request.get_json(silent=True)
        if not isinstance(datos, dict) or set(datos) != {'nombre_grupo', 'grado', 'descripcion'}:
            raise OperacionRechazada('Completa únicamente el nombre, grado y descripción.', 400)
        nombre, grado, descripcion = (datos[k] for k in ('nombre_grupo', 'grado', 'descripcion'))
        if not all(isinstance(x, str) for x in (nombre, grado, descripcion)):
            raise OperacionRechazada('Los datos del grupo deben ser texto.', 400)
        nombre, descripcion = nombre.strip(), descripcion.strip()
        if not nombre or len(nombre) > 100 or len(descripcion) > 1000:
            raise OperacionRechazada('Nombre obligatorio (máximo 100 caracteres); descripción máximo 1000.', 400)
        if grado not in ('Primero', 'Segundo'):
            raise OperacionRechazada('Selecciona un grado válido.', 400)
        # Evita introducir etiquetas HTML en vistas antiguas de grupos.
        if any(c in nombre or c in descripcion for c in ('<', '>')):
            raise OperacionRechazada('No utilices los caracteres < o >.', 400)
        cur.execute('''UPDATE grupo SET nombre_grupo=%s, grado=%s, descripcion=%s
                       WHERE id_grupo=%s AND id_docente=%s''',
                    (nombre, grado, descripcion, id_grupo, g.identity['id']))
        return jsonify(success=True, message='Información del grupo actualizada.'), 200
    return _ejecutar(id_grupo, operacion)


@gestion_grupos_bp.delete('/grupos/<int:id_grupo>')
def eliminar_grupo(id_grupo):
    def operacion(cur):
        # Bloquea grupo e inscripciones antes de verificar las referencias. Así se
        # impide que una FK nueva aparezca entre la validación y el borrado.
        for tabla in ('estudiante_grupo', 'grupo_curso'):
            _bloquear_asociaciones(cur, tabla, id_grupo)
            _proteger_dependencias(cur, tabla, id_grupo)
        _proteger_dependencias(cur, 'grupo', id_grupo,
                              permitir=(('public', 'estudiante_grupo'), ('public', 'grupo_curso')))
        cur.execute('DELETE FROM estudiante_grupo WHERE id_grupo=%s', (id_grupo,))
        cur.execute('DELETE FROM grupo_curso WHERE id_grupo=%s', (id_grupo,))
        cur.execute('DELETE FROM grupo WHERE id_grupo=%s AND id_docente=%s',
                    (id_grupo, g.identity['id']))
        return jsonify(success=True, message='Grupo eliminado. Las cuentas y el progreso se conservan.'), 200
    return _ejecutar(id_grupo, operacion)


def retirar_integrante(id_grupo, id_estudiante):
    def operacion(cur):
        if not _bloquear_asociaciones(cur, 'estudiante_grupo', id_grupo, id_estudiante):
            raise OperacionRechazada('El estudiante no pertenece a este grupo.', 404)
        _proteger_dependencias(cur, 'estudiante_grupo', id_grupo, id_estudiante)
        # Solo elimina la inscripción exacta; no toca usuario, resultados ni comentarios.
        cur.execute('DELETE FROM estudiante_grupo WHERE id_grupo=%s AND id_estudiante=%s',
                    (id_grupo, id_estudiante))
        return jsonify(success=True, message='Estudiante retirado del grupo. Su cuenta y progreso se conservan.'), 200
    return _ejecutar(id_grupo, operacion, salida_estudiante=id_estudiante)
