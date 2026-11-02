from config.database import DatabaseConnection
from models.curso import Curso

class CursoDAO:

    @staticmethod
    def obtener_todos():
        conn = DatabaseConnection.get_connection()
        if not conn:
            return []

        try:
            cursor = conn.cursor()
            query = "SELECT id_curso, titulo_curso, descripcion FROM curso ORDER BY id_curso ASC;"
            cursor.execute(query)
            rows = cursor.fetchall()
            cursor.close()
            conn.close()

            cursos = []
            for row in rows:
                curso_obj = Curso(
                    id_curso=row[0],
                    titulo_curso=row[1],
                    descripcion=row[2]
                )
                cursos.append(curso_obj.to_dict())

            return cursos

        except Exception as e:
            print(f"Error al consultar cursos en BD: {e}")
            if conn:
                conn.close()
            return []