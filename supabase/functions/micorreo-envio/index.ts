// ============================================================
// IKIGAI CLOTHES - micorreo-envio
// Integración con la API MiCorreo de Correo Argentino
// (https://api.correoargentino.com.ar/micorreo/v1).
//
// Acciones (campo `action` del body; en GET va como query param):
//   - "rates"            -> POST /rates            cotización de envíos
//   - "shipping/import"  -> POST /shipping/import   alta de un envío en MiCorreo
//   - "shipping/tracking"-> GET  /shipping/tracking seguimiento por shippingId
//
// Requiere los secrets de Supabase (server-side, SIN prefijo VITE_):
//   CORREO_ARGENTINO_USER        -> usuario HTTP Basic Auth
//   CORREO_ARGENTINO_PASS        -> contraseña HTTP Basic Auth
//   CORREO_ARGENTINO_CUSTOMER_ID -> customerId de MiCorreo (default si el body no lo trae)
//   CORREO_ARGENTINO_CP_ORIGEN   -> (opcional) CP de despacho. Default 3360 (Oberá, Misiones)
//
// Documentación oficial: https://www.correoargentino.com.ar/MiCorreo/public/img/pag/apiMiCorreo.pdf
//   - Auth:   POST /token   (HTTP Basic)  -> { token, expires }
//   - Tarifas: POST /rates  (Bearer)      -> { rates: [{ deliveredType, productType, productName, price }] }
//   - Envíos:  POST /shipping/import      -> { createdAt }
//   - Seguimiento: GET /shipping/tracking?shippingId=...
// ============================================================

import { corsHeaders, json } from '../_shared/cors.ts'

const API_BASE = 'https://api.correoargentino.com.ar/micorreo/v1'

// Cache del JWT entre invocaciones: Deno KV (persiste entre cold starts) con
// fallback a memoria si el runtime local no expone KV.
const KV_KEY = 'micorreo/token'
const MARGEN_RENOVACION_MS = 60_000 // se renueva 1 min antes de vencer
const TTL_TOKEN_FALLBACK_MS = 2 * 60 * 60 * 1000 // si la API no informa expiración

// CP de despacho del local (Oberá, Misiones). El checkout siempre despacha desde ahí.
const CP_ORIGEN_DEFECTO = '3360'

// Paquete por defecto (medidas del PRD: 30 × 20 × 5 cm / 300 g por prenda)
const DEF_PESO_G = 300
const DEF_ALTO_CM = 5
const DEF_ANCHO_CM = 20
const DEF_LARGO_CM = 30

// Límites de MiCorreo para /rates (peso en gramos, medidas en cm)
const PESO_MIN_G = 1
const PESO_MAX_G = 25_000
const MEDIDA_MAX_CM = 150

type Accion = 'rates' | 'import' | 'tracking'

class MicorreoError extends Error {
  status: number
  constructor(message: string, status = 502) {
    super(message)
    this.status = status
  }
}

// ------------------------------------------------------------------
// Helpers de normalización
// ------------------------------------------------------------------
function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'string') return valor.trim()
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor)
  return ''
}

function objeto(valor: unknown): Record<string, any> {
  return valor && typeof valor === 'object' && !Array.isArray(valor)
    ? (valor as Record<string, any>)
    : {}
}

function numero(valor: unknown, defecto: number): number {
  const t = texto(valor)
  if (!t) return defecto
  const n = Number(t.replace(',', '.'))
  return Number.isFinite(n) ? n : defecto
}

function entero(valor: unknown, defecto: number): number {
  const n = numero(valor, NaN)
  return Number.isFinite(n) ? Math.round(n) : defecto
}

// "1.500,50" / "1.500" (miles con punto) vs "1500.5" (decimal con punto)
function importe(valor: unknown): number {
  const t = texto(valor)
  if (!t) return NaN
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(t)) {
    return Number(t.replace(/\./g, '').replace(',', '.'))
  }
  return Number(t.replace(',', '.'))
}

function limitar(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function cpValido(valor: unknown): string {
  const cp = texto(valor).replace(/\D/g, '')
  return cp.length >= 4 ? cp.slice(0, 8) : ''
}

// "D" (domicilio), "S" (sucursal) o null = ambas modalidades.
// Cualquier valor no reconocido también devuelve null: la API en ese caso
// devuelve las dos opciones en un mismo request.
function normalizarDeliveredType(valor: unknown): 'D' | 'S' | null {
  const v = texto(valor).toUpperCase()
  if (!v) return null
  if (['D', 'DOMICILIO', 'A DOMICILIO', 'HOME'].includes(v)) return 'D'
  if (['S', 'SUCURSAL', 'AGENCY', 'PICKUP'].includes(v)) return 'S'
  return null
}

function normalizarDimensiones(fuente: unknown): Record<string, number> {
  const raiz = objeto(fuente)
  const anidado = objeto(raiz.dimensions)
  const d = Object.keys(anidado).length ? anidado : raiz

  // Acepta gramos (documentado) o kilos (si mandan 0.3 se interpreta como 300 g).
  let peso = numero(d.weight ?? d.peso, DEF_PESO_G)
  if (peso > 0 && peso < 1) peso *= 1000
  peso = Math.round(peso)

  return {
    weight: limitar(peso, PESO_MIN_G, PESO_MAX_G),
    height: limitar(entero(d.height ?? d.alto, DEF_ALTO_CM), 1, MEDIDA_MAX_CM),
    width: limitar(entero(d.width ?? d.ancho, DEF_ANCHO_CM), 1, MEDIDA_MAX_CM),
    length: limitar(entero(d.length ?? d.largo ?? d.lenght, DEF_LARGO_CM), 1, MEDIDA_MAX_CM),
  }
}

// Provincias argentinas -> código de una letra (formato de MiCorreo).
const PROVINCIAS: Record<string, string> = {
  salta: 'A',
  'buenos aires': 'B',
  'provincia de buenos aires': 'B',
  'ciudad de buenos aires': 'C',
  'ciudad autonoma de buenos aires': 'C',
  caba: 'C',
  'capital federal': 'C',
  'san luis': 'D',
  'entre rios': 'E',
  'la rioja': 'F',
  'santiago del estero': 'G',
  chaco: 'H',
  'san juan': 'J',
  catamarca: 'K',
  'la pampa': 'L',
  mendoza: 'M',
  misiones: 'N',
  formosa: 'P',
  neuquen: 'Q',
  'rio negro': 'R',
  'santa fe': 'S',
  tucuman: 'T',
  chubut: 'U',
  'tierra del fuego': 'V',
  corrientes: 'W',
  cordoba: 'X',
  jujuy: 'Y',
  'santa cruz': 'Z',
}

const CODIGOS_PROVINCIA = new Set(Object.values(PROVINCIAS))

function sinAcentos(v: string): string {
  return v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

// Acepta el código de una letra ("N"), ISO 3166-2:AR ("AR-N") o el nombre
// ("Misiones", "Ciudad de Buenos Aires"). Devuelve null si no se identifica.
function codigoProvincia(valor: unknown): string | null {
  const crudo = texto(valor)
  if (!crudo) return null
  const enMayusculas = crudo.toUpperCase().replace(/^AR-/, '')
  if (enMayusculas.length === 1 && CODIGOS_PROVINCIA.has(enMayusculas)) return enMayusculas
  return PROVINCIAS[sinAcentos(crudo)] ?? null
}

// "Av. San Martín 1234" -> { streetName: "Av. San Martín", streetNumber: "1234" }
function partirDireccion(direccion: string): { streetName: string; streetNumber: string } {
  const limpio = texto(direccion)
  const match = limpio.match(/^(.*?)[\s,]+(\d+[A-Za-zº°]?)$/)
  if (match && match[1]) return { streetName: match[1].trim(), streetNumber: match[2] }
  return { streetName: limpio, streetNumber: '' }
}

function tiempoEstimado(rate: Record<string, any>): string | null {
  // MiCorreo devuelve el rango en deliveryTimeMin / deliveryTimeMax (días hábiles).
  // Se ignora null explícitamente: Number(null) es 0 y declararía "0 días".
  const brutoMin = rate.deliveryTimeMin ?? rate.deliveryTime
  const min = brutoMin === null || brutoMin === undefined || brutoMin === '' ? NaN : Number(brutoMin)
  const max = rate.deliveryTimeMax === null || rate.deliveryTimeMax === undefined ? NaN : Number(rate.deliveryTimeMax)
  if (Number.isFinite(min)) {
    if (Number.isFinite(max) && max !== min) {
      const plural = (d: number) => `${d} ${d === 1 ? 'día' : 'días'}`
      return `${plural(min)} a ${plural(max)} hábiles`
    }
    return `${Math.round(min)} ${min === 1 ? 'día' : 'días'} hábiles`
  }

  const candidatos = [
    rate.tiempo_estimado,
    rate.estimatedDeliveryDate,
    rate.deliveryDate,
    rate.estimatedDeliveryTime,
    rate.deliveryTime,
    rate.tiempoEntrega,
    rate.businessDays,
    rate.days,
  ]
  for (const c of candidatos) {
    if (c === null || c === undefined || c === '') continue
    if (typeof c === 'number' && Number.isFinite(c)) {
      const dias = Math.round(c)
      return `${dias} ${dias === 1 ? 'día' : 'días'} hábiles`
    }
    return texto(c)
  }
  return null
}

function normalizarAccion(valor: unknown): Accion | null {
  const v = texto(valor).toLowerCase()
  if (!v) return null
  if (['rates', 'rate', 'cotizar', 'cotizacion', 'quote'].includes(v)) return 'rates'
  if (['import', 'shipping/import', 'shipping-import', 'shipping_import', 'alta'].includes(v)) {
    return 'import'
  }
  if (['tracking', 'shipping/tracking', 'shipping-tracking', 'seguimiento', 'seguir'].includes(v)) {
    return 'tracking'
  }
  return null
}

// ------------------------------------------------------------------
// Errores de la API
// ------------------------------------------------------------------
function mensajeUpstream(data: any, fallback: string): string {
  const mensaje = data?.message ?? data?.msg ?? data?.error ?? data?.Error
  if (typeof mensaje === 'string' && mensaje.trim()) return mensaje.trim()
  if (Array.isArray(data?.errors) && typeof data.errors[0] === 'string') return data.errors[0]
  if (data?.errors && typeof data.errors === 'object') {
    const primero = Object.values(data.errors).flat()[0]
    if (typeof primero === 'string' && primero.trim()) return primero.trim()
  }
  return fallback
}

// 401/403 = problema de credenciales de la función (no del cliente) -> 502.
// 5xx de Correo -> 502. El resto de los 4xx se propaga tal cual.
function statusUpstream(status: number): number {
  if (status === 401 || status === 403) return 502
  if (status >= 500) return 502
  if ([400, 402, 404, 409, 429].includes(status)) return status
  return 502
}

// ------------------------------------------------------------------
// Autenticación (POST /token con HTTP Basic) + cache del JWT
// ------------------------------------------------------------------
let tokenMemoria: { token: string; exp: number } | null = null
let baseKV: Deno.Kv | null = null
let kvIntentado = false

function kv(): Deno.Kv | null {
  if (kvIntentado) return baseKV
  kvIntentado = true
  try {
    baseKV = Deno.openKv()
  } catch (err) {
    console.warn('micorreo-envio: Deno KV no disponible, el token se cachea solo en memoria.', err)
    baseKV = null
  }
  return baseKV
}

function tokenVigente(cacheado: { token: string; exp: number } | null): boolean {
  return Boolean(
    cacheado && typeof cacheado.token === 'string' && cacheado.exp > Date.now() + MARGEN_RENOVACION_MS,
  )
}

async function leerTokenCacheado(): Promise<{ token: string; exp: number } | null> {
  if (tokenVigente(tokenMemoria)) return tokenMemoria

  const base = kv()
  if (base) {
    try {
      const entry = await base.get<{ token: string; exp: number }>(KV_KEY)
      if (tokenVigente(entry.value)) {
        tokenMemoria = entry.value
        return tokenMemoria
      }
    } catch (err) {
      console.warn('micorreo-envio: no se pudo leer el token de KV.', err)
    }
  }
  return null
}

async function borrarTokenCacheado(): Promise<void> {
  tokenMemoria = null
  const base = kv()
  if (base) {
    try {
      await base.delete(KV_KEY)
    } catch (err) {
      console.warn('micorreo-envio: no se pudo borrar el token de KV.', err)
    }
  }
}

async function guardarTokenCacheado(token: string, exp: number): Promise<void> {
  tokenMemoria = { token, exp }
  const base = kv()
  if (base) {
    try {
      await base.set(KV_KEY, { token, exp }, { expireIn: Math.max(exp - Date.now(), 60_000) })
    } catch (err) {
      console.warn('micorreo-envio: no se pudo guardar el token en KV.', err)
    }
  }
}

function aMilisegundos(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null
  const t = texto(valor)
  if (/^\d+$/.test(t)) {
    const n = Number(t)
    // segundos (~1e9) o milisegundos (~1e12)
    return n < 1e11 ? n * 1000 : n
  }
  const fecha = Date.parse(t)
  return Number.isFinite(fecha) ? fecha : null
}

function expiracionDesdeJwt(token: unknown): number | null {
  if (typeof token !== 'string') return null
  const parte = token.split('.')[1]
  if (!parte) return null
  try {
    const base64 = parte.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (parte.length % 4)) % 4)
    const payload = JSON.parse(atob(base64))
    const exp = Number(payload?.exp)
    return Number.isFinite(exp) ? exp * 1000 : null
  } catch {
    return null
  }
}

function expiracionToken(data: any): number {
  const candidato = data?.expire ?? data?.expires ?? data?.exp ?? data?.expiration
  const desdeCampo = aMilisegundos(candidato)
  if (desdeCampo) return desdeCampo
  const desdeJwt = expiracionDesdeJwt(data?.token)
  if (desdeJwt) return desdeJwt
  return Date.now() + TTL_TOKEN_FALLBACK_MS
}

async function obtenerToken(forzar = false): Promise<string> {
  if (forzar) {
    await borrarTokenCacheado()
  } else {
    const cacheado = await leerTokenCacheado()
    if (cacheado) return cacheado.token
  }

  const usuario = Deno.env.get('CORREO_ARGENTINO_USER') ?? ''
  const password = Deno.env.get('CORREO_ARGENTINO_PASS') ?? ''
  if (!usuario || !password) {
    throw new MicorreoError(
      'Faltan CORREO_ARGENTINO_USER / CORREO_ARGENTINO_PASS en los secrets de la función.',
      500,
    )
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE}/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${btoa(`${usuario}:${password}`)}` },
      signal: AbortSignal.timeout(15_000),
    })
  } catch (err) {
    console.error('micorreo-envio: fallo de red en /token.', err)
    throw new MicorreoError('No se pudo contactar a Correo Argentino para obtener el token.', 504)
  }

  const data = await res.json().catch(() => ({}))

  if (res.status === 401 || res.status === 403) {
    throw new MicorreoError(
      'Correo Argentino rechazó las credenciales de la función (CORREO_ARGENTINO_USER / CORREO_ARGENTINO_PASS).',
      502,
    )
  }
  if (!res.ok) {
    throw new MicorreoError(
      mensajeUpstream(data, `No se pudo obtener el token de Correo Argentino (${res.status}).`),
      statusUpstream(res.status),
    )
  }

  const token = texto(data?.token)
  if (!token) throw new MicorreoError('Correo Argentino no devolvió un token válido.', 502)

  await guardarTokenCacheado(token, expiracionToken(data))
  return token
}

// Llamada autenticada con Bearer. Ante un 401/403 renueva el token y reintenta
// una única vez (el JWT pudo haberse vencido entre requests).
async function llamarApi(ruta: string, init: RequestInit, reintento = true): Promise<any> {
  const token = await obtenerToken()

  let res: Response
  try {
    res = await fetch(`${API_BASE}${ruta}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...objeto(init.headers),
      },
      signal: AbortSignal.timeout(30_000),
    })
  } catch (err) {
    console.error(`micorreo-envio: fallo de red en ${ruta}.`, err)
    throw new MicorreoError(
      'No se pudo contactar a Correo Argentino. Intentá nuevamente en unos segundos.',
      504,
    )
  }

  if ((res.status === 401 || res.status === 403) && reintento) {
    console.warn(`micorreo-envio: ${res.status} en ${ruta}, se renueva el token y se reintenta.`)
    await obtenerToken(true)
    return llamarApi(ruta, init, false)
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error(`micorreo-envio: ${res.status} en ${ruta}:`, JSON.stringify(data))
    throw new MicorreoError(
      mensajeUpstream(data, `Correo Argentino respondió ${res.status} en ${ruta}.`),
      statusUpstream(res.status),
    )
  }
  return data
}

function customerIdDefecto(body: Record<string, any>): string {
  const crudo =
    texto(body.customerId ?? body.customer_id) || texto(Deno.env.get('CORREO_ARGENTINO_CUSTOMER_ID'))
  return normalizarCustomerId(crudo)
}

// MiCorreo exige un customerId numérico de 10 dígitos con ceros a la izquierda
// ("0001984194"). Si llega sin rellenar ("1984194") el endpoint no falla: responde
// 202 con rates: [], y el vacío es indistinguible de un CP sin cobertura. Por eso
// se rellena acá en lugar de pedirlo al caller.
function normalizarCustomerId(valor: string): string {
  const soloDigitos = valor.replace(/\D/g, '')
  if (!soloDigitos) return ''
  return soloDigitos.length <= 10 ? soloDigitos.padStart(10, '0') : soloDigitos
}

// ------------------------------------------------------------------
// Acción: rates (POST /rates)
// ------------------------------------------------------------------
async function cotizarRates(body: Record<string, any>) {
  const customerId = customerIdDefecto(body)
  if (!customerId) {
    throw new MicorreoError('Falta customerId para consultar las tarifas de Correo Argentino.', 400)
  }

  const cpDestino = cpValido(
    body.postalCodeDestination ?? body.postal_code_destination ?? body.destino ?? body.codigo_postal,
  )
  if (!cpDestino) {
    throw new MicorreoError('Ingresá un código postal válido para calcular el envío.', 400)
  }

  const cpOrigen =
    cpValido(body.postalCodeOrigin ?? body.postal_code_origin ?? body.origen) ||
    cpValido(Deno.env.get('CORREO_ARGENTINO_CP_ORIGEN')) ||
    CP_ORIGEN_DEFECTO

  const dimensions = normalizarDimensiones(body)
  // deliveredType omitido = la API devuelve domicilio y sucursal juntas.
  const deliveredType = normalizarDeliveredType(
    body.deliveredType ?? body.delivered_type ?? body.tipo_entrega,
  )

  const payload: Record<string, unknown> = {
    customerId,
    postalCodeOrigin: cpOrigen,
    postalCodeDestination: cpDestino,
    dimensions,
  }
  if (deliveredType) payload.deliveredType = deliveredType

  const data = await llamarApi('/rates', { method: 'POST', body: JSON.stringify(payload) })

  const rates = (Array.isArray(data?.rates) ? data.rates : []).map((r: unknown) => {
    const rate = objeto(r)
    const price = Number(rate.price)
    // Se conservan los campos originales y se agrega `costo` + `tiempo_estimado`
    // (si la API no informa ETA, queda en null).
    return {
      ...rate,
      costo: Number.isFinite(price) ? price : null,
      tiempo_estimado: tiempoEstimado(rate),
    }
  })

  return {
    ok: true,
    action: 'rates',
    request: payload,
    validTo: data?.validTo ?? null,
    rates,
  }
}

// ------------------------------------------------------------------
// Acción: shipping/import (POST /shipping/import)
// ------------------------------------------------------------------
function normalizarRecipient(fuente: unknown) {
  const r = objeto(fuente)
  const name =
    texto(r.name) ||
    [texto(r.firstName ?? r.nombre), texto(r.lastName ?? r.apellido)].filter(Boolean).join(' ')
  const phone = texto(r.phone ?? r.telefono ?? r.telefono_contacto)
  const cellPhone = texto(r.cellPhone ?? r.celular ?? r.whatsapp) || phone
  const email = texto(r.email ?? r.mail ?? r.correo)

  // MiCorreo solo documenta name / phone / cellPhone / email en `recipient`
  // (el DNI y el CUIT se usan únicamente al registrarse en MiCorreo), por eso
  // no se reenvían aunque el body los incluya.
  const recipient: Record<string, string> = { name }
  if (email) recipient.email = email
  if (phone) recipient.phone = phone
  if (cellPhone) recipient.cellPhone = cellPhone
  return recipient
}

function normalizarSender(fuente: unknown) {
  const s = objeto(fuente)
  const address = objeto(s.originAddress ?? s.address)
  const calle = texto(address.streetName)
  const altura = texto(address.streetNumber)
  const origen = partirDireccion(calle ? `${calle} ${altura}`.trim() : texto(s.direccion))

  const originAddress: Record<string, string> = {
    streetName: origen.streetName,
    streetNumber: origen.streetNumber,
    city: texto(address.city ?? s.localidad),
    provinceCode: codigoProvincia(address.provinceCode ?? s.provincia) ?? '',
    postalCode: cpValido(address.postalCode ?? s.cp),
  }
  const floor = texto(address.floor ?? s.piso)
  const apartment = texto(address.apartment ?? s.departamento)
  if (floor) originAddress.floor = floor.slice(0, 3)
  if (apartment) originAddress.apartment = apartment.slice(0, 3)

  const nombre = [texto(s.firstName ?? s.nombre), texto(s.lastName ?? s.apellido)].filter(Boolean).join(' ')
  const sender: Record<string, unknown> = { originAddress }
  if (nombre || texto(s.name)) sender.name = texto(s.name) || nombre
  const phone = texto(s.phone ?? s.telefono)
  const cellPhone = texto(s.cellPhone ?? s.celular)
  const email = texto(s.email ?? s.mail)
  if (phone) sender.phone = phone
  if (cellPhone) sender.cellPhone = cellPhone
  if (email) sender.email = email
  return sender
}

function normalizarShipping(
  fuente: unknown,
  raiz: Record<string, any>,
): Record<string, any> {
  const s = objeto(fuente)
  const deliveryType = normalizarDeliveredType(
    s.deliveryType ?? s.deliveredType ?? s.tipo_entrega ?? raiz.deliveredType,
  ) ?? 'D'

  const addressFuente = objeto(s.address)
  const calle = texto(addressFuente.streetName) || texto(s.streetName)
  const altura =
    texto(addressFuente.streetNumber) || texto(s.streetNumber ?? s.altura ?? s.numero)
  const direccionLibre = texto(s.direccion ?? raiz.direccion)
  const partida = partirDireccion(calle ? `${calle} ${altura}`.trim() : direccionLibre)

  const address: Record<string, string> = {
    streetName: partida.streetName,
    streetNumber: partida.streetNumber,
    city: texto(addressFuente.city ?? s.city ?? s.ciudad ?? s.localidad ?? raiz.localidad),
    provinceCode:
      codigoProvincia(addressFuente.provinceCode ?? s.provinceCode ?? s.provincia ?? raiz.provincia) ?? '',
    postalCode: cpValido(
      addressFuente.postalCode ?? s.postalCode ?? s.cp ?? s.codigo_postal ??
        raiz.codigo_postal ?? raiz.cp,
    ),
  }
  const floor = texto(addressFuente.floor ?? s.floor ?? s.piso)
  const apartment = texto(addressFuente.apartment ?? s.apartment ?? s.departamento)
  if (floor) address.floor = floor.slice(0, 3)
  if (apartment) address.apartment = apartment.slice(0, 3)

  // Los campos de `shipping` pisan los de la raíz; si no vienen, se toman del body.
  const dimensiones = normalizarDimensiones({ ...raiz, ...s })
  const declaredValue = importe(
    s.declaredValue ?? s.valor_declarado ?? raiz.declaredValue ?? raiz.valor_declarado ??
      raiz.monto_total ?? raiz.total,
  )
  if (!Number.isFinite(declaredValue) || declaredValue <= 0) {
    throw new MicorreoError('Falta el valor declarado del envío (declaredValue).', 400)
  }

  const shipping: Record<string, unknown> = {
    deliveryType,
    address,
    weight: dimensiones.weight,
    declaredValue,
    height: dimensiones.height,
    length: dimensiones.length,
    width: dimensiones.width,
  }

  if (deliveryType === 'S') {
    const agency = texto(s.agency ?? s.sucursal ?? raiz.agency)
    if (!agency) {
      throw new MicorreoError(
        'Para envíos a sucursal hace falta el código de la sucursal (agency).',
        400,
      )
    }
    shipping.agency = agency
  }

  return shipping
}

async function importarEnvio(body: Record<string, any>) {
  const customerId = customerIdDefecto(body)
  if (!customerId) {
    throw new MicorreoError('Falta customerId para importar el envío a MiCorreo.', 400)
  }

  const extOrderId = texto(body.extOrderId ?? body.ext_order_id ?? body.orderId ?? body.orden_id)
  if (!extOrderId) {
    throw new MicorreoError('Falta extOrderId para importar el envío (identifica la orden).', 400)
  }

  const recipient = normalizarRecipient(body.recipient ?? body.destinatario ?? body.cliente)
  if (!recipient.name) throw new MicorreoError('Falta el nombre del destinatario.', 400)
  if (!recipient.email) throw new MicorreoError('Falta el email del destinatario.', 400)

  const shipping = normalizarShipping(body.shipping ?? body.envio, body)
  const address = objeto(shipping.address)
  if (shipping.deliveryType === 'D') {
    const faltantes = ['streetName', 'streetNumber', 'city', 'provinceCode', 'postalCode'].filter(
      (campo) => !texto(address[campo]),
    )
    if (faltantes.length) {
      throw new MicorreoError(
        `Para envíos a domicilio falta completar: ${faltantes.join(', ')}.`,
        400,
      )
    }
  }

  const payload: Record<string, unknown> = {
    customerId,
    extOrderId,
    recipient,
    shipping,
  }

  const orderNumber = texto(body.orderNumber ?? body.order_number ?? body.nro_orden)
  if (orderNumber) payload.orderNumber = orderNumber
  if (body.sender ?? body.remitente) payload.sender = normalizarSender(body.sender ?? body.remitente)

  const data = await llamarApi('/shipping/import', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return { ...objeto(data), ok: true, action: 'import', extOrderId }
}

// ------------------------------------------------------------------
// Acción: shipping/tracking (GET /shipping/tracking?shippingId=...)
// ------------------------------------------------------------------
async function seguirEnvio(body: Record<string, any>, params: URLSearchParams) {
  const shippingId = texto(body.shippingId ?? body.shipping_id ?? params.get('shippingId'))
  if (!shippingId) {
    throw new MicorreoError('Falta el parámetro shippingId para consultar el seguimiento.', 400)
  }

  const data = await llamarApi(
    `/shipping/tracking?${new URLSearchParams({ shippingId }).toString()}`,
    { method: 'GET' },
  )

  const detalle = data && typeof data === 'object' && !Array.isArray(data) ? data : { resultado: data }
  return { ...detalle, ok: true, action: 'tracking', shippingId }
}

// ------------------------------------------------------------------
// Handler
// ------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const esGet = req.method === 'GET'
    const esPost = req.method === 'POST'
    if (!esGet && !esPost) {
      return json({ error: `Método ${req.method} no soportado. Usá GET o POST.` }, { status: 405 })
    }

    const cuerpo = esGet ? {} : objeto(await req.json().catch(() => ({})))
    const accion = normalizarAccion(cuerpo.action ?? cuerpo.accion ?? url.searchParams.get('action'))

    if (!accion) {
      return json(
        { error: 'Acción inválida. Usá action: "rates" | "shipping/import" | "shipping/tracking".' },
        { status: 400 },
      )
    }
    if (esGet && accion !== 'tracking') {
      return json({ error: `La acción "${accion}" solo acepta POST.` }, { status: 405 })
    }

    if (accion === 'rates') return json(await cotizarRates(cuerpo))
    if (accion === 'import') return json(await importarEnvio(cuerpo))
    return json(await seguirEnvio(cuerpo, url.searchParams))
  } catch (err) {
    if (err instanceof MicorreoError) {
      return json({ error: err.message }, { status: err.status })
    }
    console.error('micorreo-envio error:', err)
    return json({ error: 'No se pudo procesar la solicitud de envío.' }, { status: 500 })
  }
})
