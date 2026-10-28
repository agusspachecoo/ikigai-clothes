import { describe, expect, it } from 'vitest'
import {
  RESET_PASSWORD_PATH,
  leerRecuperacionDeUrl,
  urlRestablecerPassword,
} from './authUrls'

describe('urlRestablecerPassword', () => {
  it('usa el path de restablecimiento sobre el origin actual', () => {
    expect(urlRestablecerPassword('https://ikigai-clothes.vercel.app')).toBe(
      `https://ikigai-clothes.vercel.app${RESET_PASSWORD_PATH}`,
    )
  })

  it('funciona con localhost y puerto', () => {
    expect(urlRestablecerPassword('http://localhost:5173')).toBe(
      `http://localhost:5173${RESET_PASSWORD_PATH}`,
    )
  })
})

describe('leerRecuperacionDeUrl', () => {
  it('captura los tokens del flujo implícito desde el hash', () => {
    const datos = leerRecuperacionDeUrl(
      'https://ikigai-clothes.vercel.app/#access_token=token-abc&refresh_token=refresh-abc&type=recovery',
    )

    expect(datos).toMatchObject({
      esRecuperacion: true,
      accessToken: 'token-abc',
      refreshToken: 'refresh-abc',
    })
  })

  it('detecta el flujo PKCE por code en la ruta de restablecimiento', () => {
    expect(
      leerRecuperacionDeUrl(
        'https://ikigai-clothes.vercel.app/restablecer-password?code=code-abc',
      ),
    ).toMatchObject({
      esRecuperacion: true,
      code: 'code-abc',
    })
  })

  it('detecta token_hash y tipo recovery en query', () => {
    expect(
      leerRecuperacionDeUrl(
        'https://ikigai-clothes.vercel.app/restablecer-password?token_hash=hash-abc&type=recovery',
      ),
    ).toMatchObject({
      esRecuperacion: true,
      tokenHash: 'hash-abc',
    })
  })

  it('no confunde un code de otro flujo en una ruta distinta', () => {
    expect(
      leerRecuperacionDeUrl('https://ikigai-clothes.vercel.app/?code=code-abc'),
    ).toMatchObject({
      esRecuperacion: false,
      code: 'code-abc',
    })
  })
})
