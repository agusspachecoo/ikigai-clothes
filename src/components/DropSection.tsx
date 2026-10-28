import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ProductCard } from './ProductCard'
import { ImagenSegura } from './ImagenSegura'
import { useCountdown } from '../hooks/useCountdown'
import type { DropVista } from '../hooks/useDropsDestacados'

function BloqueTiempo({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="min-w-[2.5rem] rounded-md bg-white/10 px-2 py-1 text-xl font-extrabold tabular-nums text-white sm:text-2xl">
        {String(valor).padStart(2, '0')}
      </span>
      <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">
        {etiqueta}
      </span>
    </div>
  )
}

/** Tarjeta difuminada de un producto que todavía no salió. */
function TarjetaBloqueada({ imagen, revelado }: { imagen: string | null; revelado: boolean }) {
  const contenido = (
    <div className="flex h-full flex-col">
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-neutral-200">
        {imagen && (
          <ImagenSegura
            carpeta="productos"
            src={imagen}
            alt="Vista previa del próximo lanzamiento"
            loading="lazy"
            decoding="async"
            className={`absolute inset-0 h-full w-full object-cover object-[center_20%] transition-all duration-700 ${
              revelado ? '' : 'scale-110 blur-lg'
            }`}
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          {revelado ? (
            <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-neutral-900 shadow">
              Ya disponible
            </span>
          ) : (
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </span>
          )}
        </div>
      </div>
      <div className={`flex flex-col gap-1.5 pt-3 ${revelado ? 'invisible' : ''}`}>
        <span className="h-3 w-4/5 rounded bg-neutral-200" />
        <span className="h-4 w-1/2 rounded bg-neutral-200" />
      </div>
    </div>
  )

  return revelado ? (
    <Link to="/catalogo" aria-label="Ver los productos ya disponibles">
      {contenido}
    </Link>
  ) : (
    contenido
  )
}

interface Props {
  vista: DropVista
  onRevelar: () => void
}

/**
 * Sección destacada de un drop. Mientras no se lanzó, muestra las tarjetas
 * difuminadas y una cuenta regresiva. Al llegar a cero, revela en vivo y avisa
 * al padre para recargar los datos completos (la RLS ya los habilita).
 */
export function DropSection({ vista, onRevelar }: Props) {
  const { drop, lanzado, productos, previews } = vista
  const cuenta = useCountdown(drop.fecha_lanzamiento)
  const revelado = lanzado || cuenta.terminado
  const avisadoRef = useRef(false)

  useEffect(() => {
    if (!revelado || lanzado || avisadoRef.current) return
    avisadoRef.current = true
    // Pequeña espera por diferencia de reloj cliente/servidor.
    const t = window.setTimeout(onRevelar, 3000)
    return () => window.clearTimeout(t)
  }, [revelado, lanzado, onRevelar])

  const hayCards = productos.length > 0 || previews.length > 0
  if (!hayCards) return null

  return (
    <section className="py-10 md:py-14 w-full">
      <div className="px-3 sm:px-5">
        <div className="overflow-hidden rounded-2xl bg-neutral-900 text-white">
          <div className="flex flex-col gap-5 px-5 py-6 sm:px-8 sm:py-8 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/60">
                {revelado ? 'Ya disponible' : 'Lanzamiento exclusivo'}
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
                {drop.titulo}
              </h2>
              {drop.descripcion && (
                <p className="mt-2 max-w-xl text-sm text-white/70">{drop.descripcion}</p>
              )}
            </div>

            {!revelado && (
              <div className="shrink-0">
                <p className="mb-3 text-sm text-white/80">
                  Nuevo stock disponible en{' '}
                  <span className="font-semibold text-white">¡No te lo pierdas!</span>
                </p>
                <div className="flex items-start gap-2 sm:gap-3">
                  <BloqueTiempo valor={cuenta.dias} etiqueta="Días" />
                  <BloqueTiempo valor={cuenta.horas} etiqueta="Hs" />
                  <BloqueTiempo valor={cuenta.minutos} etiqueta="Min" />
                  <BloqueTiempo valor={cuenta.segundos} etiqueta="Seg" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-5">
          {revelado
            ? productos.length > 0
              ? productos.map((p) => <ProductCard key={p.id} producto={p} />)
              : previews.map((p) => (
                  <TarjetaBloqueada key={p.producto_id} imagen={p.imagen} revelado />
                ))
            : previews.map((p) => (
                <TarjetaBloqueada key={p.producto_id} imagen={p.imagen} revelado={false} />
              ))}
        </div>
      </div>
    </section>
  )
}
