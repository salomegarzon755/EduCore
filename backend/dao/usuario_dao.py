from config.database import DatabaseConnection
from models.usuario import Usuario

class UsuarioDAO:

    @staticmethod
    def autenticar(username, password):
        conn = DatabaseConnection.get_connection()
        cursor = conn.cursor()
        usuario_encontrado = None

        try:
            # Se usa 'apodo' en lugar de 'usuario' según la estructura de PostgreSQL
            query = """
                SELECT id_usuario, nombre, apodo, contrasena, rol 
                FROM usuario 
                WHERE apodo = %s AND contrasena = %s
            """
            cursor.execute(query, (username, password))
            row = cursor.fetchone()

            if row:
                usuario_encontrado = Usuario(
                    id_usuario=row[0],
                    nombre=row[1],
                    usuario=row[2],
                    contrasena=row[3],
                    rol=row[4]
                )
        except Exception as e:
            print(f"Error en UsuarioDAO.autenticar: {e}")
        finally:
            cursor.close()
            DatabaseConnection.return_connection(conn)

        return usuario_encontrado

    @staticmethod
    def crear(usuario_obj, correo=""):
        """Inserta un nuevo registro ajustándose a las columnas de educore_db."""
        conn = DatabaseConnection.get_connection()
        cursor = conn.cursor()
        exito = False

        try:
            # Mapeo exacto a las columnas: nombre, apodo, correo, contrasena, rol
            query = """
                INSERT INTO usuario (nombre, apodo, correo, contrasena, rol)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id_usuario
            """
            cursor.execute(query, (
                usuario_obj.nombre if usuario_obj.nombre else usuario_obj.usuario, 
                usuario_obj.usuario,  # Se mapea la propiedad usuario al campo 'apodo'
                correo,
                usuario_obj.contrasena, 
                usuario_obj.rol
            ))
            
            id_generado = cursor.fetchone()[0]
            conn.commit()
            
            usuario_obj._id_usuario = id_generado
            exito = True
        except Exception as e:
            conn.rollback()
            print(f"Error en UsuarioDAO.crear: {e}")
        finally:
            cursor.close()
            DatabaseConnection.return_connection(conn)

        return exito