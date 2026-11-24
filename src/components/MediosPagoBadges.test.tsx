import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MediosPagoBadges } from './MediosPagoBadges'

describe('MediosPagoBadges', () => {
  it('muestra logos accesibles de cada medio de pago', () => {
    render(<MediosPagoBadges />)

    const grupo = screen.getByRole('group', { name: 'Medios de pago aceptados' })
    expect(screen.getByRole('img', { name: 'Visa' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Mastercard' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'American Express' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Mercado Pago' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Transferencia bancaria' })).toBeInTheDocument()
    expect(grupo).toHaveClass('flex', 'max-w-full', 'flex-wrap')
  })

  it('mantiene contraste sobre fondo oscuro', () => {
    render(<MediosPagoBadges variante="oscuro" />)

    const visa = screen.getByRole('img', { name: 'Visa' })
    expect(visa).toHaveClass('border-white/15', 'shadow-sm', 'shadow-black/20')
    expect(visa).not.toHaveClass('shadow-2xs')
    expect(visa.firstElementChild).toHaveClass('bg-white')
  })

  it('reduce la altura en la variante compacta', () => {
    const { rerender } = render(<MediosPagoBadges />)
    expect(screen.getByRole('img', { name: 'Visa' }).firstElementChild).toHaveClass('h-7')

    rerender(<MediosPagoBadges compacto />)
    expect(screen.getByRole('img', { name: 'Visa' }).firstElementChild).toHaveClass('h-6')
  })
})
