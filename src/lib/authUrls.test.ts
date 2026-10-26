import { describe, expect, it } from 'vitest'
import { RESET_PASSWORD_PATH, urlRestablecerPassword } from './authUrls'

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
