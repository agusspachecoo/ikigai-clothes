export const CONTACTO = {
  instagram: 'https://www.instagram.com/ikigai_clothess/',
  instagramHandle: '@ikigai_clothess',
  whatsapp: 'https://wa.me/5493755732335',
  whatsappVisible: '+54 9 3755 73-2335',
  tiktok: 'https://www.tiktok.com/@ikigai_clothess',
  tiktokHandle: '@ikigai_clothess',
  email: 'ikigaiclothes.contacto@gmail.com',
}

export const WHATSAPP_URL = `${CONTACTO.whatsapp}?text=${encodeURIComponent('Hola Ikigai Clothes!')}`

/** Datos del showroom físico. La imagen se configura por VITE_SHOWROOM_IMAGE_URL. */
export const SHOWROOM = {
  titulo: 'Visitanos en el showroom',
  bajada: 'Probá la prendas en persona, coordiná tu visita por WhatsApp y retirá tu pedido sin cargo.',
  direccion: 'Mosconi 331, Oberá, Misiones',
  calle: 'Mosconi 331',
  ciudad: 'Oberá',
  provincia: 'Misiones',
  codigoPostal: '3360',
  horario: 'Lun a Sáb · 10 a 20 hs',
  imagen: String(import.meta.env.VITE_SHOWROOM_IMAGE_URL ?? ''),
}

export const WHATSAPP_SHOWROOM_URL = `${CONTACTO.whatsapp}?text=${encodeURIComponent(
  'Hola Ikigai Clothes! Quiero visitar el showroom.',
)}`

/** Cómo llegar: linkeo la dirección real, no unPlus Code inventado. */
export const MAPS_SHOWROOM_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  `${SHOWROOM.calle}, ${SHOWROOM.ciudad}, ${SHOWROOM.provincia}, Argentina`,
)}`