import { api, setToken } from "@/api/client"
import type { RespuestaMensaje } from "@/api/recuperacion"
import type { InvitacionInfo, Token, Usuario } from "@/types/api"

export function consultarInvitacion(token: string): Promise<InvitacionInfo> {
  return api.post<InvitacionInfo>(
    "/auth/invitacion/consultar",
    JSON.stringify({ token }),
  )
}

export function registrarCuenta(datos: {
  token: string
  nombre: string
  password: string
}): Promise<RespuestaMensaje> {
  return api.post<RespuestaMensaje>("/auth/registro", JSON.stringify(datos))
}

export async function cambiarContrasena(
  actual: string,
  nueva: string,
): Promise<void> {
  const respuesta = await api.post<Token>(
    "/auth/change-password",
    JSON.stringify({ actual, nueva }),
  )

  // El servidor cierra las demás sesiones y devuelve un token nuevo
  // para que esta siga abierta.
  setToken(respuesta.access_token)
}


export function actualizarPerfil(nombre: string): Promise<Usuario> {
  return api.patch<Usuario>(
    "/auth/me",
    JSON.stringify({ nombre }),
  )
}