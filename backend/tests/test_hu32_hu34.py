"""Pruebas de HU.32, HU.33 y HU.34 + regresión de endpoints relacionados.

Requiere una BD LOCAL creada con tests/preparar_bd_pruebas.sh (nunca Neon/producción):
  cd backend
  tests/preparar_bd_pruebas.sh "postgresql://postgres@localhost:5432/educore_test"
  EDUCORE_TEST_DATABASE_URL="postgresql://postgres@localhost:5432/educore_test" python -m pytest -q tests
"""
import os
import sys
import pytest

URL = os.getenv('EDUCORE_TEST_DATABASE_URL')
if not URL:
    pytest.skip('Define EDUCORE_TEST_DATABASE_URL (BD local de pruebas)', allow_module_level=True)
os.environ['DATABASE_URL'] = URL
os.environ.setdefault('AUTH_SECRET_KEY', 'clave-solo-para-pruebas-locales-0123456789abcdef')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app  # noqa: E402
from config.database import DatabaseConnection  # noqa: E402

MARIANA, SAMUEL, LUCIA, ANA, PEDRO = 102, 103, 107, 101, 106


def sql(consulta, params=()):
    conn = DatabaseConnection.get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(consulta, params)
            filas = cur.fetchall() if cur.description else None
        conn.commit()
        return filas
    finally:
        DatabaseConnection.return_connection(conn)


@pytest.fixture(scope='module')
def c():
    # Cada corrida empieza sin resultados para que los conteos sean exactos.
    sql('TRUNCATE respuesta_estudiante, intento_actividad, resultado_actividad, comentario_actividad')
    return app.test_client()


def login(c, usuario, portal):
    r = c.post('/api/login', json={'usuario': usuario, 'contrasena': 'Clave123', 'rol_esperado': portal})
    assert r.status_code == 200, r.get_json()
    return {'Authorization': 'Bearer ' + r.get_json()['token']}


def puntos(id_actividad):
    return [r[0] for r in sql('SELECT id_punto FROM preg_punto WHERE id_actividad=%s AND opcion_a IS NOT NULL ORDER BY id_punto', (id_actividad,))]


def jugar(c, h, id_est, id_act, buenas):
    """Responde `buenas` preguntas bien (A) y el resto mal (B)."""
    resp = [{'id_punto': p, 'elegida': 'A' if i < buenas else 'B', 'correcta': True} for i, p in enumerate(puntos(id_act))]
    return c.post('/api/resultados', headers=h, json={'id_estudiante': id_est, 'id_actividad': id_act,
                                                     'aciertos': 99, 'total': 99, 'respuestas': resp})


# ------------------------------------------------------------------ HU.32
class TestHU32:
    def test_sin_errores_felicita_con_mensaje_de_bd(self, c):
        h = login(c, 'mariana', 'Estudiante')
        d = jugar(c, h, MARIANA, 1, 5).get_json()
        assert d['success'] and d['intento'] == {'numero': 1, 'aciertos': 5, 'total': 5, 'incorrectas': 0,
                                                 'porcentaje': 100, 'estrellas': 3, 'semaforo': 'verde'}
        titulos = [r[0] for r in sql("SELECT titulo FROM mensaje_felicitacion WHERE tipo='sin_errores'")]
        assert d['felicitacion']['tipo'] == 'sin_errores' and d['felicitacion']['titulo'] in titulos

    def test_puntaje_alto_y_seguir_practicando(self, c):
        h = login(c, 'mariana', 'Estudiante')
        d = jugar(c, h, MARIANA, 2, 4).get_json()
        assert d['felicitacion']['tipo'] == 'puntaje_alto' and d['intento']['porcentaje'] == 80
        d = jugar(c, h, MARIANA, 3, 3).get_json()
        assert d['felicitacion']['tipo'] == 'seguir_practicando'
        assert (d['intento']['aciertos'], d['intento']['incorrectas'], d['intento']['porcentaje']) == (3, 2, 60)

    def test_reintento_muestra_intento_actual_y_conserva_mejor(self, c):
        h = login(c, 'mariana', 'Estudiante')
        d = jugar(c, h, MARIANA, 1, 1).get_json()
        assert d['intento']['numero'] == 2 and d['intento']['aciertos'] == 1
        assert d['resultado']['aciertos'] == 5  # el mejor intento sigue siendo el resultado principal

    def test_puntaje_lo_calcula_el_servidor(self, c):
        h = login(c, 'samuel', 'Estudiante')
        ajeno = puntos(2)[0]  # pregunta de otra actividad: se ignora
        resp = [{'id_punto': p, 'elegida': 'C', 'correcta': True} for p in puntos(1)] + [{'id_punto': ajeno, 'elegida': 'A'}]
        d = c.post('/api/resultados', headers=h, json={'id_estudiante': SAMUEL, 'id_actividad': 1,
                                                      'aciertos': 5, 'total': 5, 'respuestas': resp}).get_json()
        assert (d['intento']['aciertos'], d['intento']['total']) == (0, 5)
        sql('DELETE FROM respuesta_estudiante WHERE id_estudiante=%s', (SAMUEL,))
        sql('DELETE FROM intento_actividad WHERE id_estudiante=%s', (SAMUEL,))
        sql('DELETE FROM resultado_actividad WHERE id_estudiante=%s', (SAMUEL,))

    def test_sin_respuestas_en_actividad_con_preguntas(self, c):
        h = login(c, 'mariana', 'Estudiante')
        r = c.post('/api/resultados', headers=h, json={'id_estudiante': MARIANA, 'id_actividad': 4, 'respuestas': []})
        assert r.status_code == 400

    def test_teoria_sin_mensaje(self, c):
        h = login(c, 'mariana', 'Estudiante')
        r = c.post('/api/resultados', headers=h, json={'id_estudiante': MARIANA, 'id_actividad': 6, 'respuestas': []})
        assert r.status_code == 200 and r.get_json()['felicitacion'] is None

    def test_permisos(self, c):
        h = login(c, 'mariana', 'Estudiante')
        assert jugar(c, h, SAMUEL, 1, 5).status_code == 403            # resultado a nombre de otro
        assert jugar(c, login(c, 'mariana', 'Padre o Madre'), MARIANA, 1, 5).status_code == 403  # portal familia
        assert jugar(c, {}, MARIANA, 1, 5).status_code == 401           # sin sesión
        assert c.post('/api/resultados', headers=h, json={'id_estudiante': MARIANA, 'id_actividad': 9999,
                                                          'respuestas': []}).status_code == 404
        assert c.get(f'/api/estudiantes/{SAMUEL}/progreso?id_curso=1', headers=h).status_code == 403
        assert c.get(f'/api/estudiantes/{MARIANA}/progreso?id_curso=1', headers=h).status_code == 200


# ------------------------------------------------------------------ HU.33
class TestHU33:
    def test_resumen(self, c):
        h = login(c, 'mariana', 'Padre o Madre')
        d = c.get(f'/api/familia/estudiantes/{MARIANA}/resumen?id_grupo=1', headers=h).get_json()
        assert d['estudiante']['nombre'] == 'Mariana Palacios' and d['grupo_actual']['nombre_grupo'] == 'Primero A'
        curso = d['cursos'][0]
        # Temas 1 (act 1 + teoría 6), 2 y 3 completos; tema 4 pendiente -> 3/4 = 75 %
        assert (curso['titulo_curso'], curso['temas_completados'], curso['temas_total'], curso['porcentaje']) == \
               ('Exploradores de los números', 3, 4, 75)

    def test_detalle_y_resultados(self, c):
        h = login(c, 'mariana', 'Padre o Madre')
        d = c.get(f'/api/familia/estudiantes/{MARIANA}/cursos/1/progreso', headers=h).get_json()
        acts = {a['id_actividad']: a for t in d['progreso']['temas'] for a in t['actividades']}
        assert acts[1]['estado'] == 'completada' and acts[1]['porcentaje'] == 100
        assert acts[2]['estado'] == 'completada' and acts[2]['porcentaje'] == 80
        assert acts[3]['estado'] == 'por_practicar' and acts[3]['porcentaje'] == 60
        assert acts[4]['estado'] == 'pendiente' and acts[4]['aciertos'] is None
        assert [t['estado'] for t in d['progreso']['temas']] == ['completado', 'completado', 'completado', 'pendiente']

    def test_otro_estudiante_bloqueado_sin_filtrar_datos(self, c):
        h = login(c, 'mariana', 'Padre o Madre')
        for ruta in (f'/api/familia/estudiantes/{SAMUEL}/resumen', f'/api/familia/estudiantes/{SAMUEL}/cursos/1/progreso',
                     '/api/familia/estudiantes/99999/resumen'):
            r = c.get(ruta, headers=h)
            d = r.get_json()
            assert r.status_code == 403 and d['codigo'] == 'ACCESO_RESTRINGIDO'
            assert d['estudiante_asociado']['nombre'] == 'Mariana Palacios'
            assert 'Samuel' not in r.get_data(as_text=True)

    def test_curso_o_grupo_no_asignado(self, c):
        h = login(c, 'mariana', 'Padre o Madre')
        assert c.get(f'/api/familia/estudiantes/{MARIANA}/cursos/2/progreso', headers=h).get_json()['codigo'] == 'CURSO_NO_ASIGNADO'
        assert c.get(f'/api/familia/estudiantes/{MARIANA}/resumen?id_grupo=2', headers=h).status_code == 403

    def test_solo_portal_familia(self, c):
        assert c.get(f'/api/familia/estudiantes/{MARIANA}/resumen', headers=login(c, 'mariana', 'Estudiante')).status_code == 403
        assert c.get(f'/api/familia/estudiantes/{MARIANA}/resumen', headers=login(c, 'ana.docente', 'Docente')).status_code == 403
        assert c.get(f'/api/familia/estudiantes/{MARIANA}/resumen').status_code == 401


# ------------------------------------------------------------------ HU.34
class TestHU34:
    def test_grupos_y_listado(self, c):
        h = login(c, 'ana.docente', 'Docente')
        d = c.get(f'/api/docentes/{ANA}/progreso', headers=h).get_json()
        assert [(x['nombre_grupo'], x['total_estudiantes'], [k['id_curso'] for k in x['cursos']]) for x in d['grupos']] == \
               [('Primero A', 4, [1])]
        d = c.get(f'/api/docentes/{ANA}/grupos/1/progreso', headers=h).get_json()
        por_nombre = {e['nombre']: e for e in d['estudiantes']}
        assert len(por_nombre) == 4 and d['curso']['titulo_curso'] == 'Exploradores de los números'
        assert (por_nombre['Mariana Palacios']['temas_completados'], por_nombre['Mariana Palacios']['porcentaje']) == (3, 75)
        assert por_nombre['Samuel Córdoba']['porcentaje'] == 0 and por_nombre['Samuel Córdoba']['avatar'] == 'leopardo'
        assert 'temas' not in por_nombre['Mariana Palacios']

    def test_detalle_individual(self, c):
        h = login(c, 'ana.docente', 'Docente')
        d = c.get(f'/api/docentes/{ANA}/grupos/1/estudiantes/{MARIANA}/progreso?id_curso=1', headers=h).get_json()
        p = d['progreso']
        assert d['estudiante']['nombre'] == 'Mariana Palacios'
        assert (p['temas_completados'], p['temas_pendientes'], p['actividades_completadas'], p['actividades_total']) == (3, 1, 4, 5)

    def test_permisos(self, c):
        ana, pedro = login(c, 'ana.docente', 'Docente'), login(c, 'pedro.docente', 'Docente')
        assert c.get(f'/api/docentes/{PEDRO}/grupos/1/progreso', headers=pedro).status_code == 403        # grupo ajeno
        assert c.get(f'/api/docentes/{PEDRO}/grupos/1/estudiantes/{MARIANA}/progreso', headers=pedro).status_code == 403
        assert c.get(f'/api/docentes/{PEDRO}/progreso', headers=ana).status_code == 403                    # suplantar docente
        assert c.get(f'/api/docentes/{ANA}/grupos/1/estudiantes/{LUCIA}/progreso', headers=ana).status_code == 404  # no inscrito
        assert c.get(f'/api/docentes/{ANA}/grupos/1/progreso?id_curso=2', headers=ana).status_code == 404  # curso no asignado
        assert c.get(f'/api/docentes/{ANA}/grupos/999/progreso', headers=ana).status_code == 404
        assert c.get(f'/api/docentes/{ANA}/progreso', headers=login(c, 'mariana', 'Estudiante')).status_code == 403
        assert c.get(f'/api/docentes/{PEDRO}/grupos/2/progreso', headers=pedro).get_json()['estudiantes'][0]['nombre'] == 'Lucía Ajena'


# ------------------------------------------------------------------ Regresión
class TestRegresion:
    def test_endpoints_existentes(self, c):
        est, fam, doc = login(c, 'mariana', 'Estudiante'), login(c, 'mariana', 'Padre o Madre'), login(c, 'ana.docente', 'Docente')
        assert c.get('/api/health').status_code == 200
        assert c.get('/api/cursos').get_json()['cursos']
        assert c.get('/api/actividades/1/puntos').status_code == 200
        d = c.get(f'/api/estudiantes/{MARIANA}/seguimiento', headers=est).get_json()
        assert d['success'] and len(d['actividades']) == 4
        assert c.get(f'/api/estudiantes/{MARIANA}/seguimiento?id_grupo=1', headers=fam).get_json()['success']
        d = c.get(f'/api/docentes/{ANA}/seguimiento', headers=doc).get_json()
        assert d['success'] and len(d['estudiantes']) == 4
        assert c.get('/api/estudiantes/inicio', headers=est).get_json()['cursos'][0]['completadas'] == 4
        d = c.get(f'/api/cursos/1/detalle_completo?id_estudiante={MARIANA}', headers=est).get_json()
        assert d['curso']['actividades_completadas'] == 4
        assert c.get(f'/api/cursos/1/detalle_completo?id_estudiante={MARIANA}', headers=doc).status_code == 403
        assert c.get(f'/api/estudiantes/{MARIANA}/unidades/1/resumen', headers=est).get_json()['resumen']['completo']
        assert c.get('/api/grupos/1', headers=doc).get_json()['grupo']['total_estudiantes'] == 4
        assert c.get(f'/api/grupos/docente/{ANA}', headers=doc).get_json()['grupos'][0]['total_estudiantes'] == 4
