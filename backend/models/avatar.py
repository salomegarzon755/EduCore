AVATARES = frozenset(('kokoi', 'oso', 'serpiente', 'guacamaya', 'ballena', 'perro', 'gato', 'leopardo', 'tortuga'))

def avatar_valido(valor):
    return isinstance(valor, str) and valor in AVATARES
