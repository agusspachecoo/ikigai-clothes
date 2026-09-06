import { CONTACTO } from './contacto'

export const DATOS_TRANSFERENCIA = {
  banco: 'Mercado Pago',
  titular: 'IKIGAI CLOTHES',
  cuit: '30-12345678-9',
  cbu: '0000003100000000000000',
  alias: 'ikigai.clothes',
}

export function whatsappComprobante(ordenId: string) {
  const msg = `Hola Ikigai Clothes! Adjunto comprobante de transferencia del pedido ${ordenId}.`
  return `${CONTACTO.whatsapp}?text=${encodeURIComponent(msg)}`
}
