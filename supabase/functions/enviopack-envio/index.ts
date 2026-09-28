// ============================================================
// IKIGAI CLOTHES - enviopack-envio
// Cotiza el envío de un pedido/carrito contra la API de EnvíoPack
// y reemplaza por completo la antigua integración de Zipnova/Zippin.
//
// Requiere los secrets de Supabase:
//   ENVIOPACK_API_KEY
//   ENVIOPACK_SECRET_KEY
//   (opcional) ENVIOPACK_PROVINCIA   -> prov. de destino fija (ISO-3166-2:AR). Si se omite,
//                                       se resuelve automáticamente por código postal.
//
// Configuración forzada:
//   ENVIOPACK_ORIGEN_CP = 3360   -> CP de despacho del local (Oberá, Misiones), siempre este valor.
//   ENVIOPACK_DESPACHO  = S      -> despacho siempre desde sucursal.
//
// Documentación: http://developers.enviopack.com.ar/
//   - Auth:   POST https://api.enviopack.com/auth  (form: api-key, secret-key) -> { token }
//   - Cotiza: GET  https://api.enviopack.com/cotizar/costo
// ============================================================

import { corsHeaders, json } from "../_shared/cors.ts";

const API_BASE = "https://api.enviopack.com";
// CP de despacho del local: forzado a 3360 (Oberá, Misiones) según requisito del negocio.
const ORIGEN_CP = "3360";
// Despacho: S = el vendedor acerca el paquete a una sucursal (forzado).
const DESPACHO = "S";
const TOKEN_TTL_MS = 3.5 * 60 * 60 * 1000; // los tokens expiran a las 4 hs

// Nombre amigable del correo por id (se usa en vez del genérico "Red Envíopack").
// Se toma como referencia la lista pública de correos de EnvíoPack.
const NOMBRE_CORREO: Record<string, string> = {
  enviopack: "EnvíoPack",
  oca: "OCA",
  andreani: "Andreani",
  "correo-argentino": "Correo Argentino",
  "correo argentino": "Correo Argentino",
  ca: "Correo Argentino",
  fastmail: "Fast Mail",
  urbano: "Urbano",
  michetti: "Michetti",
  kdc: "KDC",
  america: "América",
  nubox: "Nubox",
};

function esNombreGenerico(nombre: string): boolean {
  return /red\s*envi[óo]p?pack/i.test(nombre) || /envi[óo]p?pack/i.test(nombre);
}

// Extrae el nombre real del transporte: prioriza el nombre específico que trae la
// API (`correo.nombre` / `carrier.name`) y, si es el genérico "Red Envíopack",
// lo reemplaza por el nombre real del correo según su id.
function nombreRealCorreo(r: Record<string, any>): string {
  const correo = r?.correo ?? {};
  const correoId = String(correo?.id ?? "").trim().toLowerCase();
  const nombre = String(
    correo?.nombre ?? r?.carrier?.name ?? "",
  ).trim();
  const canónico = NOMBRE_CORREO[correoId];
  if (canónico) return canónico;
  if (nombre && !esNombreGenerico(nombre)) return nombre;
  return correoId || nombre || "Transporte";
}

// Paquete por defecto (mismas medidas que la integración anterior: 30 x 20 x 5 cm / 300 g)
const DEF_ALTO_CM = 30;
const DEF_ANCHO_CM = 20;
const DEF_LARGO_CM = 5;
const DEF_PESO_KG = 0.3;

// Nombre legible de cada servicio de EnvíoPack
const NOMBRE_SERVICIO: Record<string, string> = {
  N: "Estándar",
  P: "Prioritario",
  X: "Express",
  R: "Devolución",
};

// Provincias argentinas bajo ISO-3166-2:AR (sin prefijo) -> nombre (solo para la respuesta)
const NOMBRE_PROVINCIA: Record<string, string> = {
  A: "Salta",
  B: "Buenos Aires",
  C: "Ciudad de Buenos Aires",
  D: "San Luis",
  E: "Entre Ríos",
  F: "La Rioja",
  G: "Santiago del Estero",
  H: "Chaco",
  J: "San Juan",
  K: "Catamarca",
  L: "La Pampa",
  M: "Mendoza",
  N: "Misiones",
  P: "Formosa",
  Q: "Neuquén",
  R: "Río Negro",
  S: "Santa Fe",
  T: "Tucumán",
  U: "Chubut",
  V: "Tierra del Fuego",
  W: "Corrientes",
  X: "Córdoba",
  Y: "Jujuy",
  Z: "Santa Cruz",
};

// Candidatas probables por primer dígito del CP (para reducir consultas de validación).
// Nunca es excluyente: ante la duda se validan todas las provincias.
const PROVINCIAS_POR_PRIMER_DIGITO: Record<string, string[]> = {
  "1": ["C", "B"],
  "2": ["B", "E", "S", "W"],
  "3": ["N", "W", "S", "E", "X", "K", "H"],
  "4": ["G", "K", "H", "N", "W", "X", "A", "Y", "T", "F"],
  "5": ["X", "D", "F", "J", "M", "L", "K"],
  "6": ["B", "L", "D", "M", "J", "X", "F", "K"],
  "7": ["B", "L", "M", "J", "C", "D", "X", "K", "F"],
  "8": ["L", "R", "Q", "M", "D", "U", "B", "X", "E"],
  "9": ["U", "Z", "V", "R"],
};
const TODAS_PROVINCIAS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "J",
  "K",
  "L",
  "M",
  "N",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
];

class EnvioPackError extends Error {}

// ------------------------------------------------------------------
// Acceso token (con cache en memoria por instancia)
// ------------------------------------------------------------------
let tokenCache: { token: string; exp: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.exp > Date.now()) return tokenCache.token;

  const apiKey = Deno.env.get("ENVIOPACK_API_KEY") ?? "";
  const secretKey = Deno.env.get("ENVIOPACK_SECRET_KEY") ?? "";
  if (!apiKey || !secretKey) {
    throw new EnvioPackError(
      "Faltan ENVIOPACK_API_KEY / ENVIOPACK_SECRET_KEY en los secrets de la función.",
    );
  }

  const res = await fetch(`${API_BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ "api-key": apiKey, "secret-key": secretKey }),
    signal: AbortSignal.timeout(15_000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new EnvioPackError(
      leerMensajeEnvioPack(
        data,
        `Error de autenticación con EnvíoPack (${res.status}).`,
      ),
    );
  }

  const token = data?.token ?? data?.access_token;
  if (typeof token !== "string" || token === "") {
    throw new EnvioPackError("EnvíoPack no devolvió un access_token válido.");
  }

  tokenCache = { token, exp: Date.now() + TOKEN_TTL_MS };
  return token;
}

// ------------------------------------------------------------------
// Resolución de provincia destino a partir del código postal
// EnvíoPack exige `provincia` (ISO-3166-2:AR) en /cotizar/costo, pero el
// checkout solo manda el CP. Se valida con GET /provincias/{id}/validar-codigo-postal.
// ------------------------------------------------------------------
let provinciaCache: { cp: string; provincia: string; ts: number } | null = null;

async function validarProvincia(
  token: string,
  provincia: string,
  cp: string,
): Promise<boolean> {
  try {
    const url =
      `${API_BASE}/provincias/${provincia}/validar-codigo-postal?access_token=${
        encodeURIComponent(token)
      }&codigo_postal=${encodeURIComponent(cp)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    const data = await res.json().catch(() => ({}));
    return res.ok && data?.valido === true;
  } catch {
    return false;
  }
}

async function resolverProvincia(
  token: string,
  cp: string,
): Promise<string | null> {
  if (
    provinciaCache && provinciaCache.cp === cp &&
    provinciaCache.ts > Date.now() - 24 * 60 * 60 * 1000
  ) {
    return provinciaCache.provincia;
  }

  // 1º las candidatas probables por primer dígito, 2º el resto (por las dudas)
  const numeros = new Set<string>([
    ...(PROVINCIAS_POR_PRIMER_DIGITO[cp[0]] ?? []),
    ...TODAS_PROVINCIAS,
  ]);

  const resultados = await Promise.all(
    [...numeros].map(async (
      prov,
    ) => ((await validarProvincia(token, prov, cp)) ? prov : null)),
  );
  const encontrada = resultados.find((p): p is string => p !== null) ?? null;

  if (encontrada) {
    provinciaCache = { cp, provincia: encontrada, ts: Date.now() };
  }
  return encontrada;
}

// ------------------------------------------------------------------
// Formateo uniforme de cada opción de envío
// ------------------------------------------------------------------
function diasDesdeHoras(horas: number): number {
  const dias = Math.round(Number(horas) / 24);
  return Number.isFinite(dias) && dias > 0 ? dias : 1;
}

function formatoDias(dias: number): string {
  return `${dias} ${dias === 1 ? "día" : "días"} hábiles`;
}

function hacerOpcion(r: Record<string, any>): Record<string, any> | null {
  const correo = r?.correo ?? {};
  const correoId = String(correo?.id ?? "");
  const nombreCarrier = nombreRealCorreo(r);
  const costo = Number(r?.valor);
  if (!Number.isFinite(costo)) return null;

  const servicio = String(r?.servicio ?? "N").toUpperCase();
  const modalidad = String(r?.modalidad ?? "D").toUpperCase();
  const despacho = String(r?.despacho ?? "D").toUpperCase();
  const horas = Number(r?.horas_entrega) || 0;
  const dias = diasDesdeHoras(horas);
  const leyenda = formatoDias(dias);

  return {
    // --- Campos uniformes (requisito del frontend) ---
    id_servicio: `${correoId}:${servicio}`,
    correo_id: correoId || null,
    carrier: {
      id: null,
      name: nombreCarrier,
      rating: null,
      logo: null,
    },
    service_type: {
      code: servicio || null,
      name: NOMBRE_SERVICIO[servicio] ?? servicio,
    },
    costo,
    tiempo_estimado: leyenda,

    // --- Detalle adicional / compatibilidad con la UI actual ---
    modalidad,
    despacho,
    horas_entrega: horas,
    cumplimiento: r?.cumplimiento ?? null,
    anomalos: r?.anomalos ?? null,
    logistic_type: modalidad === "S" ? "carrier_dropoff" : "carrier_pickup",
    estimado: {
      minimo_dias: dias,
      maximo_dias: dias,
      estimado: null,
      leyenda,
    },
    tags: [],
    selectable: true,
  };
}

// Opciones de prueba (mock) si la API falla, para no cortar el flujo de compra
function opcionesMock(cp: string) {
  const base = [
    {
      correo: { id: "andreani", nombre: "Andreani / Correo Argentino" },
      servicio: "N",
      modalidad: "D",
      valor: 4500,
      horas_entrega: 96,
    },
    {
      correo: { id: "oca", nombre: "Sucursal" },
      servicio: "X",
      modalidad: "S",
      valor: 3200,
      horas_entrega: 60,
    },
    {
      correo: { id: "local", nombre: "Retiro en Local / Punto de Encuentro" },
      servicio: "N",
      modalidad: "D",
      valor: 0,
      horas_entrega: 0,
    },
  ];
  const opciones = base.map(hacerOpcion).filter((o): o is Record<string, any> =>
    Boolean(o)
  );
  return opciones.map((o) => ({
    ...o,
    mock: true,
    codigo_postal: cp,
    costo: o.costo,
  }));
}

function leerMensajeEnvioPack(data: any, fallback: string): string {
  if (typeof data?.message === "string" && data.message) return data.message;
  if (typeof data?.errors?.global?.[0] === "string") {
    return data.errors.global[0];
  }
  return fallback;
}

// ------------------------------------------------------------------
// Handler
// ------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ENVIOPACK_API_KEY");
    const secretKey = Deno.env.get("ENVIOPACK_SECRET_KEY");

    // Body del checkout: { postal_code, weight, height, width, length }
    const body = await req.json().catch(() => ({}));
    const {
      postal_code,
      weight,
      height,
      width,
      length,
      bultos,
      provincia: provinciaOverride,
    } = body as {
      postal_code?: string | number;
      weight?: number | string;
      height?: number | string;
      width?: number | string;
      length?: number | string;
      bultos?: number | string;
      provincia?: string;
    };

    const cpDestino = String(postal_code ?? "").trim().replace(/\D/g, "");
    if (!cpDestino || cpDestino.length < 4) {
      return json({
        error: "Ingresá un código postal válido para calcular el envío.",
      }, { status: 400 });
    }

    // Peso y dimensiones del paquete (clamp básico). Peso en kg.
    const pesoKg = Math.max(0.05, Number(weight) || DEF_PESO_KG);
    const alto = Math.max(1, Math.round(Number(height) || DEF_ALTO_CM));
    const ancho = Math.max(1, Math.round(Number(width) || DEF_ANCHO_CM));
    const largo = Math.max(1, Math.round(Number(length) || DEF_LARGO_CM));
    const paquete = `${alto}x${ancho}x${largo}`;
    const cantidadBultos = Math.max(1, Math.round(Number(bultos) || 1));
    // paquetes admite varios bultos separados por coma: 30x20x5,30x20x5
    const paquetesParam = Array.from({ length: cantidadBultos }, () => paquete)
      .join(",");

    if (!apiKey || !secretKey) {
      console.warn(
        "enviopack-envio: faltan ENVIOPACK_API_KEY / ENVIOPACK_SECRET_KEY, usando opciones mock",
      );
      return json({
        codigo_postal: cpDestino,
        origen_cp: ORIGEN_CP,
        provincia: null,
        destino: null,
        paquetes: paquetesParam,
        peso: pesoKg,
        opciones: opcionesMock(cpDestino),
        mock: true,
      });
    }

    const token = await getAccessToken();

    // Resolución de provincia destino (o override)
    const provincia = (String(provinciaOverride ?? "").trim().toUpperCase() ||
      Deno.env.get("ENVIOPACK_PROVINCIA") || "").toUpperCase() ||
      (await resolverProvincia(token, cpDestino)) ||
      "";

    // Configuración forzada del local: el despacho sale SIEMPRE desde la sucursal 3360 (Oberá).
    const origenCp = ORIGEN_CP;
    const despacho = DESPACHO;
    const modalidad = "D"; // envío a domicilio (el checkout envía dirección + CP)

    // Consulta a la cotización de EnvíoPack. `codigo_postal` = CP del destino.
    async function cotizar(
      prov: string,
    ): Promise<{ ok: boolean; status: number; data: any }> {
      const params = new URLSearchParams({
        access_token: token,
        codigo_postal: cpDestino,
        origen_cp: origenCp,
        peso: pesoKg.toFixed(2),
        paquetes: paquetesParam,
        modalidad,
        despacho,
        orden_columna: "valor",
        orden_sentido: "asc",
      });
      if (prov) params.set("provincia", prov);

      const res = await fetch(
        `${API_BASE}/cotizar/costo?${params.toString()}`,
        {
          signal: AbortSignal.timeout(20_000),
        },
      );
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok && Array.isArray(data), status: res.status, data };
    }

    let cotizacion = await cotizar(provincia);
    // Si falló con provincia, se reintenta sin ella (EnvíoPack cotiza "siempre por código postal")
    if (!cotizacion.ok && provincia) {
      console.warn(
        `enviopack-envio: cotización con provincia ${
          provincia || "-"
        } falló (${cotizacion.status}), reintento sin provincia`,
      );
      cotizacion = await cotizar("");
    }

    if (!cotizacion.ok) {
      console.error(
        "enviopack-envio: error de cotización:",
        cotizacion.status,
        JSON.stringify(cotizacion.data),
      );
      return json({
        codigo_postal: cpDestino,
        origen_cp: origenCp,
        provincia: provincia || null,
        destino: provincia
          ? { city: null, state: NOMBRE_PROVINCIA[provincia] ?? null }
          : null,
        paquetes: paquetesParam,
        peso: pesoKg,
        opciones: opcionesMock(cpDestino),
        mock: true,
      });
    }

    const resultados = (cotizacion.data as Record<string, any>[])
      .map(hacerOpcion)
      .filter((o): o is Record<string, any> => o !== null);

    // Dedupe por id_servicio + modalidad + despacho (mantiene la más barata)
    const vistos = new Set<string>();
    const opciones = resultados
      .sort((a, b) => a.costo - b.costo)
      .filter((o) => {
        const key = `${o.id_servicio}|${o.modalidad}|${o.despacho}`;
        if (vistos.has(key)) return false;
        vistos.add(key);
        return true;
      });

    if (opciones.length === 0) {
      console.warn(
        "enviopack-envio: sin opciones reales, usando opciones mock",
      );
      return json({
        codigo_postal: cpDestino,
        origen_cp: origenCp,
        provincia: provincia || null,
        destino: provincia
          ? { city: null, state: NOMBRE_PROVINCIA[provincia] ?? null }
          : null,
        paquetes: paquetesParam,
        peso: pesoKg,
        opciones: opcionesMock(cpDestino),
        mock: true,
      });
    }

    return json({
      codigo_postal: cpDestino,
      origen_cp: origenCp,
      provincia: provincia || null,
      destino: provincia
        ? { city: null, state: NOMBRE_PROVINCIA[provincia] ?? null }
        : null,
      paquetes: paquetesParam,
      peso: pesoKg,
      opciones,
      mock: false,
    });
  } catch (err) {
    console.error("enviopack-envio error:", err);
    const mensaje = err instanceof EnvioPackError
      ? err.message
      : "No se pudo calcular el envío.";
    const cp = String((await req.json().catch(() => ({})))?.postal_code ?? "")
      .trim().replace(/\D/g, "");
    return json(
      {
        error: mensaje,
        codigo_postal: cp,
        origen_cp: ORIGEN_CP,
        provincia: null,
        destino: null,
        paquetes: [],
        peso: null,
        opciones: cp ? opcionesMock(cp) : [],
        mock: true,
      },
      cp ? { status: 200 } : { status: 400 },
    );
  }
});
