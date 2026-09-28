export function RatingProducto({
  promedio,
  cantidad,
  className = '',
}: {
  promedio: number
  cantidad: number
  className?: string
}) {
  if (cantidad === 0) return null

  const estrellasLlenas = Math.round(promedio)

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span className="flex gap-0.5" aria-label={`${promedio.toLocaleString('es-AR')} de 5 estrellas`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Estrella key={n} rellena={n <= estrellasLlenas} />
        ))}
      </span>
      <span className="text-xs font-semibold leading-none">{promedio.toLocaleString('es-AR')}</span>
      <span className="text-xs opacity-60 leading-none">
        ({cantidad} {cantidad === 1 ? 'reseña' : 'reseñas'})
      </span>
    </div>
  )
}

function Estrella({ rellena }: { rellena: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 ${rellena ? 'text-warning' : 'text-base-300'}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" />
    </svg>
  )
}