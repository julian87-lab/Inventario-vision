import { useCallback, useEffect, useRef, useState } from "react"
import type { FormEvent } from "react"
import { RefreshCw } from "lucide-react"

import {
  crearInvitacion,
  modificarUsuario,
  obtenerAuditoria,
  obtenerInvitaciones,
  obtenerUsuarios,
  reenviarInvitacion,
  revocarInvitacion,
} from "@/api/admin"
import { ApiError } from "@/api/client"
import { useAuth } from "@/auth/context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type {
  EventoAuditoria,
  Invitacion,
  Rol,
  UsuarioAdmin,
} from "@/types/api"

type Pestana = "usuarios" | "invitaciones" | "auditoria"

const CAMPO =
  "min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"

const ROLES: Record<Rol, string> = {
  administrador: "Administrador",
  operador: "Operador",
}

const ACCIONES: Record<string, string> = {
  administrador_creado: "Administrador creado",
  administrador_promovido: "Administrador promovido",
  invitacion_creada: "Invitación creada",
  invitacion_reenviada: "Invitación reenviada",
  invitacion_revocada: "Invitación revocada",
  usuario_registrado: "Usuario registrado",
  usuario_activado: "Usuario activado",
  usuario_desactivado: "Usuario desactivado",
  rol_cambiado: "Rol cambiado",
  contrasena_cambiada: "Contraseña cambiada",
  contrasena_restablecida: "Contraseña restablecida",
  perfil_actualizado: "Nombre de perfil actualizado",
}

function fecha(valor: string): string {
  return new Date(valor).toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function mensajeError(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "No se pudo completar la solicitud. Revisa tu conexión."
}

function esRol(valor: string): valor is Rol {
  return valor === "administrador" || valor === "operador"
}

function EstadoInvitacion({ estado }: { estado: Invitacion["estado"] }) {
  const estilos: Record<Invitacion["estado"], string> = {
    pendiente:
      "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
    usada:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    revocada: "bg-muted text-muted-foreground",
    vencida: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  }

  const etiquetas: Record<Invitacion["estado"], string> = {
    pendiente: "Pendiente",
    usada: "Usada",
    revocada: "Revocada",
    vencida: "Vencida",
  }

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${estilos[estado]}`}
    >
      {etiquetas[estado]}
    </span>
  )
}

export default function Administracion() {
  const { user } = useAuth()

  const [pestana, setPestana] = useState<Pestana>("usuarios")
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([])
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([])
  const [auditoria, setAuditoria] = useState<EventoAuditoria[]>([])

  const [email, setEmail] = useState("")
  const [rolInvitado, setRolInvitado] = useState<Rol>("operador")

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [datosDisponibles, setDatosDisponibles] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)

  const bloqueo = useRef(false)
  const solicitudCarga = useRef<Promise<void> | null>(null)

  const cargar = useCallback((): Promise<void> => {
    if (solicitudCarga.current) return solicitudCarga.current

    setCargando(true)

    const solicitud = (async () => {
      try {
        const [listaUsuarios, listaInvitaciones, listaAuditoria] =
          await Promise.all([
            obtenerUsuarios(),
            obtenerInvitaciones(),
            obtenerAuditoria(),
          ])

        setUsuarios(listaUsuarios)
        setInvitaciones(listaInvitaciones)
        setAuditoria(listaAuditoria)
        setDatosDisponibles(true)
      } catch (err) {
        setError(
          `${mensajeError(err)} No se pudo actualizar el panel; si ya había datos, pueden estar desactualizados.`
        )
      } finally {
        setCargando(false)
        solicitudCarga.current = null
      }
    })()

    solicitudCarga.current = solicitud
    return solicitud
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const ocupado = cargando || guardando

  async function ejecutar(
    tarea: () => Promise<unknown>,
    confirmacion: string
  ): Promise<void> {
    if (bloqueo.current || solicitudCarga.current) return

    bloqueo.current = true
    setGuardando(true)
    setError(null)
    setMensaje(null)

    try {
      await tarea()
      setMensaje(confirmacion)
      await cargar()
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      bloqueo.current = false
      setGuardando(false)
    }
  }

  async function invitar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const correo = email.trim().toLowerCase()

    if (!correo) {
      setError("Escribe el correo de la persona invitada.")
      return
    }

    const aceptado = window.confirm(
      `¿Enviar una invitación a ${correo} con el rol de ${ROLES[rolInvitado]}?`
    )

    if (!aceptado) return

    await ejecutar(async () => {
      await crearInvitacion(correo, rolInvitado)
      setEmail("")
      setRolInvitado("operador")
    }, "Invitación creada. Se programó el envío del correo; la entrega depende del servicio de correo.")
  }

  function cambiarRol(usuario: UsuarioAdmin, valor: string) {
    if (!esRol(valor) || valor === usuario.rol) return
    if (usuario.id === user?.id) return

    const aceptado = window.confirm(
      `¿Cambiar el rol de ${usuario.nombre} (${usuario.email}) de ${ROLES[usuario.rol]} a ${ROLES[valor]}?`
    )

    if (!aceptado) return

    void ejecutar(
      () => modificarUsuario(usuario.id, { rol: valor }),
      "Rol actualizado."
    )
  }

  function cambiarEstado(usuario: UsuarioAdmin) {
    if (usuario.id === user?.id) return

    const accion = usuario.activo ? "desactivar" : "activar"
    const aviso = usuario.activo
      ? " Perderá acceso al sistema y se invalidarán sus sesiones."
      : " Podrá volver a iniciar sesión."

    const aceptado = window.confirm(
      `¿${accion === "activar" ? "Activar" : "Desactivar"} a ${usuario.nombre} (${usuario.email})?${aviso}`
    )

    if (!aceptado) return

    void ejecutar(
      () => modificarUsuario(usuario.id, { activo: !usuario.activo }),
      usuario.activo ? "Usuario desactivado." : "Usuario activado."
    )
  }

  function reenviar(invitacion: Invitacion) {
    const aceptado = window.confirm(
      `¿Generar una invitación nueva para ${invitacion.email} con rol de ${ROLES[invitacion.rol]}? Los enlaces anteriores pendientes dejarán de funcionar.`
    )

    if (!aceptado) return

    void ejecutar(
      () => reenviarInvitacion(invitacion.id),
      "Nueva invitación creada. Se programó el envío del correo."
    )
  }

  function revocar(invitacion: Invitacion) {
    const aceptado = window.confirm(
      `¿Revocar la invitación de ${invitacion.email}? Ese enlace ya no permitirá crear una cuenta.`
    )

    if (!aceptado) return

    void ejecutar(
      () => revocarInvitacion(invitacion.id),
      "Invitación revocada."
    )
  }

  const tabs: { id: Pestana; nombre: string }[] = [
    { id: "usuarios", nombre: "Usuarios" },
    { id: "invitaciones", nombre: "Invitaciones" },
    { id: "auditoria", nombre: "Auditoría" },
  ]

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Control de acceso</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Administración
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Gestiona el acceso del personal a esta tienda.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          disabled={ocupado}
          onClick={() => {
            setError(null)
            setMensaje(null)
            void cargar()
          }}
        >
          <RefreshCw
            className={`mr-2 size-4 ${
              cargando ? "motion-safe:animate-spin" : ""
            }`}
            aria-hidden="true"
          />
          {cargando ? "Actualizando…" : "Actualizar"}
        </Button>
      </header>

      <nav
        aria-label="Secciones de administración"
        className="flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-2"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-current={pestana === tab.id ? "page" : undefined}
            onClick={() => {
              setPestana(tab.id)
              setError(null)
              setMensaje(null)
            }}
            className={`min-h-11 rounded-xl px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
              pestana === tab.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {tab.nombre}
          </button>
        ))}
      </nav>

      {cargando && (
        <p role="status" className="text-sm text-muted-foreground">
          Consultando usuarios, invitaciones y auditoría…
        </p>
      )}

      {guardando && (
        <p role="status" className="text-sm text-primary">
          Guardando cambios…
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {mensaje && (
        <p
          role="status"
          className="rounded-xl border border-emerald-600/30 bg-emerald-600/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300"
        >
          {mensaje}
        </p>
      )}

      {pestana === "usuarios" && datosDisponibles && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Personal de la tienda</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              No puedes modificar tu propio rol ni desactivar tu cuenta. Los
              usuarios no se eliminan para conservar su historial.
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {usuarios.map((usuario) => {
              const propia = usuario.id === user?.id

              return (
                <article
                  key={usuario.id}
                  className="min-w-0 space-y-4 rounded-2xl border border-border bg-card p-5"
                >
                  <header className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold break-words">
                        {usuario.nombre}
                        {propia ? " (tú)" : ""}
                      </h3>
                      <p className="mt-1 text-sm break-all text-muted-foreground">
                        {usuario.email}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                        usuario.activo
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {usuario.activo ? "Activo" : "Desactivado"}
                    </span>
                  </header>

                  <p className="text-xs text-muted-foreground">
                    Cuenta creada: {fecha(usuario.creado_en)}
                  </p>

                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div className="grid gap-2">
                      <label
                        htmlFor={`rol-usuario-${usuario.id}`}
                        className="text-sm font-medium"
                      >
                        Rol
                      </label>
                      <select
                        id={`rol-usuario-${usuario.id}`}
                        value={usuario.rol}
                        disabled={ocupado || propia}
                        onChange={(event) =>
                          cambiarRol(usuario, event.target.value)
                        }
                        className={CAMPO}
                      >
                        <option value="operador">Operador</option>
                        <option value="administrador">Administrador</option>
                      </select>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      disabled={ocupado || propia}
                      onClick={() => cambiarEstado(usuario)}
                      className="min-h-11"
                    >
                      {usuario.activo ? "Desactivar" : "Activar"}
                    </Button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      {pestana === "invitaciones" && (
        <section className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Invitar a una persona</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Recibirá un enlace para elegir su nombre y contraseña. Asigna el
              rol de administrador únicamente a personal autorizado.
            </p>

            <form onSubmit={invitar} className="mt-5">
              <fieldset
                disabled={ocupado || !datosDisponibles}
                className="grid min-w-0 gap-4 md:grid-cols-[1.5fr_1fr_auto] md:items-end"
              >
                <legend className="sr-only">Nueva invitación</legend>

                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="email-invitacion">Correo electrónico</Label>
                  <Input
                    id="email-invitacion"
                    type="email"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={255}
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="rol-invitacion">Rol</Label>
                  <select
                    id="rol-invitacion"
                    className={CAMPO}
                    value={rolInvitado}
                    onChange={(event) => {
                      if (esRol(event.target.value)) {
                        setRolInvitado(event.target.value)
                      }
                    }}
                  >
                    <option value="operador">Operador</option>
                    <option value="administrador">Administrador</option>
                  </select>
                </div>

                <Button type="submit" className="min-h-11">
                  Enviar invitación
                </Button>
              </fieldset>
            </form>
          </div>

          {datosDisponibles && (
            <>
              <div>
                <h2 className="text-lg font-semibold">
                  Historial de invitaciones
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Se muestran hasta 100 invitaciones. Pulsa Actualizar para
                  consultar los estados más recientes.
                </p>
              </div>

              {invitaciones.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  Todavía no hay invitaciones.
                </p>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {invitaciones.map((invitacion) => {
                    const usada = invitacion.estado === "usada"

                    return (
                      <article
                        key={invitacion.id}
                        className="min-w-0 space-y-4 rounded-2xl border border-border bg-card p-5"
                      >
                        <header className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="font-medium break-all">
                              {invitacion.email}
                            </h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {ROLES[invitacion.rol]}
                            </p>
                          </div>

                          <EstadoInvitacion estado={invitacion.estado} />
                        </header>

                        <dl className="space-y-1 text-xs text-muted-foreground">
                          <div>
                            <dt className="inline">Creada: </dt>
                            <dd className="inline">
                              {fecha(invitacion.creada_en)}
                            </dd>
                          </div>
                          <div>
                            <dt className="inline">Vencimiento: </dt>
                            <dd className="inline">
                              {fecha(invitacion.expira_en)}
                            </dd>
                          </div>
                        </dl>

                        {!usada && (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              disabled={ocupado}
                              onClick={() => reenviar(invitacion)}
                            >
                              Reenviar
                            </Button>

                            {invitacion.estado === "pendiente" && (
                              <Button
                                type="button"
                                variant="outline"
                                disabled={ocupado}
                                onClick={() => revocar(invitacion)}
                              >
                                Revocar
                              </Button>
                            )}
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {pestana === "auditoria" && datosDisponibles && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Actividad de acceso</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Últimos 100 eventos registrados. Los movimientos de inventario se
              consultan en Operaciones → Historial.
            </p>
          </div>

          {auditoria.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              Todavía no hay eventos registrados.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  Historial de administración y seguridad de las cuentas
                </caption>
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th scope="col" className="p-4 font-medium">
                      Fecha
                    </th>
                    <th scope="col" className="p-4 font-medium">
                      Responsable
                    </th>
                    <th scope="col" className="p-4 font-medium">
                      Acción
                    </th>
                    <th scope="col" className="p-4 font-medium">
                      Detalle
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {auditoria.map((evento) => {
                    const actor = usuarios.find(
                      (usuario) => usuario.id === evento.usuario_id
                    )

                    return (
                      <tr key={evento.id} className="border-t border-border">
                        <td className="p-4 whitespace-nowrap text-muted-foreground">
                          {fecha(evento.fecha_hora)}
                        </td>
                        <td className="p-4">
                          {evento.usuario_id === null
                            ? "Sistema / consola"
                            : (actor?.nombre ??
                              `Usuario #${evento.usuario_id}`)}
                        </td>
                        <td className="p-4 font-medium">
                          {ACCIONES[evento.accion] ?? evento.accion}
                        </td>
                        <td className="max-w-lg p-4 break-words text-muted-foreground">
                          {evento.detalle ??
                            `${evento.objeto_tipo} #${evento.objeto_id ?? "—"}`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
