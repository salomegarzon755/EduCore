-- ============================================================
-- EduCore · Migración Sprint 1 (actividades, imágenes y resultados)
-- Idempotente: se puede ejecutar varias veces. Funciona igual en
-- PostgreSQL local y en la nube (Render, Neon, Supabase, Railway…).
--   psql -d educore_db -f backend/db/migracion_actividades.sql
--   psql "$DATABASE_URL" -f backend/db/migracion_actividades.sql
-- ============================================================
BEGIN;
ALTER TABLE preg_punto ADD COLUMN IF NOT EXISTS visual      JSONB;   -- imágenes del enunciado y de la solución
ALTER TABLE preg_punto ADD COLUMN IF NOT EXISTS explicacion TEXT;    -- explicación pedagógica (HU.14)
ALTER TABLE preg_punto ADD COLUMN IF NOT EXISTS es_opinion  BOOLEAN NOT NULL DEFAULT FALSE; -- encuestas de sentimiento: sin correcto/incorrecto

CREATE TABLE IF NOT EXISTS resultado_actividad (
  id_resultado  SERIAL PRIMARY KEY,
  id_estudiante INTEGER NOT NULL REFERENCES usuario(id_usuario)   ON DELETE CASCADE,
  id_actividad  INTEGER NOT NULL REFERENCES actividad(id_actividad) ON DELETE CASCADE,
  aciertos      INTEGER NOT NULL DEFAULT 0,
  total         INTEGER NOT NULL DEFAULT 0,
  estrellas     SMALLINT NOT NULL DEFAULT 0,
  semaforo      VARCHAR(10) CHECK (semaforo IN ('verde','amarillo','rojo')),
  completada    BOOLEAN NOT NULL DEFAULT TRUE,
  intentos      INTEGER NOT NULL DEFAULT 1,
  fecha         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id_estudiante, id_actividad)
);
CREATE TABLE IF NOT EXISTS respuesta_estudiante (
  id_respuesta  SERIAL PRIMARY KEY,
  id_estudiante INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  id_punto      INTEGER NOT NULL REFERENCES preg_punto(id_punto) ON DELETE CASCADE,
  intento       INTEGER NOT NULL,
  opcion_elegida CHAR(1),
  es_correcta   BOOLEAN NOT NULL,
  fecha         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_resultado_estudiante ON resultado_actividad(id_estudiante);
CREATE INDEX IF NOT EXISTS idx_respuesta_estudiante ON respuesta_estudiante(id_estudiante, id_punto);

-- Contenido visual: cada imagen sale de img/files/EduCore_Identidad/04_decorativos/png/<i>.png
-- Token: {"i":"coco","n":4} (n imágenes) | {"num":3} (número) | mat_suma / mat_resta / mat_igual (operadores)

UPDATE preg_punto SET visual='{"q":[{"i":"mango","n":2},{"i":"mat_suma"},{"i":"mango","n":1},{"i":"mat_igual"},{"i":"mango","n":3}]}'::jsonb WHERE enunciado = 'Sumar significa juntar, agregar o añadir cosas para saber cuánto tenemos en total.';
UPDATE preg_punto SET visual='{"q":[{"i":"mat_suma"},{"i":"mat_igual"}]}'::jsonb WHERE enunciado = 'El símbolo de la suma es la cruz (+) que se lee "más". El símbolo (=) se lee "igual a".';
UPDATE preg_punto SET visual='{"q":[{"i":"flor_rosa","n":3},{"i":"mat_suma"},{"i":"flor_rosa","n":2},{"i":"mat_igual"},{"i":"flor_rosa","n":5}]}'::jsonb WHERE enunciado = 'Ejemplo: 3 flores + 2 flores = 5 flores en total.';
UPDATE preg_punto SET visual='{"a":[{"i":"mat_suma"}]}'::jsonb, explicacion='El símbolo de la suma es la cruz (+), se lee «más».' WHERE enunciado = '¿Cuál es el símbolo que usamos para sumar?';
UPDATE preg_punto SET visual='{"a":[{"i":"mango","n":2},{"i":"mat_suma"},{"i":"mango","n":1},{"i":"mat_igual"},{"i":"mango","n":3}]}'::jsonb, explicacion='Sumar es juntar: 2 mangos y 1 mango son 3 mangos.' WHERE enunciado = '¿Qué significa sumar?';
UPDATE preg_punto SET visual='{"q":[{"i":"estrella","n":1},{"i":"mat_suma"},{"i":"estrella","n":1}],"a":[{"i":"estrella","n":1},{"i":"mat_suma"},{"i":"estrella","n":1},{"i":"mat_igual"},{"i":"estrella","n":2}]}'::jsonb, explicacion='Juntamos 1 y 1 estrellas: contamos todos y son 2.' WHERE enunciado = 'Si sumas 1 + 1, ¿cuál es el resultado?';
UPDATE preg_punto SET es_opinion=TRUE WHERE enunciado = '¿Te pareció fácil entender cómo se juntan los objetos?';
UPDATE preg_punto SET visual='{"q":[{"i":"hoja_tropical","n":4},{"i":"mat_suma"},{"i":"hoja_tropical","n":3}],"a":[{"i":"hoja_tropical","n":4},{"i":"mat_suma"},{"i":"hoja_tropical","n":3},{"i":"mat_igual"},{"i":"hoja_tropical","n":7}]}'::jsonb, explicacion='Juntamos 4 y 3 hojas: contamos todos y son 7.' WHERE enunciado = 'Si tienes 4 hojas tropicales y encuentras 3 más, ¿cuántas hojas tienes (4 + 3)?';
UPDATE preg_punto SET visual='{"q":[{"i":"estrella","n":5},{"i":"mat_suma"},{"i":"estrella","n":5}],"a":[{"i":"estrella","n":5},{"i":"mat_suma"},{"i":"estrella","n":5},{"i":"mat_igual"},{"i":"estrella","n":10}]}'::jsonb, explicacion='Juntamos 5 y 5 estrellas: contamos todos y son 10.' WHERE enunciado = 'Resuelve la siguiente suma: 5 + 5 = ?';
UPDATE preg_punto SET visual='{"q":[{"i":"ave_tuki","n":6},{"i":"mat_suma"},{"i":"ave_tuki","n":2}],"a":[{"i":"ave_tuki","n":6},{"i":"mat_suma"},{"i":"ave_tuki","n":2},{"i":"mat_igual"},{"i":"ave_tuki","n":8}]}'::jsonb, explicacion='Sumamos 6 y 2 pajaritos: contamos todos y son 8.' WHERE enunciado = 'En un árbol hay 6 pajaritos y llegan 2 más. ¿Cuántos pajaritos hay en total?';
UPDATE preg_punto SET visual='{"q":[{"i":"estrella","n":8},{"i":"mat_suma"},{"i":"estrella","n":2}],"a":[{"i":"estrella","n":8},{"i":"mat_suma"},{"i":"estrella","n":2},{"i":"mat_igual"},{"i":"estrella","n":10}]}'::jsonb, explicacion='Juntamos 8 y 2 estrellas: contamos todos y son 10.' WHERE enunciado = '¿Cuánto es 8 + 2?';
UPDATE preg_punto SET visual='{"q":[{"i":"estrella","n":7},{"i":"mat_suma"},{"i":"estrella","n":1}],"a":[{"i":"estrella","n":7},{"i":"mat_suma"},{"i":"estrella","n":1},{"i":"mat_igual"},{"i":"estrella","n":8}]}'::jsonb, explicacion='Juntamos 7 y 1 estrellas: contamos todos y son 8.' WHERE enunciado = 'Si sumas 7 + 1, ¿cuál es el resultado final?';
UPDATE preg_punto SET visual='{"q":[{"i":"estrella","n":10},{"i":"mat_suma"},{"i":"estrella","n":4}],"a":[{"i":"estrella","n":10},{"i":"mat_suma"},{"i":"estrella","n":4},{"i":"mat_igual"},{"i":"estrella","n":14}]}'::jsonb, explicacion='Juntamos 10 y 4 estrellas: contamos todos y son 14.' WHERE enunciado = 'Resuelve la operación: 10 + 4 = ?';
UPDATE preg_punto SET visual='{"q":[{"i":"estrella","n":9},{"i":"mat_suma"},{"i":"estrella","n":3}],"a":[{"i":"estrella","n":9},{"i":"mat_suma"},{"i":"estrella","n":3},{"i":"mat_igual"},{"i":"estrella","n":12}]}'::jsonb, explicacion='Juntamos 9 y 3 estrellas de mar: contamos todos y son 12.' WHERE enunciado = 'Juntaste 9 estrellas de mar y tu amigo 3. ¿Cuántas tienen entre los dos? (9 + 3)';
UPDATE preg_punto SET visual='{"q":[{"i":"estrella","n":11},{"i":"mat_suma"},{"i":"estrella","n":5}],"a":[{"i":"estrella","n":11},{"i":"mat_suma"},{"i":"estrella","n":5},{"i":"mat_igual"},{"i":"estrella","n":16}]}'::jsonb, explicacion='Juntamos 11 y 5 estrellas: contamos todos y son 16.' WHERE enunciado = '¿Cuánto es 11 + 5?';
UPDATE preg_punto SET visual='{"q":[{"i":"banano","n":12},{"i":"mat_suma"},{"i":"banano","n":3}],"a":[{"i":"banano","n":12},{"i":"mat_suma"},{"i":"banano","n":3},{"i":"mat_igual"},{"i":"banano","n":15}]}'::jsonb, explicacion='Juntamos 12 y 3 bananos: contamos todos y son 15.' WHERE enunciado = 'Si tienes 12 bananos y te regalan 3 más, ¿cuántos bananos sumaste?';
UPDATE preg_punto SET visual='{"a":[{"i":"estrella","n":5},{"i":"mat_suma"},{"i":"estrella","n":5},{"i":"mat_igual"},{"i":"estrella","n":10}]}'::jsonb, explicacion='5 y 5 juntos forman 10.' WHERE enunciado = '¿Qué números al sumarse dan como resultado 10?';
UPDATE preg_punto SET es_opinion=TRUE WHERE enunciado = '¿Te resulta fácil distinguir las figuras en los dibujos?';
UPDATE preg_punto SET visual='{"a":[{"num":1},{"num":2},{"num":3}]}'::jsonb, explicacion='Contamos 1, 2 y después viene el 3.' WHERE enunciado = '¿Qué número sigue después del 2?';
UPDATE preg_punto SET visual='{"a":[{"num":3}]}'::jsonb, explicacion='Este es el número tres.' WHERE enunciado = 'Si ves 3 pecesitos nadando, ¿cuál es el número tres?';
UPDATE preg_punto SET visual='{"q":[{"i":"banano","n":3}],"a":[{"i":"banano","n":3},{"i":"mat_igual"},{"num":3}]}'::jsonb, explicacion='Contamos uno por uno: hay 3 bananos.' WHERE enunciado = '¿Cuántos Bananos ves?';
UPDATE preg_punto SET visual='{"q":[{"i":"coco","n":4},{"i":"mat_resta"},{"i":"coco","n":1}],"a":[{"i":"coco","n":4},{"i":"mat_resta"},{"i":"coco","n":1},{"i":"mat_igual"},{"i":"coco","n":3}]}'::jsonb, explicacion='A 4 cocos les quitamos 1 y nos quedan 3.' WHERE enunciado = 'Si en la palmera hay 4 cocos y cae 1, ¿cuántos cocos quedan en el árbol?';
UPDATE preg_punto SET visual='{"q":[{"i":"banano","n":1},{"i":"mango","n":1},{"i":"mariposa","n":1},{"i":"ave_tuki","n":1}]}'::jsonb WHERE enunciado = '¡Hola explorador! Hoy aprenderemos a contar frutas y animales de nuestra tierra. Los números sirven para saber cuántas cosas tenemos.';
UPDATE preg_punto SET visual='{"q":[{"i":"banano","n":1},{"i":"mat_suma"},{"i":"mango","n":1},{"i":"mat_igual"},{"num":2}]}'::jsonb WHERE enunciado = 'Si encuentras 1 banano y luego 1 mango, ¡tienes 2 frutas deliciosas!';
UPDATE preg_punto SET visual='{"q":[{"i":"mariposa","n":5}]}'::jsonb WHERE enunciado = 'Cuenta las mariposas que vuelan: una, dos, tres, cuatro y cinco. ¡Muy bien!';
UPDATE preg_punto SET visual='{"q":[{"i":"mariposa","n":5}],"a":[{"i":"mariposa","n":5},{"i":"mat_igual"},{"num":5}]}'::jsonb, explicacion='Contamos uno por uno: hay 5 mariposas.' WHERE enunciado = '¿Cuántas mariposas ves volar juntas en el grupo?';
UPDATE preg_punto SET visual='{"q":[{"i":"nube","n":1}],"a":[{"i":"nube","n":1},{"i":"mat_igual"},{"num":1}]}'::jsonb, explicacion='Contamos uno por uno: hay 1 nube.' WHERE enunciado = '¿Cuántas nubes ves flotando en el cielo?';
UPDATE preg_punto SET visual='{"q":[{"i":"piedra","n":7},{"i":"mat_suma"},{"i":"piedra","n":1}],"a":[{"i":"piedra","n":7},{"i":"mat_suma"},{"i":"piedra","n":1},{"i":"mat_igual"},{"i":"piedra","n":8}]}'::jsonb, explicacion='Juntamos 7 y 1 piedras: contamos todos y son 8.' WHERE enunciado = 'Si tienes 7 piedras y encuentras 1 más, ¿cuántas piedras tienes en total?';
UPDATE preg_punto SET visual='{"q":[{"i":"piedra","n":1},{"i":"sandia","n":1}]}'::jsonb WHERE enunciado = 'El Círculo es redondo como la piedra de río o la rodaja de sandía, no tiene esquinas.';
UPDATE preg_punto SET visual='{"q":[{"i":"mat_regla","n":1}]}'::jsonb WHERE enunciado = 'Una regla tiene forma alargada (rectángulo). ¿Es igual que un cuadrado?';
UPDATE preg_punto SET visual='{"q":[{"i":"mat_regla","n":1}],"a":[{"num":4}]}'::jsonb, explicacion='Un rectángulo, como la regla, tiene 4 esquinas.' WHERE enunciado = 'Cuenta las esquinas del recuadro de la regla: 1, 2, 3... ¿cuántas son?';
UPDATE preg_punto SET visual='{"q":[{"i":"mango","n":2},{"i":"mat_suma"},{"i":"mango","n":2}],"a":[{"i":"mango","n":2},{"i":"mat_suma"},{"i":"mango","n":2},{"i":"mat_igual"},{"i":"mango","n":4}]}'::jsonb, explicacion='Juntamos 2 y 2 mangos: contamos todos y son 4.' WHERE enunciado = 'Si tienes 2 mangos y te regalan 2 más, ¿cuántos mangos tienes?';
UPDATE preg_punto SET visual='{"a":[{"i":"papaya","n":5}]}'::jsonb, explicacion='5 papayas son más que 2, 1 o 3.' WHERE enunciado = '¿Cuál de las opciones representa una cantidad mayor?';
UPDATE preg_punto SET visual='{"q":[{"i":"rana_kokoi","n":1}]}'::jsonb WHERE enunciado = 'Cuenta las patas de una rana: 1, 2, 3, 4. ¿Cuántas patas son?';
UPDATE preg_punto SET visual='{"q":[{"i":"ave_tuki","n":6}],"a":[{"i":"ave_tuki","n":6},{"i":"mat_igual"},{"num":6}]}'::jsonb, explicacion='Contamos uno por uno: hay 6 aves Tuki.' WHERE enunciado = 'Observas 6 aves Tuki volando juntas. ¿Cómo se escribe el número seis?';
UPDATE preg_punto SET visual='{"q":[{"i":"pina","n":1},{"i":"mat_suma"},{"i":"pina","n":1},{"i":"mat_suma"},{"i":"pina","n":1}],"a":[{"i":"pina","n":1},{"i":"mat_suma"},{"i":"pina","n":1},{"i":"mat_suma"},{"i":"pina","n":1},{"i":"mat_igual"},{"i":"pina","n":3}]}'::jsonb, explicacion='Una piña para cada uno de los 3 amigos: 1 + 1 + 1 = 3 piñas.' WHERE enunciado = 'Si le das 1 piña a cada uno de tus 3 amigos, ¿cuántas piñas usaste?';
UPDATE preg_punto SET visual='{"q":[{"i":"banano","n":1},{"i":"mango","n":1}],"a":[{"i":"banano","n":1},{"i":"mango","n":1},{"i":"mat_igual"},{"num":2}]}'::jsonb, explicacion='Hay un banano y un mango: son 2 frutas.' WHERE enunciado = '¿Cuántas frutas ves?';
UPDATE preg_punto SET visual='{"q":[{"i":"estrella","n":10},{"i":"mat_igual"},{"i":"mat_abaco","n":1}]}'::jsonb WHERE enunciado = 'Una Unidad representa 1 elemento solo. Cuando juntas 10 Unidades, formas 1 DECENA (10).';
UPDATE preg_punto SET visual='{"q":[{"i":"mat_abaco","n":1}]}'::jsonb WHERE enunciado = 'Cuando agrupas 10 Decenas (o 100 Unidades), formas 1 CENTENA (100).';
UPDATE preg_punto SET visual='{"q":[{"i":"mat_abaco","n":1}]}'::jsonb WHERE enunciado = 'Por ejemplo, el número 34 tiene 3 Decenas (30) y 4 Unidades (4).';
UPDATE preg_punto SET visual='{"q":[{"i":"mat_abaco","n":1}]}'::jsonb WHERE enunciado = '¿Cuántas unidades equivalen a 1 Decena?';
UPDATE preg_punto SET es_opinion=TRUE WHERE enunciado = '¿Comprendes la diferencia entre Unidad y Decena?';
UPDATE preg_punto SET visual='{"q":[{"i":"mat_abaco","n":1}]}'::jsonb WHERE enunciado = 'El número 50, ¿cuántas decenas tiene?';
UPDATE preg_punto SET visual='{"q":[{"i":"mat_abaco","n":1}]}'::jsonb WHERE enunciado = 'Descompón el número 48 en decenas y unidades:';
UPDATE preg_punto SET visual='{"q":[{"i":"mat_abaco","n":1}]}'::jsonb WHERE enunciado = '¿Qué número se forma con 6 decenas y 3 unidades?';
UPDATE preg_punto SET visual='{"q":[{"i":"mango","n":5},{"i":"mat_resta"},{"i":"mango","n":2},{"i":"mat_igual"},{"i":"mango","n":3}]}'::jsonb WHERE enunciado = 'Restar consiste en quitar, sustraer o calcular la diferencia entre dos cantidades.';
UPDATE preg_punto SET visual='{"q":[{"i":"mat_resta"}]}'::jsonb WHERE enunciado = 'El símbolo de la resta es el guión (-) y se lee "menos".';
UPDATE preg_punto SET visual='{"q":[{"i":"mango","n":15},{"i":"mat_resta"},{"i":"mango","n":5},{"i":"mat_igual"},{"i":"mango","n":10}]}'::jsonb WHERE enunciado = 'Ejemplo: Si en un canasto hay 15 mangos y vendes 5, te quedan 15 - 5 = 10 mangos.';
UPDATE preg_punto SET visual='{"a":[{"i":"mat_resta"}]}'::jsonb, explicacion='El símbolo de la resta es el guion (-), se lee «menos».' WHERE enunciado = '¿Cuál es el símbolo de la resta?';
UPDATE preg_punto SET visual='{"q":[{"i":"estrella","n":10},{"i":"mat_resta"},{"i":"estrella","n":4}],"a":[{"i":"estrella","n":10},{"i":"mat_resta"},{"i":"estrella","n":4},{"i":"mat_igual"},{"i":"estrella","n":6}]}'::jsonb, explicacion='A 10 estrellas les quitamos 4 y nos quedan 6.' WHERE enunciado = '¿Cuánto es 10 - 4?';
UPDATE preg_punto SET es_opinion=TRUE WHERE enunciado = '¿Cómo te sientes resolviendo restas?';
UPDATE preg_punto SET visual='{"q":[{"i":"estrella","n":45},{"i":"mat_resta"},{"i":"estrella","n":12}],"a":[{"i":"estrella","n":45},{"i":"mat_resta"},{"i":"estrella","n":12},{"i":"mat_igual"},{"i":"estrella","n":33}]}'::jsonb, explicacion='A 45 estrellas les quitamos 12 y nos quedan 33.' WHERE enunciado = 'Resuelve la resta: 45 - 12 = ?';
UPDATE preg_punto SET visual='{"q":[{"i":"estrella","n":88},{"i":"mat_resta"},{"i":"estrella","n":30}],"a":[{"i":"estrella","n":88},{"i":"mat_resta"},{"i":"estrella","n":30},{"i":"mat_igual"},{"i":"estrella","n":58}]}'::jsonb, explicacion='A 88 estrellas les quitamos 30 y nos quedan 58.' WHERE enunciado = 'Calcula la diferencia: 88 - 30 = ?';
UPDATE preg_punto SET visual='{"q":[{"i":"estrella","n":75},{"i":"mat_resta"},{"i":"estrella","n":25}],"a":[{"i":"estrella","n":75},{"i":"mat_resta"},{"i":"estrella","n":25},{"i":"mat_igual"},{"i":"estrella","n":50}]}'::jsonb, explicacion='A 75 estrellas les quitamos 25 y nos quedan 50.' WHERE enunciado = '¿Cuánto es 75 - 25?';
UPDATE preg_punto SET visual='{"q":[{"i":"estrella","n":99},{"i":"mat_resta"},{"i":"estrella","n":9}],"a":[{"i":"estrella","n":99},{"i":"mat_resta"},{"i":"estrella","n":9},{"i":"mat_igual"},{"i":"estrella","n":90}]}'::jsonb, explicacion='A 99 estrellas les quitamos 9 y nos quedan 90.' WHERE enunciado = 'Resuelve la operación: 99 - 9 = ?';
UPDATE preg_punto SET visual='{"q":[{"i":"coco","n":100},{"i":"mat_resta"},{"i":"coco","n":40}],"a":[{"i":"coco","n":100},{"i":"mat_resta"},{"i":"coco","n":40},{"i":"mat_igual"},{"i":"coco","n":60}]}'::jsonb, explicacion='A 100 cocos les quitamos 40 y nos quedan 60.' WHERE enunciado = 'Un camión llevaba 100 cocos y entregó 40 en el mercado. ¿Cuántos cocos quedan?';
UPDATE preg_punto SET visual='{"q":[{"i":"mat_regla","n":1}]}'::jsonb WHERE enunciado = 'Medir nos permite saber qué tan largo, alto o pesado es un objeto.';
UPDATE preg_punto SET es_opinion=TRUE WHERE enunciado = '¿Te gustan las secuencias y patrones de números?';
UPDATE preg_punto SET visual='{"q":[{"i":"estrella","n":50},{"i":"mat_suma"},{"i":"estrella","n":50}],"a":[{"i":"estrella","n":50},{"i":"mat_suma"},{"i":"estrella","n":50},{"i":"mat_igual"},{"i":"estrella","n":100}]}'::jsonb, explicacion='Juntamos 50 y 50 estrellas: contamos todos y son 100.' WHERE enunciado = '¡Felicidades! Has completado el curso de 2.°. ¿Cuál es el resultado de 50 + 50?';
UPDATE preg_punto SET visual='{"q":[{"i":"mat_regla","n":1}]}'::jsonb WHERE enunciado = 'Podemos comparar si un objeto es más largo o más corto usando una regla o contando elementos.';
UPDATE preg_punto SET es_opinion=TRUE WHERE enunciado = '¿Has intentado comparar qué objeto es más largo usando la regla?';
UPDATE preg_punto SET visual='{"q":[{"i":"mariposa","n":30},{"i":"mat_suma"},{"i":"mariposa","n":40}],"a":[{"i":"mariposa","n":30},{"i":"mat_suma"},{"i":"mariposa","n":40},{"i":"mat_igual"},{"i":"mariposa","n":70}]}'::jsonb, explicacion='Juntamos 30 y 40 mariposas: contamos todos y son 70.' WHERE enunciado = 'Contaste 30 mariposas por la mañana y 40 mariposas por la tarde. ¿Cuántas mariposas contaste en total?';
COMMIT;
