import { useRef, useState } from "react"
import type { FormEvent } from "react"

import { ApiError } from "@/api/client"
import { actualizarPerfil } from "@/api/cuenta"
import { useAuth } from "@/auth/context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function EditarNombre({
  nombreActual,
}: {
  nombreActual: string
}) {
  const { actualizarUsuario } = useAuth()

  const [nombre, setNombre] = useState(nombreActual)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)

  const bloqueo = useRef(false)

  const nombreLimpio = nombre.trim().replace(/\s+/g, " ")
  const hayCambios = nombreLimpio !== nombreActual

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (bloqueo.current || !hayCambios) return

    setError(null)
    setMensaje(null)

    if (nombreLimpio.length < 2 || nombreLimpio.length > 120) {
      setError("El nombre debe tener entre 2 y 120 caracteres.")
      return
    }

    bloqueo.current = true
    setGuardando(true)

    try {
      const usuario = await actualizarPerfil(nombreLimpio)

      actualizarUsuario(usuario)
      setNombre(usuario.nombre)
      setMensaje("Tu nombre se actualizó correctamente.")
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudo conectar con el servidor. Inténtalo de nuevo.",
      )
    } finally {
      bloqueo.current = false
      setGuardando(false)
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Cambiar mi nombre</h2>

      <p className="mt-1 text-sm text-muted-foreground">
        Este nombre se muestra en tu perfil y en la cabecera.
        No cambia tu correo ni tus permisos.
      </p>

      <form
        onSubmit={enviar}
        aria-busy={guardando}
        className="mt-5 max-w-md"
      >
        <fieldset
          disabled={guardando}
          className="min-w-0 space-y-4"
        >
          <legend className="sr-only">Actualizar mi nombre</legend>

          <div className="grid gap-2">
            <Label htmlFor="nombre-perfil">Nombre</Label>

            <Input
              id="nombre-perfil"
              name="nombre"
              autoComplete="name"
              required
              maxLength={120}
              value={nombre}
              onChange={(event) => {
                setNombre(event.target.value)
                setError(null)
                setMensaje(null)
              }}
              aria-invalid={error !== null}
              aria-describedby={
                error ? "error-nombre-perfil" : undefined
              }
              className="h-12 rounded-xl bg-background text-base"
            />
          </div>

          {error && (
            <p
              id="error-nombre-perfil"
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

          <Button
            type="submit"
            disabled={guardando || !hayCambios}
            className="min-h-11 w-full sm:w-auto"
          >
            {guardando ? "Guardando…" : "Guardar nombre"}
          </Button>
        </fieldset>
      </form>
    </section>
  )
}
