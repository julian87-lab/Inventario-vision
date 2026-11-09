import { useState } from "react"
import type { FormEvent, KeyboardEvent } from "react"
import { Link, Navigate } from "react-router-dom"
import {
  CircleAlert,
  Eye,
  EyeOff,
  Info,
  LoaderCircle,
} from "lucide-react"

import { ApiError } from "@/api/client"
import { useAuth } from "@/auth/context"
import { AuthLayout } from "@/components/auth/AuthLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function Login() {
  const { user, aviso, signIn } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [mostrar, setMostrar] = useState(false)
  const [mayusculas, setMayusculas] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (user) {
    return <Navigate to="/inicio" replace />
  }

  function detectarMayusculas(
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    setMayusculas(event.getModifierState("CapsLock"))
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (enviando) return

    setError(null)
    setEnviando(true)

    try {
      await signIn(email.trim(), password)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.",
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <AuthLayout>
      <header>
        <p className="text-xs font-medium tracking-wide text-primary uppercase">
          Acceso a tu tienda
        </p>

        <h1
          id="titulo-auth"
          className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Bienvenido de nuevo
        </h1>

        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Ingresa para gestionar tu mercancía.
        </p>
      </header>

      {aviso && (
        <p
          role="status"
          className="mt-5 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
        >
          <Info
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <span>{aviso}</span>
        </p>
      )}

      <form
        onSubmit={enviar}
        aria-busy={enviando}
        className="mt-6"
      >
        <fieldset
          disabled={enviando}
          className="min-w-0 space-y-5"
        >
          <legend className="sr-only">
            Iniciar sesión
          </legend>

          <div className="grid gap-2">
            <Label htmlFor="correo">
              Correo electrónico
            </Label>

            <Input
              id="correo"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={255}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={error !== null}
              aria-describedby={
                error ? "error-login" : undefined
              }
              className="h-12 rounded-xl bg-background text-base"
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="contrasena">
                Contraseña
              </Label>

              <Link
                to="/recuperar-contrasena"
                className="rounded text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <div className="relative">
              <Input
                id="contrasena"
                name="password"
                type={mostrar ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                onKeyDown={detectarMayusculas}
                onKeyUp={detectarMayusculas}
                onBlur={() => setMayusculas(false)}
                aria-invalid={error !== null}
                aria-describedby={
                  [
                    error ? "error-login" : "",
                    mayusculas ? "aviso-mayusculas" : "",
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
                className="h-12 rounded-xl bg-background pr-12 text-base"
              />

              <button
                type="button"
                aria-label={
                  mostrar
                    ? "Ocultar contraseña"
                    : "Mostrar contraseña"
                }
                aria-pressed={mostrar}
                aria-controls="contrasena"
                onClick={() =>
                  setMostrar((valor) => !valor)
                }
                className="absolute top-0.5 right-0.5 inline-flex size-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
              >
                {mostrar ? (
                  <EyeOff
                    className="size-4"
                    aria-hidden="true"
                  />
                ) : (
                  <Eye
                    className="size-4"
                    aria-hidden="true"
                  />
                )}
              </button>
            </div>

            {mayusculas && (
              <p
                id="aviso-mayusculas"
                role="status"
                className="text-xs text-muted-foreground"
              >
                Tienes activado el bloqueo de mayúsculas.
              </p>
            )}
          </div>

          {error && (
            <p
              id="error-login"
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
                Ingresando…
              </>
            ) : (
              "Ingresar"
            )}
          </Button>
        </fieldset>
      </form>

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        El registro es por invitación. Si necesitas una cuenta,
        solicítala al administrador de la tienda y abre el enlace
        que recibirás por correo.
      </p>
    </AuthLayout>
  )
}
