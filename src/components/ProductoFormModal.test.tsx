import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProductoFormModal } from './ProductoFormModal'
import type { ProductoConStock } from '../types/database'

const mocks = vi.hoisted(() => ({
  guardarProducto: vi.fn(),
}))

vi.mock('../lib/adminApi', () => ({
  guardarProducto: mocks.guardarProducto,
}))

vi.mock('../context/tienda', () => ({
  useTienda: () => ({ descuento_transferencia: 0.2 }),
}))

vi.mock('../hooks/useCierreModal', () => ({
  useCierreModal: () => undefined,
}))

vi.mock('./ImageUploader', () => ({
  ImageUploader: ({ onUrls }: { onUrls?: (urls: string[], cantidad?: number) => void }) => (
    <div>
      <button type="button" onClick={() => onUrls?.(['https://cdn.test/una.webp'], 1)}>
        subir una
      </button>
      <button
        type="button"
        onClick={() =>
          onUrls?.(['https://cdn.test/dos.webp', 'https://cdn.test/tres.webp'], 2)
        }
      >
        subir dos
      </button>
    </div>
  ),
}))

vi.mock('./ImagenSegura', () => ({
  ImagenSegura: ({ src, alt }: { src?: string | null; alt?: string }) => (
    <img src={src ?? ''} alt={alt} />
  ),
}))

function producto(discountPercent = 0): ProductoConStock {
  return {
    id: 'prod-1',
    nombre: 'Remera Test',
    descripcion: null,
    categoria: 'Remeras',
    precio: 50000,
    precio_transferencia: 40000,
    discount_percent: discountPercent,
    imagenes: ['https://cdn.test/principal.webp'],
    activo: true,
    drop_id: null,
    created_at: '2026-01-01T00:00:00Z',
    variaciones_stock: [],
  }
}

function renderModal(discountPercent = 0) {
  return render(
    <MemoryRouter>
      <ProductoFormModal
        producto={producto(discountPercent)}
        categorias={['Remeras']}
        tallesSugeridos={['S', 'M']}
        onCerrar={() => undefined}
        onGuardado={() => undefined}
      />
    </MemoryRouter>,
  )
}

const inputTransferencia = () => screen.getByLabelText(/Precio de Transferencia \(\$\)/)
const inputLista = () => screen.getByLabelText(/Precio de Lista \/ Web \(\$\)/)
const inputDescuento = () => screen.getByLabelText(/Descuento Promocional \/ OFF/)
const boton = (name: string) => screen.getByRole('button', { name, hidden: true })
const urlsGaleria = () =>
  screen
    .getAllByRole('img', { hidden: true })
    .map((img) => img.getAttribute('src'))
    .filter((src): src is string => Boolean(src))

beforeEach(() => {
  mocks.guardarProducto.mockReset()
  mocks.guardarProducto.mockResolvedValue({ error: null })
})

describe('ProductoFormModal: precios en vivo', () => {
  it('muestra los importes finales derivados del producto guardado', () => {
    renderModal()

    expect(inputTransferencia()).toHaveValue(40000)
    expect(inputLista()).toHaveValue(50000)
  })

  it('actualiza ambos inputs al cambiar el descuento sin esperar a guardar', () => {
    renderModal()

    fireEvent.change(inputDescuento(), { target: { value: '10' } })
    expect(inputTransferencia()).toHaveValue(36000)
    expect(inputLista()).toHaveValue(45000)

    fireEvent.change(inputDescuento(), { target: { value: '20' } })
    expect(inputTransferencia()).toHaveValue(32000)
    expect(inputLista()).toHaveValue(40000)
    expect(mocks.guardarProducto).not.toHaveBeenCalled()
  })

  it('mantiene la relacion lista = transferencia / 0.8 al editar cualquier input', () => {
    renderModal()

    fireEvent.change(inputTransferencia(), { target: { value: '40000' } })
    expect(inputLista()).toHaveValue(50000)

    fireEvent.change(inputLista(), { target: { value: '60000' } })
    expect(inputTransferencia()).toHaveValue(48000)
  })

  it('guarda los precios base invirtiendo el descuento para no descontar dos veces', async () => {
    renderModal(10)

    expect(inputTransferencia()).toHaveValue(36000)
    expect(inputLista()).toHaveValue(45000)

    fireEvent.click(boton( 'Guardar producto'))

    await vi.waitFor(() => expect(mocks.guardarProducto).toHaveBeenCalledTimes(1))
    expect(mocks.guardarProducto).toHaveBeenCalledWith(
      expect.objectContaining({
        precio: 50000,
        precio_transferencia: 40000,
        discount_percent: 10,
      }),
    )
  })
})

describe('ProductoFormModal: imágenes', () => {
  it('una sola imagen reemplaza la principal sin duplicarla', () => {
    renderModal()

    fireEvent.click(boton( 'subir una'))

    expect(urlsGaleria()).toEqual(['https://cdn.test/una.webp'])
  })

  it('varias imágenes se anexan en orden sin duplicados', () => {
    renderModal()

    fireEvent.click(boton( 'subir dos'))
    fireEvent.click(boton( 'subir dos'))

    expect(urlsGaleria()).toEqual([
      'https://cdn.test/principal.webp',
      'https://cdn.test/dos.webp',
      'https://cdn.test/tres.webp',
    ])
  })

  it('permite reordenar, quitar y guarda el array resultante', async () => {
    renderModal()

    fireEvent.click(boton( 'subir dos'))
    fireEvent.click(boton( 'Mover imagen 2 antes'))
    expect(urlsGaleria()).toEqual([
      'https://cdn.test/dos.webp',
      'https://cdn.test/principal.webp',
      'https://cdn.test/tres.webp',
    ])

    fireEvent.click(boton( 'Quitar imagen 1'))
    expect(urlsGaleria()).toEqual([
      'https://cdn.test/principal.webp',
      'https://cdn.test/tres.webp',
    ])

    fireEvent.click(boton( 'Guardar producto'))
    await vi.waitFor(() => expect(mocks.guardarProducto).toHaveBeenCalledTimes(1))
    expect(mocks.guardarProducto).toHaveBeenCalledWith(
      expect.objectContaining({
        imagenes: ['https://cdn.test/principal.webp', 'https://cdn.test/tres.webp'],
      }),
    )
  })
})
