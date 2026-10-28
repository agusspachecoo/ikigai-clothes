import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AuthField } from './AuthField'

describe('AuthField', () => {
  it('alterna la visibilidad de la contraseña y expone el estado accesible', async () => {
    const user = userEvent.setup()
    render(<AuthField label="Contraseña" type="password" />)

    const input = screen.getByLabelText('Contraseña') as HTMLInputElement
    expect(input).toHaveAttribute('type', 'password')

    const mostrar = screen.getByRole('button', { name: 'Mostrar contraseña' })
    expect(mostrar).toHaveAttribute('aria-pressed', 'false')

    await user.click(mostrar)

    expect(input).toHaveAttribute('type', 'text')
    const ocultar = screen.getByRole('button', { name: 'Ocultar contraseña' })
    expect(ocultar).toHaveAttribute('aria-pressed', 'true')

    await user.click(ocultar)

    expect(input).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Mostrar contraseña' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('conserva el foco y la selección al alternar la visibilidad', async () => {
    const user = userEvent.setup()
    render(<AuthField label="Contraseña" type="password" defaultValue="secreto" />)

    const input = screen.getByLabelText('Contraseña') as HTMLInputElement
    await user.click(input)
    input.setSelectionRange(2, 5)

    await user.click(screen.getByRole('button', { name: 'Mostrar contraseña' }))

    expect(input).toHaveFocus()
    expect(input.selectionStart).toBe(2)
    expect(input.selectionEnd).toBe(5)
  })

  it('usa un borde visible en los campos de autenticación', () => {
    render(<AuthField label="Email" type="email" />)

    expect(screen.getByLabelText('Email')).toHaveClass('border-neutral-300')
  })

  it('no muestra el toggle en campos que no son contraseña', () => {
    render(<AuthField label="Email" type="email" />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
