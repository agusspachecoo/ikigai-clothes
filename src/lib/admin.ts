const ADMIN_USER = import.meta.env.VITE_ADMIN_USER ?? 'admin'
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? 'ikigai2026'
const STORAGE_KEY = 'ikigai-admin-session'

export const DEFAULT_CREDENTIALS = !import.meta.env.VITE_ADMIN_USER && !import.meta.env.VITE_ADMIN_PASSWORD

export function loginAdmin(usuario: string, password: string) {
  if (usuario.trim() === ADMIN_USER && password === ADMIN_PASSWORD) {
    localStorage.setItem(STORAGE_KEY, '1')
    return true
  }
  return false
}

export function logoutAdmin() {
  localStorage.removeItem(STORAGE_KEY)
}

export function isAdminAuthed() {
  return localStorage.getItem(STORAGE_KEY) === '1'
}