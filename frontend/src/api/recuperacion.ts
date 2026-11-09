import { api } from "@/api/client"

export type RespuestaMensaje = { mensaje: string }

export function solicitarRecuperacion(
  email: string,
): Promise<RespuestaMensaje> {
  return api.post<RespuestaMensaje>(
    "/auth/forgot-password",
    JSON.stringify({ email }),
  )
}

export function restablecerContrasena(
  token: string,
  password: string,
): Promise<RespuestaMensaje> {
  return api.post<RespuestaMensaje>(
    "/auth/reset-password",
    JSON.stringify({ token, password }),
  )
}
