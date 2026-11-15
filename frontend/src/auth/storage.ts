import { clearToken, getToken, setToken } from "@/api/client"

export function guardarSesion(token: string): void {
  setToken(token)
}

export function limpiarSesion(): void {
  clearToken()
}

export function obtenerToken(): string | null {
  return getToken()
}
