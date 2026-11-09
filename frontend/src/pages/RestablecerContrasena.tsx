import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { Link } from "react-router-dom"
import { CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react"

import { ApiError } from "@/api/client"
import { restablecerContrasena } from "@/api/recuperacion"
import { AuthLayout } from "@/components/auth/AuthLayout"
import { CampoContrasena } from "@/components/auth/CampoContrasena"
import { Button } from "@/components/ui/button"

const CLASE_BOTON = "mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"

function leerTokenDelEnlace(): string {
  const parametros = new URLSearchParams(
    window.location.hash.replace(/^#/, ""),
  )
  return parametros.get("token") ?? ""
}

export default function RestablecerContrasena() {
  const [token] = useState(leerTokenDelEnlace)
  const [password, setPassword] = useState("")
  const [confirmacion, setConfirmacion] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState(false)
  const [enlaceInvalido, setEnlaceInvalido] = useState(false)

  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      )
    }
  }, [])

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (enviando) return

    setError(null)

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.")
      return
    }

    if (password !== confirmacion) {
      setError("Las contraseñas no coinciden.")
      return
    }

    setEnviando(true)

    try {
      await restablecerContrasena(token, password)
      setListo(true)
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setEnlaceInvalido(true)
      } else {
        setError(
          err instanceof ApiError
            ? err.message
            : "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.",
        )
      }
    } finally {
      setEnviando(false)
    }
  }

  if (!token || enlaceInvalido) {
    return (
      <AuthLayout>
        <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <CircleAlert className="size-6" aria-hidden="true" />
        </span>

        <h1
          id="titulo-auth"
          className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Enlace no válido
        </h1>

        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          El enlace está incompleto, ya se usó o venció. Solicita uno nuevo
          para continuar.
        </p>

        <Link to="/recuperar-contrasena" className={CLASE_BOTON}>
          Solicitar un enlace nuevo
        </Link>
      </AuthLayout>
    )
  }

  if (listo) {
    return (
      <AuthLayout>
        <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="size-6" aria-hidden="true" />
        </span>

        <h1
          id="titulo-auth"
          className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Contraseña actualizada
        </h1>

        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Ya puedes iniciar sesión con tu contraseña nueva. Cerramos tus
          sesiones anteriores por seguridad.
        </p>

        <Link to="/login" className={CLASE_BOTON}>
          Ir a iniciar sesión
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <header>
        <p className="text-xs font-medium tracking-wide text-primary uppercase">
          Recuperar acceso
        </p>

        <h1
          id="titulo-auth"
          className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Elige una contraseña nueva
        </h1>

        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Usa al menos 8 caracteres. Una frase larga es más segura y más
          fácil de recordar.
        </p>
      </header>

      <form onSubmit={enviar} aria-busy={enviando} className="mt-6">
        <fieldset disabled={enviando} className="min-w-0 space-y-5">
          <legend className="sr-only">Contraseña nueva</legend>

          <CampoContrasena
            id="contrasena-nueva"
            etiqueta="Contraseña nueva"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            invalido={error !== null}
            descripcionId={error ? "error-restablecer" : undefined}
          />

          <CampoContrasena
            id="contrasena-confirmacion"
            etiqueta="Repite la contraseña"
            value={confirmacion}
            onChange={setConfirmacion}
            autoComplete="new-password"
            invalido={error !== null}
            descripcionId={error ? "error-restablecer" : undefined}
          />

          {error && (
            <p
              id="error-restablecer"
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

          <Button
            type="submit"
            className="min-h-12 w-full rounded-xl text-base"
          >
            {enviando ? (
              <>
                <LoaderCircle
                  className="mr-2 size-4 motion-safe:animate-spin"
                  aria-hidden="true"
                />
                Guardando…
              </>
            ) : (
              "Guardar contraseña"
            )}
          </Button>
        </fieldset>
      </form>
    </AuthLayout>
  )
}
