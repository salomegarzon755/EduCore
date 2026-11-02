class Grupo:
    def __init__(self, id_grupo=None, nombre_grupo="", grado="", descripcion="", id_docente=None):
        self.id_grupo = id_grupo
        self.nombre_grupo = nombre_grupo
        self.grado = grado
        self.descripcion = descripcion
        self.id_docente = id_docente

    def to_dict(self):
        return {
            "id_grupo": self.id_grupo,
            "nombre_grupo": self.nombre_grupo,
            "grado": self.grado,
            "descripcion": self.descripcion,
            "id_docente": self.id_docente
        }