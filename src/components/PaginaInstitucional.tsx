import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Breadcrumbs } from '../components/Breadcrumbs'

/** Contenedor común de las páginas institucionales. */
export function PaginaInstitucional({
  titulo,
  bajada,
  children,
  migas,
}: {
  titulo: string
  bajada?: string
  children: ReactNode
  migas?: { label: string; to?: string }[]
}) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <Breadcrumbs items={migas ?? [{ label: 'Inicio', to: '/' }, { label: titulo }]} />

      <header className="border-b border-line pb-6 mb-8">
        <h1 className="font-display text-3xl">{titulo}</h1>
        {bajada && <p className="mt-2 text-sm opacity-70 max-w-2xl">{bajada}</p>}
      </header>

      <div className="space-y-8 text-sm leading-relaxed">{children}</div>
    </div>
  )
}

export function BloqueFaq({
  titulo,
  children,
}: {
  titulo: string
  children: ReactNode
}) {
  return (
    <section>
      <h2 className="font-display text-xl mb-3">{titulo}</h2>
      <div className="divide-y divide-line border-t border-line">{children}</div>
    </section>
  )
}

export function Pregunta({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group py-3">
      <summary className="cursor-pointer list-none flex items-center justify-between gap-4 text-sm font-medium">
        {q}
        <span className="opacity-40 group-open:rotate-45 transition-transform text-lg leading-none">
          +
        </span>
      </summary>
      <div className="mt-2 text-sm opacity-70">{children}</div>
    </details>
  )
}

export function BotonContacto() {
  return (
    <Link to="/contacto" className="btn btn-primary rounded-none px-8">
      Escribinos
    </Link>
  )
}
