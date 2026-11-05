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

class Unidad:
    def __init__(self, id_unidad=None, titulo_unidad="", id_curso=None):
        self.id_unidad = id_unidad
        self.titulo_unidad = titulo_unidad
        self.id_curso = id_curso

    def to_dict(self):
        return {
            "id_unidad": self.id_unidad,
            "titulo_unidad": self.titulo_unidad,
            "id_curso": self.id_curso
        }

class Actividad:
    def __init__(self, id_actividad=None, titulo_actividad="", tipo_contenido="", id_unidad=None):
        self.id_actividad = id_actividad
        self.titulo_actividad = titulo_actividad
        self.tipo_contenido = tipo_contenido
        self.id_unidad = id_unidad

    def to_dict(self):
        return {
            "id_actividad": self.id_actividad,
            "titulo_actividad": self.titulo_actividad,
            "tipo_contenido": self.tipo_contenido,
            "id_unidad": self.id_unidad
        }

class PregPunto:
    def __init__(self, id_punto=None, id_actividad=None, enunciado="", 
                opcion_a=None, opcion_b=None, opcion_c=None, opcion_d=None, respuesta_correcta=None,
                visual=None, explicacion=None, es_opinion=False):
        self.id_punto = id_punto
        self.id_actividad = id_actividad
        self.enunciado = enunciado
        self.opcion_a = opcion_a
        self.opcion_b = opcion_b
        self.opcion_c = opcion_c
        self.opcion_d = opcion_d
        self.respuesta_correcta = respuesta_correcta
        self.visual = visual              # JSON con las imágenes del enunciado/solución
        self.explicacion = explicacion
        self.es_opinion = es_opinion

    def to_dict(self):
        return {
            "id_punto": self.id_punto,
            "id_actividad": self.id_actividad,
            "enunciado": self.enunciado,
            "opcion_a": self.opcion_a,
            "opcion_b": self.opcion_b,
            "opcion_c": self.opcion_c,
            "opcion_d": self.opcion_d,
            "respuesta_correcta": self.respuesta_correcta,
            "visual": self.visual,
            "explicacion": self.explicacion,
            "es_opinion": self.es_opinion
        }