import { Link } from 'react-router-dom'
import { MAPS_SHOWROOM_URL, SHOWROOM, WHATSAPP_SHOWROOM_URL } from '../lib/contacto'
import { srcsetImagen } from '../lib/imagenes'
import { useTienda } from '../context/tienda'

const ICONO_UBICACION = (
  <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
    />
  </svg>
)

const ICONO_RELOJ = (
  <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
)

/** Bloque de cierre: invitación a visitar el showroom con imagen configurable. */
export function ShowroomSection() {
  const { imagen_showroom } = useTienda()
  // La imagen sale del panel; la variable de entorno queda como respaldo.
  const imagen = imagen_showroom || SHOWROOM.imagen

  return (
    <section className="bg-base-100 border-t border-line">
      <div className="grid grid-cols-1 lg:grid-cols-2">
        <figure className="relative aspect-[4/3] lg:aspect-auto lg:min-h-[26rem] bg-base-300">
          {imagen ? (
            <img
              src={imagen}
              srcSet={srcsetImagen(imagen, 640).srcset}
              sizes="(max-width: 1024px) 100vw, 640px"
              alt={`Showroom de Ikigai Clothes en ${SHOWROOM.direccion}`}
              loading="lazy"
              decoding="async"
              width={640}
              height={480}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
              <span className="text-4xl opacity-20" aria-hidden="true">
                ✦
              </span>
              <p className="text-xs uppercase tracking-[0.25em] opacity-40">Ikigai Clothes</p>
              <p className="text-sm opacity-50 max-w-xs">
                Subí la foto del showroom desde{' '}
                <strong className="font-semibold">Panel → Configuración</strong>.
              </p>
            </div>
          )}
        </figure>

        <div className="flex flex-col justify-center gap-5 p-6 sm:p-10 lg:p-14">
          <p className="text-xs uppercase tracking-[0.25em] opacity-50">Showroom</p>
          <h2 className="font-display text-2xl sm:text-3xl">{SHOWROOM.titulo}</h2>
          <p className="text-sm opacity-70 max-w-md">{SHOWROOM.bajada}</p>

          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              {ICONO_UBICACION}
              {/* Enlace a Google Maps: además de sirvir al usuario, el enlace
                  con la dirección exacta es lo que refuerza laNAP con Google. */}
              <a
                href={MAPS_SHOWROOM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="link link-hover"
              >
                {SHOWROOM.direccion}
              </a>
            </li>
            <li className="flex items-center gap-2">
              {ICONO_RELOJ}
              <span>{SHOWROOM.horario}</span>
            </li>
          </ul>

          <div className="flex flex-wrap gap-3">
            <a
              href={WHATSAPP_SHOWROOM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-neutral btn-sm sm:btn-md"
            >
              Coordinar una visita
            </a>
            <Link to="/contacto" className="btn btn-outline btn-sm sm:btn-md">
              Cómo llegar
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}