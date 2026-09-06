const ADMIN_USER = import.meta.env.VITE_ADMIN_USER ?? 'admin'
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? 'ikigai2026'
const STORAGE_KEY = 'ikigai-admin-session'

export const DEFAULT_CREDENTIALS = !import.meta.env.VITE_ADMIN_USER && !import.meta.env.VITE_ADMIN_PASSWORD

function storageGet(key: string) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function storageSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // almacenamiento no disponible (modo incógnito, etc.): la sesión vive en memoria
  }
}

function storageRemove(key: string) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignorar
  }
}

export function loginAdmin(usuario: string, password: string) {
  if (usuario.trim() === ADMIN_USER && password === ADMIN_PASSWORD) {
    storageSet(STORAGE_KEY, '1')
    return true
  }
  return false
}

export function logoutAdmin() {
  storageRemove(STORAGE_KEY)
}

export function isAdminAuthed() {
  return storageGet(STORAGE_KEY) === '1'
}