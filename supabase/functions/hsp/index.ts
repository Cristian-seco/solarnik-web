// SOLARNIK · Edge Function "hsp"
// Intermediaria entre la calculadora y la API de Energías Renovables del Ministerio de Energía.
// La API key vive solo aquí, como secreto MINENERGIA_API_KEY. Nunca llega al navegador.
// Entrada:  POST { "lat": -32.405, "lon": -71.405 }
// Salida:   { "hsp_junio": 3.43, "perfil": [12 valores, HSP por mes], "fuente": "api" | "cache" }
import { createClient } from "jsr:@supabase/supabase-js@2";

const ORIGENES = new Set(["https://cristian-seco.github.io", "https://solarnik.cl", "https://www.solarnik.cl"]);
const TOPE_DIARIO = 300; // consultas nuevas al Ministerio por día (las repetidas salen de la caché)
const API_URL = "https://api.minenergia.cl/api/proxy";

function cors(origen: string | null) {
  const o = origen && ORIGENES.has(origen) ? origen : "https://cristian-seco.github.io";
  return {
    "Access-Control-Allow-Origin": o,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info, x-region",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
}

Deno.serve(async (req) => {
  const origen = req.headers.get("origin");
  const h = cors(origen);
  const out = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: h });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (req.method !== "POST") return out(405, { error: "metodo" });
  if (!origen || !ORIGENES.has(origen)) return out(403, { error: "origen" });

  // Validación estricta de la entrada
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > 200) return out(413, { error: "tamano" });
  let lat: unknown, lon: unknown;
  try {
    const txt = await req.text();
    if (txt.length > 200) return out(413, { error: "tamano" });
    ({ lat, lon } = JSON.parse(txt));
  } catch {
    return out(400, { error: "json" });
  }
  if (typeof lat !== "number" || typeof lon !== "number" || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return out(400, { error: "coordenadas" });
  }
  // Chile continental
  if (lat < -56 || lat > -17.4 || lon < -76 || lon > -66.3) return out(400, { error: "fuera_de_chile" });

  // Se redondea a 0,01° (≈ 1 km): suficiente para la radiación y permite reutilizar consultas
  const la = Math.round(lat * 100) / 100, lo = Math.round(lon * 100) / 100;
  const clave = `${la.toFixed(2)},${lo.toFixed(2)}`;

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data: fila } = await db.from("hsp_cache").select("hsp_junio, perfil").eq("clave", clave).maybeSingle();
  if (fila) return out(200, { hsp_junio: Number(fila.hsp_junio), perfil: fila.perfil.map(Number), fuente: "cache" });

  const key = Deno.env.get("MINENERGIA_API_KEY");
  if (!key) return out(503, { error: "sin_configurar" });

  // Tope diario: protege la cuota asignada por el Ministerio
  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await db.from("hsp_cache").select("clave", { count: "exact", head: true }).gte("created_at", desde);
  if ((count ?? 0) >= TOPE_DIARIO) return out(429, { error: "tope_diario" });

  const consulta = {
    action: { action: "series", interval: "month", stat: "mean", tmy: true },
    period: { start: "2004-01-01", end: "2017-12-31" },
    export: { label: "hsp", format: "json" },
    variables: [{
      id: "glb",
      options: {
        label: "GLB",
        stat: "default",
        // Panel fijo inclinado a la latitud (elev1 = 99), orientado al norte
        receptor: { type: "tilt", azimuth: 0, elev1: 99, hsatmax: 45, optimize: false },
      },
    }],
    position: [{ label: "p", type: "point", lat: la, lon: lo }],
  };

  let d: unknown;
  try {
    const r = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "*/*", "Authorization": "Token " + key },
      body: JSON.stringify(consulta),
      signal: AbortSignal.timeout(25000),
    });
    if (!r.ok) return out(502, { error: "explorador", estado: r.status });
    const j = await r.json();
    d = j?.data?.[0];
  } catch (e) {
    // Sin datos sensibles: solo el tipo de falla y la región donde corrió la función
    return out(504, { error: "explorador_sin_respuesta", tipo: (e as Error)?.name ?? "", region: Deno.env.get("SB_REGION") ?? "" });
  }
  if (!Array.isArray(d) || d.length !== 12 || !d.every((v) => typeof v === "number" && v > 0 && v < 600)) {
    return out(422, { error: "sin_datos" }); // punto sin cobertura (mar, frontera) o respuesta inesperada
  }

  // La API entrega W/m² promedio del mes; HSP = W/m² × 24 h ÷ 1000 W/m²
  const perfil = (d as number[]).map((v) => Math.round(v * 2.4) / 100);
  const hsp_junio = perfil[5];
  await db.from("hsp_cache").upsert({ clave, hsp_junio, perfil });
  return out(200, { hsp_junio, perfil, fuente: "api" });
});
