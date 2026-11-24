import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WhatsAppButton } from './WhatsAppButton'

describe('WhatsAppButton', () => {
  it('expone el gancho para desplazarlo cuando aparece la barra de compra', () => {
    render(<WhatsAppButton />)

    const enlace = screen.getByRole('link', { name: 'Contactanos por WhatsApp' })
    expect(enlace).toHaveClass('whatsapp-flotante', 'bottom-20')
  })
})
