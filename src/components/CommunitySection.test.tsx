import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: [] }),
          })),
        })),
      })),
    })),
  },
}))

import { CommunitySection } from './CommunitySection'

describe('CommunitySection', () => {
  it('permite deslizar las fotos en el visor y actualiza el contador', async () => {
    render(<CommunitySection />)

    fireEvent.click(await screen.findByLabelText('Ver foto ampliada de @lucas.fit'))

    const visor = await screen.findByLabelText('Visor de fotos de la comunidad')
    expect(screen.getByText('1 de 8')).toBeInTheDocument()

    fireEvent.touchStart(visor, { touches: [{ clientX: 240, clientY: 140 }] })
    fireEvent.touchMove(visor, { touches: [{ clientX: 170, clientY: 144 }] })
    fireEvent.touchEnd(visor, { changedTouches: [{ clientX: 130, clientY: 144 }] })

    await waitFor(() => {
      expect(screen.getByText('2 de 8')).toBeInTheDocument()
    })
  })
})
