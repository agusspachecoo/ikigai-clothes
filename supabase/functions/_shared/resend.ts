import { Resend } from 'npm:resend@6'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

const FROM_POR_DEFECTO = 'Ikigai Clothes <onboarding@resend.dev>'
const ADMIN_POR_DEFECTO = 'ikigaiclothes.contacto@gmail.com'
const STORE_URL_POR_DEFECTO = 'https://ikigai-clothes.vercel.app'

export interface OrdenEmailItem {
  nombre: string
  talle: string | null
  cantidad: number
  precio_unitario: number
}

export interface OrdenEmail {
  id: string
  cliente_nombre: string
  cliente_email: string
  cliente_telefono?: string | null
  metodo_pago: string
  monto_total: number
  costo_envio: number
  direccion?: string | null
  codigo_postal?: string | null
  envio_detalle?: {
    metodo?: string | null
    carrier?: string | null
    servicio?: string | null
  } | null
  items: OrdenEmailItem[]
}

export interface ResultadoEnvioEmail {
  ok: boolean
  id?: string
  error?: string
  omitido?: boolean
}

export interface OpcionesEmail {
  to: string | string[]
  subject: string
  html: string
  from?: string
  replyTo?: string
}

export function resendConfigurado(): boolean {
  return Boolean((Deno.env.get('RESEND_API_KEY') ?? '').trim())
}

function obtenerCliente(): Resend | null {
  const apiKey = (Deno.env.get('RESEND_API_KEY') ?? '').trim()
  if (!apiKey) return null
  return new Resend(apiKey)
}

function remitente(): string {
  return (Deno.env.get('RESEND_FROM_EMAIL') ?? '').trim() || FROM_POR_DEFECTO
}

function emailAdmin(): string {
  return (
    (Deno.env.get('ADMIN_EMAIL') ?? '').trim() ||
    (Deno.env.get('RESEND_ADMIN_EMAIL') ?? '').trim() ||
    ADMIN_POR_DEFECTO
  )
}

function storeUrl(): string {
  return ((Deno.env.get('STORE_URL') ?? '').trim() || STORE_URL_POR_DEFECTO).replace(/\/+$/, '')
}

export async function enviarEmail(opciones: OpcionesEmail): Promise<ResultadoEnvioEmail> {
  const resend = obtenerCliente()

  if (!resend) {
    console.warn('Resend no configurado: falta RESEND_API_KEY. Se omite el envío del email.')
    return { ok: false, omitido: true, error: 'RESEND_API_KEY no configurada.' }
  }

  const destinatarios = (Array.isArray(opciones.to) ? opciones.to : [opciones.to])
    .map((email) => String(email ?? '').trim())
    .filter(Boolean)

  if (destinatarios.length === 0) {
    return { ok: false, error: 'El email no tiene destinatario.' }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: opciones.from || remitente(),
      to: destinatarios,
      subject: opciones.subject,
      html: opciones.html,
      replyTo: opciones.replyTo,
    })

    if (error) {
      console.error('Resend error:', error)
      return { ok: false, error: error.message }
    }

    return { ok: true, id: data?.id }
  } catch (err) {
    console.error('Resend error inesperado:', err)
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error inesperado al enviar el email.',
    }
  }
}

export async function cargarOrdenParaEmail(
  supabase: SupabaseClient,
  ordenId: string,
): Promise<OrdenEmail | null> {
  const { data, error } = await supabase
    .from('ordenes')
    .select(
      'id, cliente_nombre, cliente_email, cliente_telefono, metodo_pago, monto_total, costo_envio, direccion, codigo_postal, envio_detalle, orden_items(cantidad, talle, precio_unitario, productos(nombre))',
    )
    .eq('id', ordenId)
    .maybeSingle()

  if (error) {
    console.error('No se pudo leer la orden para el email:', error.message)
    return null
  }

  if (!data) return null

  type Fila = {
    id: string
    cliente_nombre: string
    cliente_email: string
    cliente_telefono: string | null
    metodo_pago: string
    monto_total: number
    costo_envio: number
    direccion: string | null
    codigo_postal: string | null
    envio_detalle: OrdenEmail['envio_detalle']
    orden_items:
      | {
          cantidad: number
          talle: string | null
          precio_unitario: number
          productos: { nombre?: string | null } | { nombre?: string | null }[] | null
        }[]
      | null
  }

  const fila = data as unknown as Fila

  const items: OrdenEmailItem[] = (fila.orden_items ?? []).map((item) => {
    const producto = Array.isArray(item.productos) ? item.productos[0] : item.productos
    return {
      nombre: String(producto?.nombre ?? 'Producto'),
      talle: item.talle,
      cantidad: Number(item.cantidad) || 0,
      precio_unitario: Number(item.precio_unitario) || 0,
    }
  })

  return {
    id: String(fila.id),
    cliente_nombre: String(fila.cliente_nombre ?? ''),
    cliente_email: String(fila.cliente_email ?? ''),
    cliente_telefono: fila.cliente_telefono,
    metodo_pago: String(fila.metodo_pago ?? ''),
    monto_total: Number(fila.monto_total) || 0,
    costo_envio: Number(fila.costo_envio) || 0,
    direccion: fila.direccion,
    codigo_postal: fila.codigo_postal,
    envio_detalle: fila.envio_detalle ?? null,
    items,
  }
}

export async function enviarConfirmacionPedido(
  orden: OrdenEmail,
  opciones: { pagoAcreditado?: boolean } = {},
): Promise<ResultadoEnvioEmail> {
  const pagoAcreditado = opciones.pagoAcreditado !== false
  const numero = numeroPedido(orden.id)

  return enviarEmail({
    to: orden.cliente_email,
    subject: pagoAcreditado
      ? `Pago acreditado - Pedido ${numero} - Ikigai Clothes`
      : `Recibimos tu pedido ${numero} - Ikigai Clothes`,
    replyTo: emailAdmin(),
    html: layout({
      titulo: pagoAcreditado ? 'Pago acreditado' : 'Pedido recibido',
      bajada: pagoAcreditado
        ? `¡Gracias por tu compra, ${escaparHtml(orden.cliente_nombre)}! Ya estamos preparando tu pedido.`
        : `¡Gracias por tu compra, ${escaparHtml(orden.cliente_nombre)}! Registramos tu pedido.`,
      contenido: `
        <p style="margin:0 0 16px;color:#4b5563;font-size:14px;line-height:1.6;">
          Tu pedido <strong>${numero}</strong> quedó registrado con los siguientes detalles:
        </p>
        ${tablaItems(orden)}
        ${tablaTotales(orden)}
        ${bloqueEntrega(orden)}
        <p style="margin:24px 0 0;color:#6b7280;font-size:13px;line-height:1.6;">
          Si tenés alguna consulta, respondé este correo o escribinos por WhatsApp.
        </p>
      `,
    }),
  })
}

export async function enviarAlertaNuevoPedido(orden: OrdenEmail): Promise<ResultadoEnvioEmail> {
  const numero = numeroPedido(orden.id)
  const panelUrl = `${storeUrl()}/admin/pedidos`

  return enviarEmail({
    to: emailAdmin(),
    subject: `Nuevo pedido ${numero} - ${dinero(orden.monto_total)} - Ikigai Clothes`,
    replyTo: orden.cliente_email,
    html: layout({
      titulo: 'Nuevo pedido',
      bajada: `Entró el pedido ${numero} por ${dinero(orden.monto_total)}.`,
      contenido: `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-size:13px;width:140px;">Cliente</td>
            <td style="padding:8px 0;color:#111111;font-size:14px;">${escaparHtml(orden.cliente_nombre)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-size:13px;">Email</td>
            <td style="padding:8px 0;color:#111111;font-size:14px;">${escaparHtml(orden.cliente_email)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-size:13px;">Teléfono</td>
            <td style="padding:8px 0;color:#111111;font-size:14px;">${escaparHtml(orden.cliente_telefono ?? '-')}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-size:13px;">Pago</td>
            <td style="padding:8px 0;color:#111111;font-size:14px;">${escaparHtml(metodoPago(orden.metodo_pago))}</td>
          </tr>
        </table>
        ${tablaItems(orden)}
        ${tablaTotales(orden)}
        ${bloqueEntrega(orden)}
        <p style="margin:24px 0 0;">
          <a href="${panelUrl}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:8px;">
            Ver pedido en el panel
          </a>
        </p>
      `,
    }),
  })
}

function numeroPedido(id: string): string {
  return `#${String(id ?? '').slice(0, 8).toUpperCase()}`
}

function metodoPago(metodo: string): string {
  if (metodo === 'mercadopago') return 'Mercado Pago'
  if (metodo === 'transferencia') return 'Transferencia bancaria'
  return metodo || '-'
}

function dinero(valor: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Number(valor) || 0)
}

function escaparHtml(valor: unknown): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function tablaItems(orden: OrdenEmail): string {
  const filas = orden.items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#111111;font-size:14px;">
            ${escaparHtml(item.nombre)}
            ${item.talle ? `<span style="color:#6b7280;font-size:12px;"> · Talle ${escaparHtml(item.talle)}</span>` : ''}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;text-align:center;white-space:nowrap;">
            x${item.cantidad}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#111111;font-size:14px;text-align:right;white-space:nowrap;">
            ${dinero(item.precio_unitario * item.cantidad)}
          </td>
        </tr>
      `,
    )
    .join('')

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <thead>
        <tr>
          <th style="padding:0 0 8px;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Producto</th>
          <th style="padding:0 0 8px;text-align:center;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Cant.</th>
          <th style="padding:0 0 8px;text-align:right;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Subtotal</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
  `
}

function tablaTotales(orden: OrdenEmail): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 0;">
      <tr>
        <td style="padding:4px 0;color:#6b7280;font-size:13px;">Envío</td>
        <td style="padding:4px 0;color:#111111;font-size:13px;text-align:right;">
          ${orden.costo_envio > 0 ? dinero(orden.costo_envio) : 'Gratis'}
        </td>
      </tr>
      <tr>
        <td style="padding:10px 0 0;border-top:1px solid #111111;color:#111111;font-size:15px;font-weight:700;">Total</td>
        <td style="padding:10px 0 0;border-top:1px solid #111111;color:#111111;font-size:15px;font-weight:700;text-align:right;">
          ${dinero(orden.monto_total)}
        </td>
      </tr>
    </table>
  `
}

function bloqueEntrega(orden: OrdenEmail): string {
  const esRetiro = orden.envio_detalle?.metodo === 'retiro'
  const carrier = [orden.envio_detalle?.carrier, orden.envio_detalle?.servicio]
    .filter(Boolean)
    .join(' · ')

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;background:#f9fafb;border-radius:8px;">
      <tr>
        <td style="padding:16px;">
          <p style="margin:0 0 6px;color:#111111;font-size:13px;font-weight:600;">
            ${esRetiro ? 'Retiro en showroom' : 'Entrega'}
          </p>
          <p style="margin:0;color:#4b5563;font-size:13px;line-height:1.6;">
            ${
              esRetiro
                ? 'Coordinamos el horario de retiro por WhatsApp.'
                : `${escaparHtml(orden.direccion ?? '')}${orden.codigo_postal ? ` · CP ${escaparHtml(orden.codigo_postal)}` : ''}${carrier ? `<br />${escaparHtml(carrier)}` : ''}`
            }
          </p>
        </td>
      </tr>
    </table>
  `
}

function layout(datos: { titulo: string; bajada: string; contenido: string }): string {
  return `
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escaparHtml(datos.titulo)} - Ikigai Clothes</title>
      </head>
      <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:24px 28px;border-bottom:1px solid #e5e7eb;">
                    <span style="color:#111111;font-size:18px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;">IKIGAI</span>
                    <span style="color:#6b7280;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;">Clothes</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px;">
                    <h1 style="margin:0 0 8px;color:#111111;font-size:22px;font-weight:700;">${escaparHtml(datos.titulo)}</h1>
                    <p style="margin:0 0 24px;color:#4b5563;font-size:14px;line-height:1.6;">${datos.bajada}</p>
                    ${datos.contenido}
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;">
                    <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;text-align:center;">
                      Ikigai Clothes · Mosconi 331, Oberá, Misiones
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `
}
