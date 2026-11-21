from flask import Blueprint, jsonify, request
from config.database import DatabaseConnection

seguimiento_bp = Blueprint('seguimiento', __name__, url_prefix='/api')


def _estado(aciertos, total):
    if not total: return 'sin_datos'
    pct = aciertos / total
    return 'buen_desempeno' if pct >= .8 else 'en_progreso' if pct >= .6 else 'necesita_apoyo'


def _actividades(cur, id_estudiante, id_grupo=None):
    # Sin grupo: actividades del estudiante; con grupo: solo cursos asignados a ese grupo.
    cur.execute('''SELECT a.id_actividad,a.titulo_actividad,c.titulo_curso,
          r.aciertos,r.total,r.intentos,r.fecha,
          (SELECT COUNT(*) FROM intento_actividad i WHERE i.id_estudiante=r.id_estudiante AND i.id_actividad=r.id_actividad)
          FROM resultado_actividad r
          JOIN actividad a ON a.id_actividad=r.id_actividad
          JOIN unidad un ON un.id_unidad=a.id_unidad
          JOIN curso c ON c.id_curso=un.id_curso
          WHERE r.id_estudiante=%s AND (%s::integer IS NULL OR EXISTS
            (SELECT 1 FROM grupo_curso gc WHERE gc.id_grupo=%s AND gc.id_curso=c.id_curso))
          ORDER BY r.fecha DESC,a.id_actividad''',(id_estudiante,id_grupo,id_grupo))
    rows=cur.fetchall(); result=[]
    for a in rows:
        cur.execute('''SELECT i.numero_intento,i.aciertos,i.total,i.fecha
                       FROM intento_actividad i WHERE i.id_estudiante=%s AND i.id_actividad=%s
                       ORDER BY i.numero_intento DESC''',(id_estudiante,a[0]))
        historia=[{'intento':x[0],'aciertos':x[1],'total':x[2],
                  'porcentaje':round(x[1]*100/x[2],1) if x[2] else None,
                  'estado':_estado(x[1],x[2]),'fecha':x[3].isoformat() if x[3] else None} for x in cur.fetchall()]
        cur.execute('''SELECT comentario FROM comentario_actividad WHERE id_estudiante=%s AND id_actividad=%s
          AND (%s::integer IS NULL OR id_grupo=%s) ORDER BY actualizado_en DESC LIMIT 1''',
          (id_estudiante,a[0],id_grupo,id_grupo))
        comment=cur.fetchone()
        result.append({'id_actividad':a[0],'actividad':a[1],'curso':a[2],
            'aciertos':a[3],'total':a[4],'intentos':a[5],
            'fecha':a[6].isoformat() if a[6] else None,'completada':True,
            'porcentaje':round(a[3]*100/a[4],1) if a[4] else None,
            'estado':_estado(a[3],a[4]),'comentario':comment[0] if comment else '',
            'historial':historia,'historial_parcial':a[5]>a[7]})
    return result


@seguimiento_bp.get('/estudiantes/<int:id_estudiante>/seguimiento')
def seguimiento_estudiante(id_estudiante):
    conn=DatabaseConnection.get_connection()
    if not conn: return jsonify(success=False,message='Sin conexión'),503
    try:
        cur=conn.cursor(); rows=_actividades(cur,id_estudiante);cur.close()
        return jsonify(success=True,actividades=rows)
    except Exception as e:
        print('Error seguimiento estudiante:',e)
        return jsonify(success=False,message='No se pudo consultar seguimiento. ¿Ejecutaste migracion_hu15_intentos.sql?'),500
    finally: DatabaseConnection.return_connection(conn)


@seguimiento_bp.get('/docentes/<int:id_docente>/seguimiento')
def seguimiento_docente(id_docente):
    conn=DatabaseConnection.get_connection()
    if not conn: return jsonify(success=False,message='Sin conexión'),503
    try:
        cur=conn.cursor()
        cur.execute('''SELECT g.id_grupo,g.nombre_grupo,g.grado,u.id_usuario,u.nombre
                       FROM grupo g JOIN estudiante_grupo eg ON eg.id_grupo=g.id_grupo
                       JOIN usuario u ON u.id_usuario=eg.id_estudiante
                       WHERE g.id_docente=%s ORDER BY g.nombre_grupo,u.nombre''',(id_docente,))
        estudiantes=[]
        for grupo,nombre,grado,est,nombre_est in cur.fetchall():
            acts=_actividades(cur,est,grupo)
            estudiantes.append({'id_grupo':grupo,'grupo':nombre,'grado':grado,
               'id_estudiante':est,'nombre':nombre_est,'actividades':len(acts),
               'resultados':acts})
        cur.close()
        return jsonify(success=True,estudiantes=estudiantes)
    except Exception as e:
        print('Error seguimiento docente:',e)
        return jsonify(success=False,message='No se pudo consultar seguimiento'),500
    finally: DatabaseConnection.return_connection(conn)


@seguimiento_bp.put('/docentes/<int:id_docente>/seguimiento')
def actualizar_seguimiento(id_docente):
    d=request.get_json(silent=True) or {}
    try:
        estudiante=int(d['id_estudiante']);grupo=int(d['id_grupo']);actividad=int(d['id_actividad'])
        comentario=str(d.get('comentario','')).strip()
        if len(comentario)>3000: return jsonify(success=False,message='Comentario demasiado largo'),400
    except (KeyError,TypeError,ValueError):
        return jsonify(success=False,message='Faltan identificadores válidos'),400
    conn=DatabaseConnection.get_connection()
    if not conn: return jsonify(success=False,message='Sin conexión'),503
    try:
        cur=conn.cursor()
        cur.execute('''SELECT 1 FROM grupo g
            JOIN estudiante_grupo eg ON eg.id_grupo=g.id_grupo AND eg.id_estudiante=%s
            JOIN grupo_curso gc ON gc.id_grupo=g.id_grupo
            JOIN unidad un ON un.id_curso=gc.id_curso
            JOIN actividad a ON a.id_unidad=un.id_unidad AND a.id_actividad=%s
            JOIN resultado_actividad r ON r.id_actividad=a.id_actividad AND r.id_estudiante=%s
            WHERE g.id_docente=%s AND g.id_grupo=%s LIMIT 1''',
            (estudiante,actividad,estudiante,id_docente,grupo))
        if not cur.fetchone(): return jsonify(success=False,message='Actividad o estudiante no asociado al docente'),403
        cur.execute('''INSERT INTO comentario_actividad
          (id_docente,id_estudiante,id_grupo,id_actividad,comentario)
          VALUES(%s,%s,%s,%s,%s)
          ON CONFLICT(id_docente,id_estudiante,id_grupo,id_actividad)
          DO UPDATE SET comentario=EXCLUDED.comentario,actualizado_en=NOW()''',
          (id_docente,estudiante,grupo,actividad,comentario))
        conn.commit();return jsonify(success=True)
    except Exception as e:
        conn.rollback();print('Error guardando comentario:',e)
        return jsonify(success=False,message='No se pudo guardar comentario'),500
    finally: DatabaseConnection.return_connection(conn)
