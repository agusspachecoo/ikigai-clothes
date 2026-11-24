import type { ReactNode } from 'react'

type Variante = 'claro' | 'oscuro'

function Badge({
  etiqueta,
  variante,
  children,
}: {
  etiqueta: string
  variante: Variante
  children: ReactNode
}) {
  return (
    <span
      role="img"
      aria-label={etiqueta}
      title={etiqueta}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[4px] border ${
        variante === 'oscuro'
          ? 'border-white/15 shadow-sm shadow-black/20'
          : 'border-black/15 shadow-2xs'
      }`}
    >
      {children}
    </span>
  )
}

export function MediosPagoBadges({
  variante = 'claro',
  compacto = false,
  className = '',
}: {
  variante?: Variante
  compacto?: boolean
  className?: string
}) {
  const alto = compacto ? 'h-6' : 'h-7'

  return (
    <div
      role="group"
      aria-label="Medios de pago aceptados"
      className={`flex max-w-full flex-wrap items-center gap-2 ${className}`}
    >
      {/* VISA */}
      <Badge etiqueta="Visa" variante={variante}>
        <span className={`inline-flex ${alto} items-center bg-white px-2.5`}>
          <span className="font-sans text-[13px] font-black italic tracking-tighter text-[#1a1f71] leading-none">
            VISA
          </span>
        </span>
      </Badge>

      {/* MASTERCARD */}
      <Badge etiqueta="Mastercard" variante={variante}>
        <span className={`inline-flex ${alto} items-center bg-white px-2.5`}>
          <svg viewBox="0 0 36 22" className="h-4 w-auto" aria-hidden="true" focusable="false">
            <circle cx="13" cy="11" r="8.5" fill="#eb001b" />
            <circle cx="23" cy="11" r="8.5" fill="#f79e1b" />
            <path d="M18 3.9a8.5 8.5 0 000 14.2 8.5 8.5 0 000-14.2z" fill="#ff5f00" />
          </svg>
        </span>
      </Badge>

      {/* AMEX */}
      <Badge etiqueta="American Express" variante={variante}>
        <span className={`inline-flex ${alto} items-center bg-[#2e77bc] px-2.5`}>
          <span className="font-sans text-[11px] font-extrabold tracking-wider text-white leading-none">
            AMEX
          </span>
        </span>
      </Badge>

      {/* MERCADO PAGO */}
      <Badge etiqueta="Mercado Pago" variante={variante}>
        <span className={`inline-flex ${alto} items-center gap-1.5 bg-[#009ee3] px-2.5`}>
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0" fill="none" aria-hidden="true" focusable="false">
            <circle cx="10" cy="10" r="8.5" stroke="#ffffff" strokeWidth="1.6" />
            <path
              d="M6.5 10.5l2.2 2.2 4.8-4.8"
              stroke="#ffffff"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="font-sans text-[11px] font-bold tracking-tight text-white leading-none">
            Mercado Pago
          </span>
        </span>
      </Badge>

      {/* TRANSFERENCIA */}
      <Badge etiqueta="Transferencia bancaria" variante={variante}>
        <span className={`inline-flex ${alto} items-center gap-1.5 bg-white px-2.5 text-neutral-900`}>
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0" fill="none" aria-hidden="true" focusable="false">
            <path d="M2.5 8L10 3.5L17.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M4.5 8v6.5M8.2 8v6.5M11.8 8v6.5M15.5 8v6.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M2 16.5h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="font-sans text-[11px] font-semibold tracking-tight leading-none">
            Transferencia
          </span>
        </span>
      </Badge>
    </div>
  )
}