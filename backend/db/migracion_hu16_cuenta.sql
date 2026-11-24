BEGIN;
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS nombres_cuenta varchar(100);
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS apellidos_cuenta varchar(100);
-- No se dividen automáticamente los nombres históricos: el usuario confirma la separación.
COMMIT;
