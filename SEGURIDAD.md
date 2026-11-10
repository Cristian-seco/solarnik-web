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

## Actualización · 10 de noviembre de 2026

Se agregaron el latido diario (`public.ping()`), la tabla `hsp_cache` y la Edge Function `hsp`. Prueba como visitante anónimo desde el sitio:

| # | Ataque | Resultado |
|---|---|---|
| 1 | Llamar a `ping()` | 200 `"ok"` (es lo esperado; no toca ninguna tabla) |
| 2 | Leer `hsp_cache` | **401 denegado** |
| 3 | Insertar en `hsp_cache` (envenenar la caché) | **401 denegado** |
| 4 | Borrar `hsp_cache` | **401 denegado** |
| 5 | Leer `leads` | **401 denegado** |
| 6 | `hsp` con coordenadas fuera de Chile | 400 rechazado |
| 7 | `hsp` con texto o SQL en lugar de números | 400 rechazado |
| 8 | `hsp` con cuerpo de 5.000 caracteres | 413 rechazado |
| 9 | `hsp` con método GET | 405 rechazado |

Protecciones de la función `hsp`:
- La API key del Ministerio se lee del secreto `MINENERGIA_API_KEY` (Supabase → Edge Functions → Secrets). No está en este repositorio ni en la página.
- Solo acepta POST desde el sitio (`cristian-seco.github.io`, `solarnik.cl`), con latitud y longitud numéricas dentro de Chile.
- Las consultas se guardan en `hsp_cache` (redondeo a 0,01°) y hay un tope de 300 consultas nuevas al Ministerio por día, para cuidar la cuota.
- La verificación JWT heredada está desactivada porque la página usa la clave publicable; la función valida por su cuenta.
- La cabecera `Origin` puede falsificarse fuera de un navegador: la defensa real contra el abuso es el tope diario y la caché.
