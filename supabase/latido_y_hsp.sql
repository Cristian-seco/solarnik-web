-- SOLARNIK · 10 de noviembre de 2026
-- 1) Latido: función de solo lectura para el público. No lee ni escribe ninguna tabla.
create or replace function public.ping()
returns text
language sql
stable
security invoker
set search_path = ''
as $$ select 'ok'::text $$;

revoke all on function public.ping() from public, authenticated;
grant execute on function public.ping() to anon;

-- 2) Caché de consultas al Explorador Solar (la usa solo la Edge Function "hsp" con la clave de servicio).
--    RLS activado y forzado, sin políticas ni permisos: el público no puede leer, insertar, modificar ni borrar.
create table if not exists public.hsp_cache (
  clave       text primary key check (clave ~ '^-?[0-9]{1,2}\.[0-9]{2},-?[0-9]{1,2}\.[0-9]{2}$'),
  created_at  timestamptz not null default now(),
  hsp_junio   numeric(4,2) not null check (hsp_junio between 0 and 12),
  perfil      numeric(4,2)[] not null check (array_length(perfil, 1) = 12)
);
alter table public.hsp_cache enable row level security;
alter table public.hsp_cache force row level security;
revoke all on public.hsp_cache from anon, authenticated;
create index if not exists hsp_cache_created_at on public.hsp_cache (created_at);
