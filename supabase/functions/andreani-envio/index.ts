// ============================================================
// IKIGAI CLOTHES - andreani-envio
// Cotiza el envío de un pedido/carrito contra la API de Andreani
// (PYME) https://apis.andreani.com y devuelve las opciones en el
// mismo formato uniforme que usa el frontend (enviopack-envio).
//
// Requiere los secrets de Supabase:
//   ANDREANI_USER                -> usuario de la API de Andreani
//   ANDREANI_PASSWORD            -> password de la API de Andreani
//   ANDREANI_CONTRATO            -> número de contrato con Andreani.
//                                   Por requisito del negocio se usa el
//                                   DNI/CUIT registrado (46717557).
//   ANDREANI_CONTRATO_FALLBACK   -> (opcional) contrato alternativo que se
//                                   prueba automáticamente si la API rechaza
//                                   el principal como "contrato inválido".
//   ANDREANI_CLIENTE             -> (opcional) código de cliente que Andreani
//                                   pide en `cliente` del endpoint v1/tarifas.
//   ANDREANI_API_BASE            -> (opcional) base URL; default apis.andreani.com.
//                                   Usar https://apisqa.andreani.com para QA.
//
// Documentación:
//   - Login:      POST /v2/login  { usuario, password } -> { token }
//   - Cotización: GET  /v1/tarifas?cpDestino=&contrato=&bultos[0][...]
// ============================================================

import { corsHeaders, json } from '../_shared/cors.ts'

const API_BASE_DEF = 'https://apis.andreani.com'
// Número de contrato por defecto: DNI/CUIT registrado en la cuenta PYME.
// Se puede sobreescribir con el secret ANDREANI_CONTRATO.
const CONTRATO_DEFECTO = '46717557'

// Paquete por defecto por unidad (mismas medidas que las demás integraciones)
const DEF_ALTO_CM = 30
const DEF_ANCHO_CM = 20
const DEF_LARGO_CM = 5
const DEF_PESO_KG = 0.3

class AndreaniError extends Error {}

// ------------------------------------------------------------------
// Autenticación: se intenta el login moderno (POST /v2/login) y, si
// falla, el clásico (GET /login con Basic Auth). El token dura 24 hs.
// ------------------------------------------------------------------
let tokenCache: { token: string; exp: number } | null = null

function leerToken(data: any): string | null {
  const token = data?.token ?? data?.access_token ?? data?.Token
  return typeof token === 'string' && token ? token : null
}

async function getToken(apiBase: string): Promise<string> {
  if (tokenCache && tokenCache.exp > Date.now()) return tokenCache.token

  const user = Deno.env.get('ANDREANI_USER') ?? ''
  const password = Deno.env.get('ANDREANI_PASSWORD') ?? ''
  if (!user || !password) {
    throw new AndreaniError('Faltan ANDREANI_USER / ANDREANI_PASSWORD en los secrets de la función.')
  }

  const credencialesRechazadas = () =>
    new AndreaniError('Credenciales de Andreani rechazadas (revisá ANDREANI_USER / ANDREANI_PASSWORD).')

  // 1º) Login JSON moderno (v2)
  let v2Status = 0
  try {
    const res = await fetch(`${apiBase}/v2/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ usuario: user, password }),
      signal: AbortSignal.timeout(15_000),
    })
    v2Status = res.status
    const data = await res.json().catch(() => ({}))
    const token = leerToken(data)
    if (res.ok && token) {
      tokenCache = { token, exp: Date.now() + 23 * 60 * 60 * 1000 }
      return token
    }
    console.warn(`andreani-envio: login v2 respondió ${res.status}`, JSON.stringify(data))
  } catch (err) {
    console.warn('andreani-envio: login v2 falló, intentando GET /login con Basic Auth', err)
  }

  // 2º) Login clásico (Basic Auth, token en el header x-authorization-token).
  // Se intenta igual (incluso si v2 dio 401) porque algunas cuentas PYME solo
  // están habilitadas en el endpoint clásico.
  const res = await fetch(`${apiBase}/login`, {
    headers: {
      Authorization: `Basic ${btoa(`${user}:${password}`)}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
  })
  const data = await res.json().catch(() => ({}))
  // fetch normaliza los headers a minúsculas
  const token = leerToken(data) ?? (res.headers.get('x-authorization-token') || null)
  if (res.ok && token) {
    tokenCache = { token, exp: Date.now() + 23 * 60 * 60 * 1000 }
    return token
  }

  if (v2Status === 401 || v2Status === 403 || res.status === 401 || res.status === 403) {
    throw credencialesRechazadas()
  }
  console.warn('andreani-envio: login clásico respondió', res.status, JSON.stringify(data))
  throw new AndreaniError('No se pudo autenticar contra la API de Andreani.')
}

// ------------------------------------------------------------------
// Detección de "contrato inválido" en la respuesta de la cotización.
// Andreani no devuelve un código de error único, por eso se busca la
// palabra "contrato" (sin importar mayúsculas) en el mensaje y se
// consideran los status 4xx que habitualmente acompañan este error.
// ------------------------------------------------------------------
function esErrorContratoInvalido(status: number, data: any): boolean {
  if (status === 401 || status === 403) return false // es tema de token/credenciales
  const fragmentos = [
    data?.mensaje,
    data?.message,
    data?.error,
    data?.errors?.global?.[0],
    data?.detalle,
    data?.details,
    data?.descripcion,
  ]
  const texto = fragmentos
    .filter((f): f is string => typeof f === 'string')
    .join(' ')
  if (/contrato/i.test(texto)) return true
  // Status que casi siempre acompañan "contrato inválido" en esta API
  return [400, 404, 422].includes(status)
}

// ------------------------------------------------------------------
// Cotización contra GET /v1/tarifas
// El cuerpo de la cotización viaja en query params. En `contrato` se
// envía el DNI/CUIT registrado (ANDREANI_CONTRATO).
// ------------------------------------------------------------------
interface BultoCotizacion {
  altoCm: number
  anchoCm: number
  largoCm: number
  volumen: number
  kilos: number
  valorDeclarado: number
}

async function cotizarConContrato(
  apiBase: string,
  token: string,
  cpDestino: string,
  contrato: string,
  cliente: string | null,
  bultos: BultoCotizacion[],
): Promise<{ ok: boolean; status: number; data: any }> {
  const params = new URLSearchParams({
    cpDestino,
    contrato,
  })
  if (cliente) params.set('cliente', cliente)
  bultos.forEach((b, i) => {
    const p = `bultos[${i}]`
    params.set(`${p}[altoCm]`, String(b.altoCm))
    params.set(`${p}[anchoCm]`, String(b.anchoCm))
    params.set(`${p}[largoCm]`, String(b.largoCm))
    params.set(`${p}[volumen]`, String(b.volumen))
    params.set(`${p}[kilos]`, String(b.kilos))
    if (b.valorDeclarado > 0) params.set(`${p}[valorDeclarado]`, String(b.valorDeclarado))
  })

  const res = await fetch(`${apiBase}/v1/tarifas?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'x-authorization-token': token,
    },
    signal: AbortSignal.timeout(20_000),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

// ------------------------------------------------------------------
// Extracción de costo desde cualquier variante de la respuesta
// ------------------------------------------------------------------
function costoDeTarifa(r: Record<string, any>): number | null {
  const candidatos = [
    r.tarifaConIva?.total,
    r.tarifaConIva?.distribucion,
    r.precio,
    r.valor,
    r.costo,
    r.tarifa?.total,
    r.tarifaSinIva?.total,
  ]
  for (const c of candidatos) {
    const n = Number(c)
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

function diasDesde(data: any): number | null {
  const d = Number(data?.plazoEntregaDias ?? data?.plazoEntrega ?? data?.plazo_entrega)
  return Number.isFinite(d) && d > 0 ? Math.round(d) : null
}

function leyendaDias(dias: number | null): string {
  if (!dias) return ''
  return `${dias} ${dias === 1 ? 'día' : 'días'} hábiles`
}

// Normaliza cada tarifa devuelta por Andreani al formato del frontend
function hacerOpcion(raw: Record<string, any>, cp: string): Record<string, any> | null {
  const costo = costoDeTarifa(raw)
  if (!costo) return null
  const descripcion = String(raw?.descripcionServicio ?? raw?.codigoServicio ?? '')
  const aDomicilio = /(domicilio|domic)/i.test(descripcion)
  const servicio = descripcion.replace(/Andreani\s*/i, '').trim() ||
    (aDomicilio ? 'Estándar a Domicilio' : 'Andreani')
  const dias = diasDesde(raw)
  const modalidad = aDomicilio ? 'D' : 'S'
  const leyenda = leyendaDias(dias)

  return {
    id_servicio: `andreani:${servicio}`,
    correo_id: 'andreani',
    carrier: { id: null, name: 'Andreani', rating: null, logo: null },
    service_type: { code: String(raw?.codigoServicio ?? null), name: servicio },
    costo,
    tiempo_estimado: leyenda || null,
    modalidad,
    despacho: 'S',
    horas_entrega: dias ? dias * 24 : null,
    cumplimiento: null,
    anomalos: null,
    logistic_type: aDomicilio ? 'carrier_pickup' : 'carrier_dropoff',
    estimado: {
      minimo_dias: dias,
      maximo_dias: dias,
      estimado: null,
      leyenda,
    },
    tags: [],
    selectable: true,
    codigo_postal: cp,
  }
}

// Respuesta de respaldo (mock) para no cortar el flujo de compra si la
// API falla o el contrato todavía no está confirmado por soporte de Andreani.
function opcionesMock(cp: string) {
  return [
    {
      id_servicio: 'andreani:standard_domicilio',
      correo_id: 'andreani',
      carrier: { id: null, name: 'Andreani', rating: null, logo: null },
      service_type: { code: 'standard_domicilio', name: 'Estándar a Domicilio' },
      costo: 4500,
      tiempo_estimado: '3 a 5 días hábiles',
      modalidad: 'D',
      despacho: 'S',
      horas_entrega: 96,
      cumplimiento: null,
      anomalos: null,
      logistic_type: 'carrier_pickup',
      estimado: { minimo_dias: 3, maximo_dias: 5, estimado: null, leyenda: '3 a 5 días hábiles' },
      tags: [],
      selectable: true,
      codigo_postal: cp,
      mock: true,
    },
    {
      id_servicio: 'andreani:express_sucursal',
      correo_id: 'andreani',
      carrier: { id: null, name: 'Andreani', rating: null, logo: null },
      service_type: { code: 'express_sucursal', name: 'Exprés a Sucursal' },
      costo: 3200,
      tiempo_estimado: '2 a 3 días hábiles',
      modalidad: 'S',
      despacho: 'S',
      horas_entrega: 60,
      cumplimiento: null,
      anomalos: null,
      logistic_type: 'carrier_dropoff',
      estimado: { minimo_dias: 2, maximo_dias: 3, estimado: null, leyenda: '2 a 3 días hábiles' },
      tags: [],
      selectable: true,
      codigo_postal: cp,
      mock: true,
    },
    {
      id_servicio: 'andreani:retiro_local',
      correo_id: 'andreani',
      carrier: { id: null, name: 'Retiro en Local / Punto de Encuentro', rating: null, logo: null },
      service_type: { code: 'pickup', name: 'Retiro en Local' },
      costo: 0,
      tiempo_estimado: 'Gratis',
      modalidad: 'D',
      despacho: 'S',
      horas_entrega: 0,
      cumplimiento: null,
      anomalos: null,
      logistic_type: 'pickup_point',
      estimado: { minimo_dias: 0, maximo_dias: 0, estimado: null, leyenda: 'Gratis' },
      tags: ['cheapest'],
      selectable: true,
      codigo_postal: cp,
      mock: true,
    },
  ]
}

// ------------------------------------------------------------------
// Handler
// ------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const apiBase = (Deno.env.get('ANDREANI_API_BASE') || API_BASE_DEF).replace(/\/+$/, '')
    const contratoPrimario = (Deno.env.get('ANDREANI_CONTRATO') || CONTRATO_DEFECTO).trim()
    const contratoFallback = (Deno.env.get('ANDREANI_CONTRATO_FALLBACK') || '').trim()
    const cliente = (Deno.env.get('ANDREANI_CLIENTE') || '').trim()

    const body = await req.json().catch(() => ({}))
    const {
      postal_code,
      cp_destino,
      weight,
      height,
      width,
      length,
      bultos,
      valor_declarado,
    } = body as {
      postal_code?: string | number
      cp_destino?: string | number
      weight?: number | string
      height?: number | string
      width?: number | string
      length?: number | string
      bultos?: number | string
      valor_declarado?: number | string
    }

    const cpDestino = String(postal_code ?? cp_destino ?? '').trim().replace(/\D/g, '')
    if (!cpDestino || cpDestino.length < 4) {
      return json({ error: 'Ingresá un código postal válido para calcular el envío.' }, { status: 400 })
    }

    const pesoTotalKg = Math.max(0.05, Number(weight) || DEF_PESO_KG)
    const cantidadBultos = Math.max(1, Math.round(Number(bultos) || 1))
    const alto = Math.max(1, Math.round(Number(height) || DEF_ALTO_CM))
    const ancho = Math.max(1, Math.round(Number(width) || DEF_ANCHO_CM))
    const largo = Math.max(1, Math.round(Number(length) || DEF_LARGO_CM))
    const valorDeclarado = Math.max(0, Number(valor_declarado) || 0)
    const pesoBulto = Number((pesoTotalKg / cantidadBultos).toFixed(3))

    const paquete = `${alto}x${ancho}x${largo}`
    const paquetesParam = Array.from({ length: cantidadBultos }, () => paquete).join(',')
    const bultosQuery: BultoCotizacion[] = Array.from({ length: cantidadBultos }, () => ({
      altoCm: alto,
      anchoCm: ancho,
      largoCm: largo,
      volumen: alto * ancho * largo,
      kilos: pesoBulto,
      valorDeclarado,
    }))

    // Credenciales incompletas: no cortamos el flujo, devolvemos mock
    if (!Deno.env.get('ANDREANI_USER') || !Deno.env.get('ANDREANI_PASSWORD')) {
      console.warn('andreani-envio: faltan ANDREANI_USER / ANDREANI_PASSWORD, usando opciones mock')
      return json({
        codigo_postal: cpDestino,
        origen_cp: null,
        provincia: null,
        destino: null,
        paquetes: paquetesParam,
        peso: pesoTotalKg,
        opciones: opcionesMock(cpDestino),
        mock: true,
      })
    }

    const token = await getToken(apiBase)

    // Contrato principal (DNI/CUIT) y fallback automático si la API dice
    // "contrato inválido". Mientras soporte confirma el código exacto, ante
    // ese error respondemos con opciones mock en lugar de cortar la compra.
    const candidatos = [contratoPrimario, contratoFallback].filter(
      (c, i, arr) => c && arr.indexOf(c) === i,
    )
    if (candidatos.length === 0) {
      throw new AndreaniError('Falta ANDREANI_CONTRATO en los secrets de la función.')
    }

    let cotizacion: { ok: boolean; status: number; data: any } | null = null
    let contratoUsado = candidatos[0]
    let ultimoErrorContrato = false

    for (const contrato of candidatos) {
      contratoUsado = contrato
      cotizacion = await cotizarConContrato(apiBase, token, cpDestino, contrato, cliente, bultosQuery)
      if (cotizacion.ok) break
      ultimoErrorContrato = esErrorContratoInvalido(cotizacion.status, cotizacion.data)
      if (!ultimoErrorContrato) break
      console.warn(
        `andreani-envio: contrato ${contrato} inválido (${cotizacion.status}), probando siguiente`,
        JSON.stringify(cotizacion.data),
      )
    }

    if (!cotizacion || !cotizacion.ok) {
      const contratoRechazado = ultimoErrorContrato
      console.error(
        'andreani-envio: error de cotización:',
        cotizacion?.status,
        JSON.stringify(cotizacion?.data ?? {}),
      )
      return json({
        codigo_postal: cpDestino,
        origen_cp: null,
        provincia: null,
        destino: null,
        paquetes: paquetesParam,
        peso: pesoTotalKg,
        contrato: contratoUsado,
        ...(contratoRechazado
          ? {
              error:
                'Contrato de Andreani pendiente de confirmación. Se muestra una cotización de referencia.',
            }
          : {}),
        opciones: opcionesMock(cpDestino),
        mock: true,
      })
    }

    // Normalización de la respuesta a opciones uniformes. Andreani puede
    // devolver un objeto único ({ tarifaConIva }) o un array de servicios.
    const data = cotizacion.data
    const servicios = Array.isArray(data)
      ? data
      : Array.isArray(data?.servicios)
      ? data.servicios
      : [data]

    const opciones = servicios
      .map((r: Record<string, any>) => hacerOpcion(r, cpDestino))
      .filter((o): o is Record<string, any> => o !== null)
      // La tarifa única (sin descripcionServicio) y los duplicados se deduplican
      .sort((a, b) => a.costo - b.costo)
      .filter((o, i, arr) => arr.findIndex((x) => x.id_servicio === o.id_servicio) === i)

    if (opciones.length === 0) {
      console.warn('andreani-envio: sin opciones reales, usando opciones mock')
      return json({
        codigo_postal: cpDestino,
        origen_cp: null,
        provincia: null,
        destino: null,
        paquetes: paquetesParam,
        peso: pesoTotalKg,
        contrato: contratoUsado,
        opciones: opcionesMock(cpDestino),
        mock: true,
      })
    }

    return json({
      codigo_postal: cpDestino,
      origen_cp: null,
      provincia: null,
      destino: null,
      paquetes: paquetesParam,
      peso: pesoTotalKg,
      contrato: contratoUsado,
      opciones,
      mock: false,
    })
  } catch (err) {
    console.error('andreani-envio error:', err)
    const mensaje = err instanceof AndreaniError
      ? err.message
      : 'No se pudo calcular el envío.'
    const cp = String((await req.json().catch(() => ({})))?.postal_code ?? '')
      .trim().replace(/\D/g, '')
    return json(
      {
        error: mensaje,
        codigo_postal: cp,
        origen_cp: null,
        provincia: null,
        destino: null,
        paquetes: [],
        peso: null,
        opciones: cp ? opcionesMock(cp) : [],
        mock: true,
      },
      cp ? { status: 200 } : { status: 400 },
    )
  }
})