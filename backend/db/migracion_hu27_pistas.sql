-- ============================================================
-- EduCore · HU.27 Pistas de ayuda ante errores
-- Migración ADITIVA e idempotente: se puede ejecutar varias veces.
--   psql "$DATABASE_URL" -f backend/db/migracion_hu27_pistas.sql
--
-- Agrega la columna preg_punto.pista: texto que ORIENTA al estudiante cuando
-- responde mal, sin revelar la respuesta (la explicación de HU.14 sí la revela).
-- Si una pregunta no tiene pista, la actividad muestra una pista general.
-- Solo rellena pistas vacías: no sobrescribe pistas que un docente ya haya escrito.
-- ============================================================
BEGIN;

ALTER TABLE preg_punto ADD COLUMN IF NOT EXISTS pista TEXT;

UPDATE preg_punto p SET pista = v.pista
FROM (VALUES
  ('¿Cuál es el símbolo que usamos para sumar?', 'Piensa en el signo que se lee «más». Tiene forma de cruz.'),
  ('¿Qué significa sumar?', 'Cuando sumamos, ¿las cosas se juntan o se quitan?'),
  ('Si sumas 1 + 1, ¿cuál es el resultado?', 'Levanta un dedo, luego otro más, y cuenta todos tus dedos levantados.'),
  ('Si tienes 4 hojas tropicales y encuentras 3 más, ¿cuántas hojas tienes (4 + 3)?', 'Cuenta las 4 hojas y sigue contando las 3 que encuentras: 5, 6…'),
  ('Resuelve la siguiente suma: 5 + 5 = ?', 'Usa los 5 dedos de una mano y los 5 de la otra, y cuéntalos todos.'),
  ('En un árbol hay 6 pajaritos y llegan 2 más. ¿Cuántos pajaritos hay en total?', 'Empieza en 6 y cuenta 2 pajaritos más, uno por uno.'),
  ('¿Cuánto es 8 + 2?', 'Empieza en 8 y avanza 2 pasos contando: 9…'),
  ('Si sumas 7 + 1, ¿cuál es el resultado final?', 'Sumar 1 es decir el número que sigue después del 7.'),
  ('Resuelve la operación: 10 + 4 = ?', 'Parte del 10 y cuenta 4 más: 11, 12…'),
  ('Juntaste 9 estrellas de mar y tu amigo 3. ¿Cuántas tienen entre los dos? (9 + 3)', 'Empieza en 9 y cuenta 3 estrellas más con tus dedos.'),
  ('¿Cuánto es 11 + 5?', 'Parte del 11 y cuenta 5 más, despacio: 12, 13…'),
  ('Si tienes 12 bananos y te regalan 3 más, ¿cuántos bananos sumaste?', 'Empieza en 12 y agrega los 3 bananos que te regalan, uno por uno.'),
  ('¿Qué números al sumarse dan como resultado 10?', 'Prueba cada opción con tus dedos: ¿cuál junta exactamente 10?'),
  ('¿Qué número sigue después del 2?', 'Cuenta en voz alta desde el 1: uno, dos…'),
  ('Si ves 3 pecesitos nadando, ¿cuál es el número tres?', 'Cuenta los pecesitos uno por uno y busca el número que dijiste al final.'),
  ('¿Cuántos Bananos ves?', 'Señala cada banano con tu dedo mientras cuentas, sin saltarte ninguno.'),
  ('Si en la palmera hay 4 cocos y cae 1, ¿cuántos cocos quedan en el árbol?', 'Si un coco se cae, ya no está en la palmera: quita uno de los 4.'),
  ('¿Cuántas mariposas ves volar juntas en el grupo?', 'Toca cada mariposa con el dedo mientras cuentas: una, dos…'),
  ('¿Cuántas nubes ves flotando en el cielo?', 'Cuenta las nubes de izquierda a derecha, una por una.'),
  ('Si tienes 7 piedras y encuentras 1 más, ¿cuántas piedras tienes en total?', 'Encontrar una más es decir el número que sigue después del 7.'),
  ('Una regla tiene forma alargada (rectángulo). ¿Es igual que un cuadrado?', 'Fíjate en sus lados: en un cuadrado todos miden lo mismo. ¿Pasa eso en la regla?'),
  ('Cuenta las esquinas del recuadro de la regla: 1, 2, 3... ¿cuántas son?', 'Pon el dedo en cada esquina y cuenta hasta volver a la primera.'),
  ('Si tienes 2 mangos y te regalan 2 más, ¿cuántos mangos tienes?', 'Junta los 2 mangos con los 2 nuevos y cuéntalos todos.'),
  ('¿Cuál de las opciones representa una cantidad mayor?', 'Cuenta cuántos hay en cada opción: la mayor es la que tiene más.'),
  ('Cuenta las patas de una rana: 1, 2, 3, 4. ¿Cuántas patas son?', 'Sigue el conteo del enunciado: el último número que dices es la respuesta.'),
  ('Observas 6 aves Tuki volando juntas. ¿Cómo se escribe el número seis?', 'Cuenta las aves y busca el número que corresponde a esa cantidad.'),
  ('Si le das 1 piña a cada uno de tus 3 amigos, ¿cuántas piñas usaste?', 'Una piña para cada amigo: cuenta una piña por cada uno de los 3.'),
  ('¿Cuántas frutas ves?', 'Señala cada fruta con el dedo mientras cuentas.'),
  ('¿Cuántas unidades equivalen a 1 Decena?', 'Recuerda: una decena es un grupo de… ¡cuenta tus dedos de las dos manos!'),
  ('El número 50, ¿cuántas decenas tiene?', 'Cuenta de 10 en 10 hasta llegar a 50: 10, 20, 30…'),
  ('Descompón el número 48 en decenas y unidades:', 'El primer dígito dice las decenas y el segundo dice las unidades.'),
  ('¿Qué número se forma con 6 decenas y 3 unidades?', 'Las decenas van primero y las unidades después: escribe primero el 6.'),
  ('¿Cuál es el símbolo de la resta?', 'Es una rayita corta que se lee «menos».'),
  ('¿Cuánto es 10 - 4?', 'Empieza en 10 y cuenta hacia atrás 4 pasos: 9, 8…'),
  ('Resuelve la resta: 45 - 12 = ?', 'Resta primero las decenas (40 − 10) y luego las unidades (5 − 2).'),
  ('Calcula la diferencia: 88 - 30 = ?', 'Restar 30 es quitar 3 decenas: las unidades no cambian.'),
  ('¿Cuánto es 75 - 25?', 'Resta primero las decenas (70 − 20) y luego las unidades (5 − 5).'),
  ('Resuelve la operación: 99 - 9 = ?', 'Quitar 9 a 99 deja las unidades en cero: fíjate solo en las decenas.'),
  ('Un camión llevaba 100 cocos y entregó 40 en el mercado. ¿Cuántos cocos quedan?', 'Entregar es quitar: cuenta hacia atrás de 10 en 10 desde 100, cuatro veces.'),
  ('¡Felicidades! Has completado el curso de 2.°. ¿Cuál es el resultado de 50 + 50?', 'Suma las decenas: 5 decenas más 5 decenas.'),
  ('Contaste 30 mariposas por la mañana y 40 mariposas por la tarde. ¿Cuántas mariposas contaste en total?', 'Junta las decenas: 3 decenas más 4 decenas.')
) AS v(enunciado, pista)
WHERE p.enunciado = v.enunciado AND (p.pista IS NULL OR p.pista = '');

COMMIT;

-- Verificación:
--   SELECT COUNT(*) FILTER (WHERE pista IS NOT NULL) AS con_pista, COUNT(*) AS total FROM preg_punto WHERE opcion_a IS NOT NULL;
