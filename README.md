# SOLARNIK · sitio web

Sitio estático de SOLARNIK (IN-ELEC SpA), con calculadora solar netbilling y formulario de contacto.

- `index.html`: página principal.
- `privacidad.html`: política de privacidad.
- `supabase/schema.sql`: tabla `leads` con RLS (el público solo puede insertar).
- `supabase/latido_y_hsp.sql`: función `ping()` de solo lectura y tabla `hsp_cache` (RLS forzado, sin acceso público).
- `supabase/functions/hsp/`: Edge Function que consulta el Explorador Solar; la API key va en el secreto `MINENERGIA_API_KEY`.
- `.github/workflows/latido.yml`: latido diario que evita la pausa del proyecto Supabase gratuito.

## Reglas de seguridad
1. RLS activado en todas las tablas; sin políticas de lectura, modificación ni borrado para el público.
2. En el navegador solo va la clave pública `anon` de Supabase. La clave `service_role` y la API key del Ministerio NUNCA van en este repositorio: van en funciones de servidor (Supabase Edge Functions, en secretos).
3. Antes de lanzar: prueba de ataque y corrección de hallazgos.

## Publicación
GitHub Pages: Settings → Pages → Branch `main` / root.
