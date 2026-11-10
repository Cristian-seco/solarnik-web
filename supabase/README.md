# SOLARNIK · sitio web

Sitio estático de SOLARNIK (IN-ELEC SpA): calculadora solar netbilling, guía Luz, asistente de contacto y formulario.

## Archivos
- `index.html`: página principal (calculadora, mapa, guía Luz y formulario de contacto).
- `asistente.html`: asistente de contacto en formato chat.
- `privacidad.html`: política de privacidad.

## Base de datos (Supabase)
- `supabase/schema.sql`: tabla `leads` con RLS (el público solo puede insertar, columna por columna).
- `supabase/leads_boleta_cliente.sql`: columnas opcionales de la boleta (`distribuidora`, `numero_cliente`, `boleta_kwh`, `boleta_monto`) y `consentimiento_numero_cliente`. La base rechaza un número de cliente sin su autorización.
- `supabase/leads_limite.sql`: freno contra envíos masivos (60 por hora en total; el mismo teléfono, una vez cada 10 minutos). No reemplaza a un captcha.
- `supabase/latido_y_hsp.sql`: función `ping()` de solo lectura y tabla `hsp_cache` (RLS forzado, sin acceso público).
- `supabase/hsp_pgnet.sql`: funciones `hsp_iniciar()` y `hsp_resultado()` (solo `service_role`) que consultan al Ministerio con `pg_net` desde la base de datos. La Edge Function no alcanza a api.minenergia.cl; la base de datos sí.
- `supabase/functions/hsp/`: Edge Function que recibe las coordenadas, usa la caché y pide el dato a esas funciones.
- `.github/workflows/latido.yml`: latido diario que evita la pausa del proyecto Supabase gratuito.

## Reglas de seguridad
1. RLS activado en todas las tablas; sin políticas de lectura, modificación ni borrado para el público.
2. En el navegador solo va la clave pública `anon` de Supabase. La clave `service_role` y la API key del Ministerio NUNCA van en este repositorio. La API key del Ministerio vive en Supabase Vault (`minenergia_api_key`).
3. El número de cliente es opcional, con autorización aparte, y no se envía en el aviso de Telegram. No se guardan imágenes de boletas.
4. Antes de lanzar ampliamente: captcha con verificación en servidor y prueba de ataque con las columnas nuevas.

## Publicación
GitHub Pages: Settings → Pages → Branch `main` / root.
