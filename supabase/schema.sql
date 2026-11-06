-- SOLARNIK: tabla de contactos con RLS en todas las acciones
-- Ejecutar en Supabase > SQL Editor

create table if not exists public.leads (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  nombre          text not null check (char_length(nombre) between 2 and 80),
  telefono        text not null check (telefono ~ '^\+?[0-9 ]{8,15}$'),
  region          text check (char_length(region) <= 40),
  comuna          text check (char_length(comuna) <= 60),
  techo           text check (char_length(techo) <= 40),
  consentimiento  boolean not null check (consentimiento = true),
  kwh_mes         integer check (kwh_mes between 0 and 20000),
  hsp_junio       numeric(4,2) check (hsp_junio between 0 and 12)
);

-- RLS activado y forzado (aplica incluso al dueño de la tabla)
alter table public.leads enable row level security;
alter table public.leads force row level security;

-- Sin permisos por defecto para usuarios públicos o autenticados
revoke all on public.leads from anon, authenticated;

-- El público solo puede INSERTAR (no leer, modificar ni borrar)
grant insert (nombre, telefono, region, comuna, techo, consentimiento, kwh_mes, hsp_junio)
  on public.leads to anon;

create policy "leads_insert_publico" on public.leads
  for insert to anon
  with check (consentimiento = true);

-- No se crean políticas de SELECT, UPDATE ni DELETE:
-- con RLS activo, esas acciones quedan denegadas para anon y authenticated.
-- Cristian lee los contactos desde el panel de Supabase (Table Editor).

-- IMPORTANTE: si se cambia la exposición de la tabla en "Data API", Supabase vuelve a
-- otorgar todos los privilegios a anon/authenticated. Re-ejecutar el bloque revoke/grant de arriba.

-- Encuesta anónima de prueba (sin datos personales), solo INSERT para el público
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  logro text not null check (logro in ('si','con_dificultad','no')),
  confuso text check (confuso in ('ubicar','artefactos','resultados','ninguna')),
  visita text not null check (visita in ('si','tal_vez','no')),
  freno text check (freno in ('precio','confianza','tramite','no_necesito','otro')),
  nota smallint not null check (nota between 1 and 7),
  edad text check (edad in ('18-29','30-49','50-69','70+')),
  vivienda text check (vivienda in ('casa_urbana','parcela','departamento','otra')),
  dispositivo text check (dispositivo in ('celular','computador')),
  comentario text check (char_length(comentario) <= 500)
);
alter table public.feedback enable row level security;
alter table public.feedback force row level security;
revoke all on public.feedback from anon, authenticated;
grant insert (logro, confuso, visita, freno, nota, edad, vivienda, dispositivo, comentario) on public.feedback to anon;
create policy "feedback_insert_publico" on public.feedback for insert to anon with check (true);
