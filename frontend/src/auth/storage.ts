const CLAVE_TOKEN = "token"

export function guardarSesion(token: string): void {
  localStorage.setItem(CLAVE_TOKEN, token)
}

export function limpiarSesion(): void {
  localStorage.removeItem(CLAVE_TOKEN)
}

export function obtenerToken(): string | null {
  return localStorage.getItem(CLAVE_TOKEN)
}
