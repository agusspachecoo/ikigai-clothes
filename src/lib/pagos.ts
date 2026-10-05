export const DATOS_TRANSFERENCIA = {
  banco: 'Naranja X',
  titular: 'Joaquin Fabian Leopolino',
  cuil: '20467175573',
  cbu: '4530000800013258742695',
  alias: 'ikigai.naranja',
  cajaAhorro: '1325874269',
}

export const DESCUENTO_TRANSFERENCIA = 0.20

export type MetodoPago = 'mercadopago' | 'transferencia'

/**
 * Pasos que ve el cliente, en el orden en que los tiene que hacer.
 *
 * Van juntos en `src/lib/pagos.ts` porque los usan dos pantallas: el checkout
 * (antes de confirmar, para que sepa qué va a pasar) y la pantalla de
 * confirmación (después, como recordatorio de lo que falta hacer).
 */
export const PASOS_PAGO: Record<MetodoPago, string[]> = {
  transferencia: [
    'Copiá el Alias o el CBU de nuestra cuenta.',
    'Hacé la transferencia por el importe exacto del pedido. El descuento ya está aplicado.',
    'Guardá el comprobante: lo podés subir acá mismo o mandarlo por WhatsApp.',
    'Te avisamos por WhatsApp cuando el pago se acredite y coordinamos la entrega.',
  ],
  mercadopago: [
    'Te llevamos al sitio de Mercado Pago para completar el pago.',
    'Podés pagar con tarjeta de crédito, débito o dinero en cuenta de Mercado Pago.',
    'Mercado Pago te devuelve a la tienda y te confirmamos el pedido al instante.',
    'Si el pago queda pendiente, se liquida solo con la acreditación: no tenés que hacer nada más.',
  ],
}

export const TEXTO_METODO: Record<MetodoPago, { titulo: string; resumen: string }> = {
  transferencia: {
    titulo: 'Transferencia bancaria',
    resumen: 'Pagás directo a nuestra cuenta, con descuento y sin comisión.',
  },
  mercadopago: {
    titulo: 'Mercado Pago',
    resumen: 'Tarjeta de crédito, débito o dinero en cuenta de Mercado Pago.',
  },
}

/** Texto de la pantalla de confirmación según si falta o no el comprobante. */
export const ESTADO_PAGO: Record<string, { titulo: string; detalle: string }> = {
  pendiente_verificacion: {
    titulo: 'Recibimos tu comprobante',
    detalle: 'Estamos verificando la acreditación. Te escribimos por WhatsApp apenas esté confirmada.',
  },
  pendiente: {
    titulo: 'Pedido registrado',
    detalle: 'Falta el comprobante de la transferencia. Subilo o mandanos el pantallazo por WhatsApp.',
  },
  pagado: {
    titulo: 'Pago acreditado',
    detalle: 'Ya tenemos tu pedido confirmado. Ahora coordinamos la entrega.',
  },
  enviado: {
    titulo: 'Tu pedido está en camino',
    detalle: 'Vas a recibir el seguimiento por WhatsApp.',
  },
  entregado: {
    titulo: 'Pedido entregado',
    detalle: 'Gracias por comprar en Ikigai Clothes.',
  },
  cancelado: {
    titulo: 'Pedido cancelado',
    detalle: 'Si fue un error, escribinos por WhatsApp y lo revisamos.',
  },
}