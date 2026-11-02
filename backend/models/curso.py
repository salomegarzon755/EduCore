class Curso:
    def __init__(self, id_curso=None, titulo_curso="", descripcion=""):
        self.id_curso = id_curso
        self.titulo_curso = titulo_curso
        self.descripcion = descripcion

    def to_dict(self):
        return {
            "id_curso": self.id_curso,
            "titulo_curso": self.titulo_curso,
            "descripcion": self.descripcion
        }