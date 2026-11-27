"""HU.33 / HU.34 · Progreso de un estudiante en un curso.

Reglas (las mismas de HU.25 «Mi camino», js/progresoCurso.js):
  - Un TEMA es una unidad del curso con al menos una actividad.
  - Un tema está COMPLETADO cuando el estudiante terminó todas sus actividades.
  - Avance del curso = temas completados / temas del curso (redondeo como Math.round).
Estado de cada actividad (para la tabla de resultados):
  - pendiente      -> sin resultado registrado
  - completada     -> teoría vista, o mejor intento con 80 % o más (semáforo verde)
  - por_practicar  -> terminada, pero su mejor intento quedó por debajo del 80 %
Todas las funciones reciben un cursor abierto: la ruta decide la conexión y los permisos.
"""
from models.resultado import Resultado


def _redondear(valor):
    """Igual que Math.round de JS para valores positivos (Python usa redondeo bancario)."""
    return int(valor + 0.5)


def _iso(fecha):
    return fecha.isoformat() if fecha else None


def estado_actividad(completada, aciertos, total):
    if not completada:
        return 'pendiente'
    estrellas, _ = Resultado.calcular(aciertos or 0, total or 0)
    return 'completada' if (total or 0) <= 0 or estrellas == 3 else 'por_practicar'


def progreso_curso(cur, id_estudiante, id_curso):
    """Temas, actividades y avance de un estudiante en un curso. None si el curso no existe."""
    cur.execute('SELECT id_curso, titulo_curso FROM curso WHERE id_curso=%s', (id_curso,))
    curso = cur.fetchone()
    if not curso:
        return None
    cur.execute('''
        SELECT u.id_unidad, u.titulo_unidad, a.id_actividad, a.titulo_actividad, a.tipo_contenido,
               r.aciertos, r.total, COALESCE(r.completada, FALSE), COALESCE(r.intentos, 0), r.fecha
        FROM unidad u
        JOIN actividad a ON a.id_unidad = u.id_unidad
        LEFT JOIN resultado_actividad r ON r.id_actividad = a.id_actividad AND r.id_estudiante = %s
        WHERE u.id_curso = %s
        ORDER BY u.id_unidad, a.id_actividad''', (id_estudiante, id_curso))
    temas, ultima = [], None
    for (id_unidad, titulo_unidad, id_act, titulo_act, tipo, aciertos, total,
         completada, intentos, fecha) in cur.fetchall():
        if not temas or temas[-1]['id_unidad'] != id_unidad:
            temas.append({'id_unidad': id_unidad, 'titulo': titulo_unidad, 'actividades': []})
        total = total or 0
        temas[-1]['actividades'].append({
            'id_actividad': id_act, 'titulo': titulo_act, 'tipo_contenido': tipo,
            'completada': bool(completada),
            'aciertos': aciertos if completada else None,
            'total': total if completada else None,
            'porcentaje': _redondear(aciertos * 100 / total) if completada and total > 0 else None,
            'intentos': intentos,
            'estado': estado_actividad(completada, aciertos, total),
            'fecha': _iso(fecha)
        })
        if fecha and (ultima is None or fecha > ultima):
            ultima = fecha

    for t in temas:
        hechas = sum(1 for a in t['actividades'] if a['completada'])
        t['actividades_total'] = len(t['actividades'])
        t['actividades_completadas'] = hechas
        t['estado'] = ('completado' if hechas == len(t['actividades'])
                       else 'en_curso' if hechas else 'pendiente')

    total_temas = len(temas)
    completados = sum(1 for t in temas if t['estado'] == 'completado')
    actividades = [a for t in temas for a in t['actividades']]
    return {
        'id_curso': curso[0], 'titulo_curso': curso[1],
        'temas': temas,
        'temas_total': total_temas,
        'temas_completados': completados,
        'temas_pendientes': total_temas - completados,
        'porcentaje': _redondear(completados * 100 / total_temas) if total_temas else 0,
        'actividades_total': len(actividades),
        'actividades_completadas': sum(1 for a in actividades if a['completada']),
        'ultima_actividad': _iso(ultima)
    }


def resumen_progreso(progreso):
    """Versión ligera (sin temas) para listados."""
    return {k: v for k, v in progreso.items() if k != 'temas'}


def datos_estudiante(cur, id_estudiante):
    cur.execute('''SELECT id_usuario, nombre, avatar FROM usuario
                   WHERE id_usuario=%s AND rol='Estudiante' ''', (id_estudiante,))
    r = cur.fetchone()
    return {'id_estudiante': r[0], 'nombre': r[1], 'avatar': r[2] or 'kokoi'} if r else None


def grupos_estudiante(cur, id_estudiante):
    cur.execute('''SELECT g.id_grupo, g.nombre_grupo, g.grado FROM grupo g
                   JOIN estudiante_grupo eg ON eg.id_grupo = g.id_grupo
                   WHERE eg.id_estudiante=%s ORDER BY g.nombre_grupo''', (id_estudiante,))
    return [{'id_grupo': r[0], 'nombre_grupo': r[1], 'grado': r[2] or 'Primero'} for r in cur.fetchall()]


def cursos_de_grupos(cur, ids_grupos):
    """Cursos asignados a los grupos indicados (sin repetir), con el grupo por el que llegan."""
    if not ids_grupos:
        return []
    cur.execute('''SELECT DISTINCT ON (c.id_curso) c.id_curso, c.titulo_curso, g.id_grupo, g.nombre_grupo
                   FROM grupo_curso gc JOIN curso c ON c.id_curso = gc.id_curso
                   JOIN grupo g ON g.id_grupo = gc.id_grupo
                   WHERE gc.id_grupo = ANY(%s)
                   ORDER BY c.id_curso, g.id_grupo''', (list(ids_grupos),))
    return [{'id_curso': r[0], 'titulo_curso': r[1], 'id_grupo': r[2], 'nombre_grupo': r[3]}
            for r in cur.fetchall()]
