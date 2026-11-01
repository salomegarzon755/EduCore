class Usuario:
    def __init__(self, id_usuario=None, nombre=None, usuario=None, contrasena=None, rol=None):
        self._id_usuario = id_usuario
        self._nombre = nombre
        self._usuario = usuario
        self._contrasena = contrasena
        self._rol = rol

    # Getters / Properties
    @property
    def id_usuario(self):
        return self._id_usuario

    @property
    def nombre(self):
        return self._nombre

    @property
    def usuario(self):
        return self._usuario

    @property
    def contrasena(self):
        return self._contrasena

    @property
    def rol(self):
        return self._rol

    def to_dict(self):
        return {
            "id_usuario": self._id_usuario,
            "nombre": self._nombre,
            "usuario": self._usuario,
            "rol": self._rol
        }