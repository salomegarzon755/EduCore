# EduCore · Implementación HU.15

## Qué incluye
- Seguimiento docente por cada estudiante inscrito en sus grupos.
- El docente puede asignar manualmente uno de los tres estados de acompañamiento y guardar un comentario.
- Estudiante y familia consultan actividades, puntajes y comentarios; no se muestran controles de edición.
- Estado vacío cuando todavía no existen resultados.
- El progreso de `Mis cursos` ahora recibe `id_estudiante` en el endpoint de detalle del curso.

## Migración requerida
Ejecutar una sola vez contra la misma base PostgreSQL usada por el backend:

```bash
psql "$DATABASE_URL" -f backend/db/migracion_seguimiento_hu15.sql
```

En local, usar la conexión de `educore_db` configurada en `backend/.env`.

La migración es aditiva: crea `seguimiento_docente` y sus índices; no elimina ni modifica los resultados históricos.

## Despliegue
1. Respaldar la base de datos.
2. Ejecutar la migración anterior.
3. Desplegar el backend Flask actualizado.
4. Desplegar los archivos HTML, CSS y JS actualizados.
5. Iniciar sesión como docente y guardar un estado/comentario de prueba.
6. Iniciar sesión con el usuario del estudiante y abrir `Mi progreso`; comprobar que se ven los resultados y comentarios.
7. Entrar al espacio familia con las credenciales del estudiante, como lo hace el flujo actual, y comprobar que la vista es de solo lectura.

## Criterios funcionales
- Los estados no se calculan a partir del puntaje. El docente los selecciona explícitamente, para respetar la HU.15: sin porcentajes ni umbrales nuevos.
- El último puntaje se presenta como dato independiente del estado de acompañamiento.
- El resultado se obtiene de `resultado_actividad`; no se duplica ni se reinicia el progreso.
- Los comentarios y estados se guardan por docente, estudiante y grupo.

## Importante antes de producción
El proyecto actual no implementa autenticación de API con sesión/JWT. La ruta de escritura valida que el grupo pertenezca al docente indicado, pero las rutas de lectura todavía reciben el identificador en la URL. Antes de publicar datos reales de menores, debe añadirse autorización en backend (sesión o token firmado) y comprobar el rol/relación familiar desde el servidor. El frontend por sí solo no constituye un control de acceso.

## Verificación realizada
- Compilación sintáctica de los módulos Python (`compileall`).
- Verificación sintáctica de los tres nuevos scripts JavaScript (`node --check`).
- No se ejecutaron consultas reales contra PostgreSQL porque el ZIP no incluye credenciales ni una instancia de la base de datos.
