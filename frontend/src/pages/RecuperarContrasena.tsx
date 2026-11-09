import { useEffect, useRef, useState } from "react"
import type { FormEvent } from "react"
import { Link } from "react-router-dom"
import {
  ArrowLeft,
  CircleAlert,
  LoaderCircle,
  MailCheck,
} from "lucide-react"

import { ApiError } from "@/api/client"
import { solicitarRecuperacion } from "@/api/recuperacion"
import { AuthLayout } from "@/components/auth/AuthLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const ESPERA_REENVIO_SEGUNDOS = 60

export default function RecuperarContrasena() {
  const [email, setEmail] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [espera, setEspera] = useState(0)
  const titulo = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (espera <= 0) return

    const temporizador = window.setTimeout(
      () => setEspera((segundos) => segundos - 1),
      1000,
    )

    return () => window.clearTimeout(temporizador)
  }, [espera])

  useEffect(() => {
    if (enviado) titulo.current?.focus()
  }, [enviado])

  async function solicitar() {
    if (enviando || espera > 0) return

    setError(null)
    setEnviando(true)

    try {
      await solicitarRecuperacion(email.trim())
      setEnviado(true)
      setEspera(ESPERA_REENVIO_SEGUNDOS)
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

  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void solicitar()
  }

  return (
    <AuthLayout>
      <Link
        to="/login"
        className="inline-flex items-center gap-1.5 rounded text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver a iniciar sesión
      </Link>

      {enviado ? (
        <section className="mt-6">
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MailCheck className="size-6" aria-hidden="true" />
          </span>

          <h1
            id="titulo-auth"
            ref={titulo}
            tabIndex={-1}
            className="mt-4 text-2xl font-semibold tracking-tight focus:outline-none sm:text-3xl"
          >
            Revisa tu correo
          </h1>

          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Si el correo está registrado, enviamos un enlace para elegir una
            contraseña nueva. Vence en pocos minutos y solo puede usarse una
            vez. Revisa también la carpeta de spam.
          </p>

          {error && (
            <p
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              <CircleAlert
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>{error}</span>
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            className="mt-6 min-h-12 w-full rounded-xl"
            disabled={enviando || espera > 0}
            onClick={() => void solicitar()}
          >
            {espera > 0
              ? `Enviar de nuevo en ${espera} s`
              : "Enviar de nuevo"}
          </Button>
        </section>
      ) : (
        <>
          <header className="mt-6">
            <p className="text-xs font-medium tracking-wide text-primary uppercase">
              Recuperar acceso
            </p>
            <h1
              id="titulo-auth"
              className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              ¿Olvidaste tu contraseña?
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Escribe el correo de tu cuenta y te enviaremos un enlace para
              elegir una contraseña nueva.
            </p>
          </header>

          <form onSubmit={enviar} aria-busy={enviando} className="mt-6">
            <fieldset disabled={enviando} className="min-w-0 space-y-5">
              <legend className="sr-only">Recuperar contraseña</legend>

              <div className="grid gap-2">
                <Label htmlFor="correo-recuperacion">
                  Correo electrónico
                </Label>
                <Input
                  id="correo-recuperacion"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={error !== null}
                  aria-describedby={error ? "error-recuperacion" : undefined}
                  className="h-12 rounded-xl bg-background text-base"
                />
              </div>

              {error && (
                <p
                  id="error-recuperacion"
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
                    Enviando…
                  </>
                ) : (
                  "Enviar enlace"
                )}
              </Button>
            </fieldset>
          </form>

          <p className="mt-6 text-xs leading-5 text-muted-foreground">
            ¿No recuerdas tu correo? Por seguridad no podemos mostrarlo aquí:
            pídele a quien administra la tienda que lo consulte.
          </p>
        </>
      )}
    </AuthLayout>
  )
}
