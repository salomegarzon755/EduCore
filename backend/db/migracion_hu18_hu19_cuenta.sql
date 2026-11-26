begin;

alter table usuario
add column if not exists activo boolean
not null default true;

alter table usuario
add column if not exists version_sesion integer
not null default 0;

alter table usuario
alter column contrasena type text;

create unique index if not exists uq_usuario_apodo
on usuario (lower(trim(apodo)));

commit;