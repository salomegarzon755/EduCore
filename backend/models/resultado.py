class Resultado:
    """Resultado de un estudiante en una actividad (tabla resultado_actividad)."""
    def __init__(self, id_actividad, aciertos, total, estrellas, semaforo, completada, intentos):
        self.id_actividad = id_actividad
        self.aciertos = aciertos
        self.total = total
        self.estrellas = estrellas
        self.semaforo = semaforo
        self.completada = completada
        self.intentos = intentos

    def to_dict(self):
        return dict(self.__dict__)

    @staticmethod
    def calcular(aciertos, total):
        """Regla única (servidor): >=80 % verde/3★, >=50 % amarillo/2★, resto rojo/1★. Teoría (total=0): sin nota."""
        if total <= 0:
            return 0, None
        pct = aciertos / total
        if pct >= 0.8:
            return 3, 'verde'
        if pct >= 0.5:
            return 2, 'amarillo'
        return 1, 'rojo'
