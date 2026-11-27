#!/usr/bin/env bash
# Crea desde cero una BD LOCAL de pruebas con el esquema reconstruido + todas las migraciones.
# Uso: tests/preparar_bd_pruebas.sh "postgresql://postgres@localhost:5432/educore_test"
# NUNCA apuntar a Neon/producción: el script borra y recrea el esquema public.
set -euo pipefail
URL="${1:?Pasa la URL de una BD local de pruebas}"
cd "$(dirname "$0")/.."
psql "$URL" -q -v ON_ERROR_STOP=1 -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
for f in tests/esquema_base_pruebas.sql db/migracion_hu16_cuenta.sql db/migracion_hu17_avatares.sql \
         db/migracion_hu18_hu19_cuenta.sql db/migracion_actividades.sql db/migracion_hu15_intentos.sql \
         db/migracion_seguimiento_hu15.sql db/migracion_hu23_cursos_admin.sql db/migracion_hu27_pistas.sql \
         db/migracion_hu28_contadores.sql db/migracion_curso_unico_por_estudiante.sql \
         tests/datos_prueba.sql db/migracion_hu32_hu34_progreso.sql db/migracion_hu32_hu34_progreso.sql; do
  echo "-> $f"; psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" > /dev/null
done
echo "BD de pruebas lista."
