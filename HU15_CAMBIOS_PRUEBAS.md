# HU.15 - Mejor intento e historial

## Instalación en pruebas
1. Crear rama `hu15-pruebas` en Neon y conectar el `.env` LOCAL (no incluido).
2. Ejecutar en SQL Editor de esa rama `backend/db/migracion_hu15_intentos.sql`.
3. Reiniciar Flask y servir el frontend localmente.
4. Verificar: estudiante repite una actividad con nota menor, se conserva el mejor resultado y aparecen ambos intentos; docente escribe comentario por actividad; estudiante y familia ven el comentario; contador docente actualizado.

## Datos históricos
`resultado_actividad` contiene solamente el último resumen previamente guardado. La migración importa esa fila como intento conocido; no inventa calificaciones previas. `historial_parcial` indica registros anteriores no recuperables.

## Seguridad pendiente antes de producción
La API existente usa IDs del cliente sin sesiones ni tokens. Las rutas de seguimiento siguen este patrón y NO deben desplegarse públicamente con datos reales de menores sin autenticación/autorización en el servidor. La vista familiar debe validar relación padre-hijo mediante sesión; el frontend actual usa el ID guardado localmente y no es autorización suficiente.

## Nota
No se ha probado contra Neon ni Render. La migración no se ejecutó automáticamente. El ZIP excluye `.env` y archivos de caché.
