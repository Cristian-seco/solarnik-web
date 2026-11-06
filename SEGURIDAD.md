# Informe de prueba de seguridad · 6 de noviembre de 2026

Prueba realizada como visitante anónimo (clave publicable) contra la tabla `public.leads` de Supabase.

| # | Ataque | Resultado inicial | Resultado tras corrección |
|---|---|---|---|
| 1 | Insertar solicitud válida | 201 permitido | 201 permitido (es lo esperado) |
| 2 | Leer todos los contactos (SELECT) | 200 con lista vacía (RLS ocultaba filas, pero existía el permiso) | **401 denegado** |
| 3 | Insertar sin consentimiento | 401 denegado por RLS | 401 denegado |
| 4 | Insertar forzando `id` y `created_at` | 201 permitido (**hallazgo**) | **401 denegado** |
| 5 | Insertar y pedir de vuelta la fila | 401 denegado | 401 denegado |
| 6 | UPDATE masivo (`nombre = 'HACKED'`) | 204, 0 filas alteradas (RLS) | **401 denegado** |
| 7 | DELETE masivo | 204, 0 filas borradas (RLS) | **401 denegado** |
| 8 | Inyección SQL / script en campos | 400 rechazado por restricciones | 400 rechazado |
| 9 | Texto de 5.000 caracteres | 400 rechazado | 400 rechazado |
| 10 | Listar el esquema de la API | 401 (requiere clave secreta) | 401 |

**Causa del hallazgo:** al exponer la tabla en la API de datos, Supabase otorgó todos los privilegios a los roles públicos. El RLS impidió cualquier fuga, pero los permisos sobraban.

**Corrección aplicada:**
```sql
revoke all on public.leads from anon, authenticated;
grant insert (nombre, telefono, region, comuna, techo, consentimiento, kwh_mes, hsp_junio) on public.leads to anon;
```
Hay que volver a ejecutarla cada vez que se cambie la exposición de la tabla en la API de datos.

**Pendientes antes del lanzamiento público:**
- Limitar el envío masivo de formularios (spam): captcha (Cloudflare Turnstile) validado en una Edge Function.
- La futura API key del Ministerio irá como secreto de una Edge Function, nunca en este repositorio.
