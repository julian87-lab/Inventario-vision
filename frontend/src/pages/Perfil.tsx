import { useState } from "react"
import type { FormEvent } from "react"
import { CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react"

import { ApiError } from "@/api/client"
import { cambiarContrasena } from "@/api/cuenta"
import { useAuth } from "@/auth/context"
import { CampoContrasena } from "@/components/auth/CampoContrasena"
import { Button } from "@/components/ui/button"
import { EditarNombre } from "@/components/auth/EditarNombre"

export default function Perfil() {
  const { user } = useAuth()

  const [actual, setActual] = useState("")
  const [nueva, setNueva] = useState("")
  const [confirmacion, setConfirmacion] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (!user) return null

  const esAdministrador = user.rol === "administrador"

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (enviando) return

    setError(null)
    setMensaje(null)

    if (nueva.length < 8) {
      setError("La contraseña nueva debe tener al menos 8 caracteres.")
      return
    }

    if (nueva === actual) {
      setError("La contraseña nueva debe ser distinta de la actual.")
      return
    }

    if (nueva !== confirmacion) {
      setError("Las contraseñas nuevas no coinciden.")
      return
    }

    setEnviando(true)

    try {
      await cambiarContrasena(actual, nueva)
      setActual("")
      setNueva("")
      setConfirmacion("")
      setMensaje(
        "Contraseña actualizada. Cerramos tus otras sesiones; esta sigue abierta."
      )
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudo conectar con el servidor. Inténtalo de nuevo."
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-primary">Mi cuenta</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Perfil</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Consulta los datos de tu cuenta y cambia tu contraseña.
        </p>
      </header>

      <EditarNombre key={user.id} nombreActual={user.nombre} />

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Datos de la cuenta</h2>

        <dl className="mt-4 grid gap-5 sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">Nombre</dt>
            <dd className="mt-1 font-medium break-words">{user.nombre}</dd>
          </div>

          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">Correo</dt>
            <dd className="mt-1 font-medium break-all">{user.email}</dd>
          </div>

          <div>
            <dt className="text-xs text-muted-foreground">Rol</dt>
            <dd className="mt-1">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                  esAdministrador
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {esAdministrador ? "Administrador" : "Operador"}
              </span>
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Cambiar contraseña</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Al cambiarla, se cierran tus sesiones en otros dispositivos.
        </p>

        <form onSubmit={enviar} aria-busy={enviando} className="mt-5 max-w-md">
          <fieldset disabled={enviando} className="min-w-0 space-y-5">
            <legend className="sr-only">Cambiar contraseña</legend>

            <CampoContrasena
              id="contrasena-actual"
              etiqueta="Contraseña actual"
              value={actual}
              onChange={setActual}
              autoComplete="current-password"
              invalido={error !== null}
              descripcionId={error ? "error-perfil" : undefined}
            />

            <CampoContrasena
              id="contrasena-nueva-perfil"
              etiqueta="Contraseña nueva"
              value={nueva}
              onChange={setNueva}
              autoComplete="new-password"
              invalido={error !== null}
              descripcionId={error ? "error-perfil" : undefined}
            />

            <CampoContrasena
              id="confirmacion-perfil"
              etiqueta="Repite la contraseña nueva"
              value={confirmacion}
              onChange={setConfirmacion}
              autoComplete="new-password"
              invalido={error !== null}
              descripcionId={error ? "error-perfil" : undefined}
            />

            {error && (
              <p
                id="error-perfil"
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                <CircleAlert
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span>{error}</span>
              </p>
            )}

            {mensaje && (
              <p
                role="status"
                className="flex items-start gap-2 rounded-xl border border-emerald-600/30 bg-emerald-600/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300"
              >
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <span>{mensaje}</span>
              </p>
            )}

            <Button type="submit" className="min-h-11 w-full sm:w-auto">
              {enviando ? (
                <>
                  <LoaderCircle
                    className="mr-2 size-4 motion-safe:animate-spin"
                    aria-hidden="true"
                  />
                  Guardando…
                </>
              ) : (
                "Cambiar contraseña"
              )}
            </Button>
          </fieldset>
        </form>
      </section>
    </div>
  )
}
