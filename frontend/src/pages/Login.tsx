import { useState } from "react"
import type { FormEvent, KeyboardEvent } from "react"
import { Navigate } from "react-router-dom"
import {
  Boxes,
  Camera,
  CircleAlert,
  ClipboardCheck,
  Eye,
  EyeOff,
  LoaderCircle,
  ScanLine,
} from "lucide-react"

import { ApiError } from "@/api/client"
import { useAuth } from "@/auth/context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const PASOS = [
  {
    icono: Camera,
    titulo: "Fotografía",
    texto: "Toma una foto de la mercancía que llegó.",
  },
  {
    icono: ClipboardCheck,
    titulo: "Revisa",
    texto: "Corrige las cantidades si hace falta.",
  },
  {
    icono: Boxes,
    titulo: "Confirma",
    texto: "El stock cambia solo cuando tú lo apruebas.",
  },
]

function Marca() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground lg:bg-primary-foreground lg:text-primary">
        <ScanLine className="size-6" aria-hidden="true" />
      </span>
      <span>
        <span className="block text-base font-semibold tracking-tight">
          Inventario Visión
        </span>
        <span className="block text-xs opacity-80">
          Gestión de mercancía
        </span>
      </span>
    </div>
  )
}

export default function Login() {
  const { user, signIn } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [mostrar, setMostrar] = useState(false)
  const [mayusculas, setMayusculas] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (user) {
    return <Navigate to="/inicio" replace />
  }

  function detectarMayusculas(event: KeyboardEvent<HTMLInputElement>) {
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
    <div className="grid min-h-dvh bg-background text-foreground lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-3 bg-[repeating-linear-gradient(90deg,#fbbf24_0_28px,transparent_28px_56px)]"
        />
        <div
          aria-hidden="true"
          className="absolute -right-24 -bottom-24 size-96 rounded-full bg-primary-foreground/10"
        />

        <Marca />

        <div className="relative max-w-lg">
          <h1 className="text-5xl leading-tight font-semibold tracking-tight">
            Tu inventario, a la vista.
          </h1>
          <p className="mt-5 text-lg leading-8 opacity-90">
            Recibe mercancía con una fotografía y mantén tus existencias al
            día, sin contar producto por producto.
          </p>

          <ol className="mt-10 space-y-5">
            {PASOS.map(({ icono: Icono, titulo, texto }, indice) => (
              <li key={titulo} className="flex items-start gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15">
                  <Icono className="size-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-medium">
                    {indice + 1}. {titulo}
                  </span>
                  <span className="block text-sm opacity-90">{texto}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <p className="relative text-sm opacity-90">
          Detección con revisión humana · Proyecto académico
        </p>
      </aside>

      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden">
            <Marca />
          </div>

          <div>
            <h2 className="text-3xl font-semibold tracking-tight">
              Bienvenido de nuevo
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ingresa para gestionar tu mercancía.
            </p>
          </div>

          <form onSubmit={enviar} className="space-y-5">
            <fieldset disabled={enviando} className="min-w-0 space-y-5">
              <legend className="sr-only">Iniciar sesión</legend>

              <div className="grid gap-2">
                <Label htmlFor="correo">Correo</Label>
                <Input
                  id="correo"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={error !== null}
                  aria-describedby={error ? "error-login" : undefined}
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="contrasena">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="contrasena"
                    type={mostrar ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyDown={detectarMayusculas}
                    onKeyUp={detectarMayusculas}
                    onBlur={() => setMayusculas(false)}
                    aria-invalid={error !== null}
                    aria-describedby={error ? "error-login" : undefined}
                    className="h-11 rounded-xl pr-12"
                  />
                  <button
                    type="button"
                    aria-label={
                      mostrar ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                    aria-pressed={mostrar}
                    onClick={() => setMostrar((valor) => !valor)}
                    className="absolute top-1 right-1 inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    {mostrar ? (
                      <EyeOff className="size-4" aria-hidden="true" />
                    ) : (
                      <Eye className="size-4" aria-hidden="true" />
                    )}
                  </button>
                </div>

                {mayusculas && (
                  <p role="status" className="text-xs text-muted-foreground">
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
                  {error}
                </p>
              )}

              <Button type="submit" className="min-h-12 w-full">
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
        </div>
      </main>
    </div>
  )
}
