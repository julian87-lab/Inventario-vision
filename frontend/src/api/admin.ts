import { api } from "@/api/client"
import type {
  EventoAuditoria,
  Invitacion,
  Rol,
  UsuarioAdmin,
} from "@/types/api"

export function obtenerUsuarios(): Promise<UsuarioAdmin[]> {
  return api.get<UsuarioAdmin[]>("/admin/usuarios")
}

export function modificarUsuario(
  id: number,
  cambios: { rol?: Rol; activo?: boolean },
): Promise<UsuarioAdmin> {
  return api.patch<UsuarioAdmin>(
    `/admin/usuarios/${id}`,
    JSON.stringify(cambios),
  )
}

export function obtenerInvitaciones(): Promise<Invitacion[]> {
  return api.get<Invitacion[]>("/admin/invitaciones?limite=100")
}

export function crearInvitacion(
  email: string,
  rol: Rol,
): Promise<Invitacion> {
  return api.post<Invitacion>(
    "/admin/invitaciones",
    JSON.stringify({ email, rol }),
  )
}

export function revocarInvitacion(id: number): Promise<Invitacion> {
  return api.post<Invitacion>(`/admin/invitaciones/${id}/revocar`)
}

export function reenviarInvitacion(id: number): Promise<Invitacion> {
  return api.post<Invitacion>(`/admin/invitaciones/${id}/reenviar`)
}

export function obtenerAuditoria(): Promise<EventoAuditoria[]> {
  return api.get<EventoAuditoria[]>("/admin/auditoria?limite=100")
}
