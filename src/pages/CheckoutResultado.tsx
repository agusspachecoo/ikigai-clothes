import { useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCart } from '../context/cart'

interface Props {
  status: 'success' | 'failure' | 'pending'
}

const CONFIG = {
  success: {
    title: '¡Pago aprobado!',
    description:
      'Tu pago fue confirmado y tu pedido ya está en proceso. Te notificaremos cuando esté listo.',
    icon: (
      <svg className="h-10 w-10 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    ),
    iconBox: 'bg-success/10',
    link: { to: '/catalogo', label: 'Seguir comprando', color: 'btn-primary' },
  },
  failure: {
    title: 'El pago no pudo completarse',
    description: 'No se realizó ningún cargo. Podés intentar nuevamente o elegir otro medio de pago.',
    icon: (
      <svg className="h-10 w-10 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    iconBox: 'bg-error/10',
    link: { to: '/checkout', label: 'Reintentar pago', color: 'btn-primary' },
  },
  pending: {
    title: 'Pago pendiente',
    description:
      'Tu pago está siendo procesado. Confirmalo desde Mercado Pago o esperá la acreditación.',
    icon: (
      <svg className="h-10 w-10 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    iconBox: 'bg-warning/10',
    link: { to: '/catalogo', label: 'Volver a la tienda', color: 'btn-primary' },
  },
} satisfies Record<Props['status'], {
  title: string
  description: string
  icon: React.ReactNode
  iconBox: string
  link: { to: string; label: string; color: string }
}>

export function CheckoutResultado({ status }: Props) {
  const [searchParams] = useSearchParams()
  const { vaciar } = useCart()
  const limpiado = useRef(false)

  useEffect(() => {
    if (status === 'success' && !limpiado.current) {
      limpiado.current = true
      vaciar()
    }
  }, [status, vaciar])

  const cfg = CONFIG[status]
  const orderRef = searchParams.get('external_reference') ?? ''

  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <div
        className={`${cfg.iconBox} w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6`}
      >
        {cfg.icon}
      </div>
      <h2 className="text-2xl font-bold">{cfg.title}</h2>
      <p className="opacity-60 mt-2">{cfg.description}</p>

      {status !== 'failure' && orderRef && (
        <p className="font-mono text-sm bg-base-200 rounded-lg px-3 py-2 inline-block mt-3">
          Pedido: <span className="font-bold">{orderRef.slice(0, 8).toUpperCase()}</span>
        </p>
      )}

      <Link to={cfg.link.to} className={`btn ${cfg.link.color} btn-block mt-8`}>
        {cfg.link.label}
      </Link>
    </div>
  )
}