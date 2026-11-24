import { Link } from 'react-router-dom'
import { SocialLinks } from './SocialLinks'
import { MediosPagoBadges } from './MediosPagoBadges'
import { useTienda } from '../context/tienda'
import { CONTACTO, MAPS_SHOWROOM_URL, urlWhatsapp } from '../lib/contacto'
import logoWhite from '../assets/logo-white.png'

const AYUDA = [
  { label: 'Política de Envíos', to: '/politica-de-envios' },
  { label: 'Cambios y Devoluciones', to: '/devoluciones' },
  { label: 'Preguntas Frecuentes', to: '/preguntas-frecuentes' },
  { label: 'Contacto', to: '/contacto' },
]

const INSTITUCIONAL = [
  { label: 'Quiénes Somos', to: '/quienes-somos' },
  { label: 'Términos y Condiciones', to: '/terminos-y-condiciones' },
  { label: 'Política de Privacidad', to: '/politica-de-privacidad' },
]

const POLITICAS_CLAVE = [
  { label: 'Devoluciones', to: '/devoluciones' },
  { label: 'Privacidad', to: '/politica-de-privacidad' },
  { label: 'Envíos', to: '/politica-de-envios' },
]

function numeroWhatsappVisible(valor: string) {
  if (valor.startsWith('http')) return CONTACTO.whatsappVisible
  const digitos = valor.replace(/\D/g, '')
  return digitos.length >= 12
    ? `+${digitos.slice(0, 2)} 9 ${digitos.slice(3, 7)} ${digitos.slice(7, 9)}-${digitos.slice(9)}`
    : digitos || CONTACTO.whatsappVisible
}

export function Footer() {
  const {
    nombre_tienda,
    razon_social,
    direccion,
    horario_atencion,
    whatsapp,
    cuit,
    cuotas_sin_interes,
    descuento_transferencia,
  } = useTienda()
  const year = new Date().getFullYear()
  const porcentajeTransferencia = Math.round(descuento_transferencia * 100)
  const marca = nombre_tienda || razon_social || 'Ikigai Clothes'
  const titularLegal = razon_social || nombre_tienda || 'Ikigai Clothes'

  const lineaGarantias = [
    'Envíos a todo el país',
    cuotas_sin_interes > 1 ? `${cuotas_sin_interes} cuotas sin interés` : 'Cuotas sin interés',
    porcentajeTransferencia > 0
      ? `${porcentajeTransferencia}% OFF transferencia`
      : 'Transferencia bancaria',
    'Cambios y devoluciones',
  ].join(' · ')

  return (
    <footer className="bg-neutral text-neutral-content mt-auto border-t border-white/10">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* 1. WhatsApp arriba de todo, con horario y dirección */}
        <div className="grid grid-cols-1 gap-5 border-b border-white/10 py-7 md:grid-cols-3 md:gap-8">
          <a
            href={urlWhatsapp(whatsapp)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-success px-4 py-3 text-white transition-opacity hover:opacity-90"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 shrink-0" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            <span>
              <span className="block text-[10px] font-semibold uppercase tracking-widest opacity-80">
                Atención directa por WhatsApp
              </span>
              <strong className="block text-sm">{numeroWhatsappVisible(whatsapp)}</strong>
            </span>
          </a>

          <div className="flex items-center gap-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6 shrink-0 opacity-70" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-neutral-content/60">
                Horario de atención
              </p>
              <p className="text-sm">{horario_atencion}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6 shrink-0 opacity-70" aria-hidden="true">
              <path d="M12 21s7-5.2 7-11a7 7 0 10-14 0c0 5.8 7 11 7 11z" strokeLinejoin="round" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-neutral-content/60">
                Dirección · Showroom
              </p>
              <a
                href={MAPS_SHOWROOM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline-offset-2 hover:underline"
              >
                {direccion}
              </a>
            </div>
          </div>
        </div>

        {/* Navegación principal del footer */}
        <div className="grid grid-cols-1 gap-8 py-10 md:grid-cols-2 lg:grid-cols-4 md:gap-10">
          <div className="lg:col-span-2">
            <Link to="/" aria-label={`${marca} - Inicio`} className="inline-flex items-center">
              <img
                src={logoWhite}
                alt={marca}
                loading="lazy"
                decoding="async"
                width={500}
                height={500}
                onError={(e) => {
                  ;(e.currentTarget as HTMLElement).style.display = 'none'
                }}
                className="h-11 md:h-12 w-auto"
              />
            </Link>
            <p className="mt-3 max-w-md text-sm text-neutral-content/70 leading-relaxed">
              {direccion ? `${marca} · ${direccion}. ` : `${marca}. `}
              Indumentaria urbana con atención directa y envíos a todo el país.
            </p>
            <SocialLinks className="mt-5" />
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-[0.25em] text-neutral-content/60 mb-3.5">
              Ayuda
            </h3>
            <ul className="space-y-2">
              {AYUDA.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="text-sm transition-colors hover:text-white text-neutral-content/80"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-[0.25em] text-neutral-content/60 mb-3.5">
              Institucional
            </h3>
            <ul className="space-y-2">
              {INSTITUCIONAL.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="text-sm transition-colors hover:text-white text-neutral-content/80"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 2. Logos de tarjetas + políticas (devolución, privacidad y envíos) */}
        <div className="flex flex-col gap-5 border-t border-white/10 py-6 md:flex-row md:items-center md:justify-between md:gap-8">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <p className="shrink-0 text-[10px] uppercase tracking-[0.2em] text-neutral-content/60">
              Medios de pago
            </p>
            <MediosPagoBadges variante="oscuro" className="min-w-0" />
          </div>

          <nav aria-label="Políticas de la tienda" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-neutral-content/80">
            {POLITICAS_CLAVE.map((politica) => (
              <Link
                key={politica.to}
                to={politica.to}
                className="underline-offset-4 hover:text-white hover:underline transition-colors"
              >
                {politica.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* 3. Garantías en una sola línea */}
        <div className="border-t border-white/10 py-4 text-center sm:text-left">
          <p className="text-xs font-medium tracking-wide text-neutral-content/90 truncate">
            {lineaGarantias}
          </p>
        </div>

        {/* 4. Quién sos: dirección, razón social y respaldo */}
        <div className="border-t border-white/10 py-6 text-xs text-neutral-content/65">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1">
              <p className="font-medium text-neutral-content/85">
                {titularLegal}
                {cuit ? ` · CUIT/CUIL ${cuit}` : ''}
              </p>
              {direccion && <p>{direccion}</p>}
              <p className="text-neutral-content/55">
                © {year} {marca}. Todos los derechos reservados.
              </p>
            </div>

            <p className="text-neutral-content/55">
              {marca} · Tienda online
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer