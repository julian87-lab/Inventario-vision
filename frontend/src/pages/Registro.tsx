import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { Link } from "react-router-dom"
import {
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react"

import { ApiError } from "@/api/client"
import { consultarInvitacion, registrarCuenta } from "@/api/cuenta"
import { AuthLayout } from "@/components/auth/AuthLayout"
import { CampoContrasena } from "@/components/auth/CampoContrasena"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { InvitacionInfo, Rol } from "@/types/api"

const CLASE_ENLACE =
  "mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"

const ETIQUETA_ROL: Record<Rol, string> = {
  administrador: "Administrador",
  operador: "Operador",
}

type Estado = "cargando" | "valida" | "invalida" | "fallo" | "creada"

function leerTokenDelEnlace(): string {
  const parametros = new URLSearchParams(
    window.location.hash.replace(/^#/, ""),
  )
  return parametros.get("token") ?? ""
}

export default function Registro() {
  const [token] = useState(leerTokenDelEnlace)
  const [estado, setEstado] = useState<Estado>(
    token ? "cargando" : "invalida",
  )
  const [invitacion, setInvitacion] = useState<InvitacionInfo | null>(null)
  const [nombre, setNombre] = useState("")
  const [password, setPassword] = useState("")
  const [confirmacion, setConfirmacion] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      )
    }
  }, [])

  useEffect(() => {
    if (!token) return

    let activo = true

    consultarInvitacion(token)
      .then((datos) => {
        if (!activo) return
        setInvitacion(datos)
        setEstado("valida")
      })
      .catch((err: unknown) => {
        if (!activo) return
        setEstado(
          err instanceof ApiError && err.status === 400
            ? "invalida"
            : "fallo",
        )
      })

    return () => {
      activo = false
    }
  }, [token])

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (enviando) return

    setError(null)

    const nombreLimpio = nombre.trim().replace(/\s+/g, " ")

    if (nombreLimpio.length < 2) {
      setError("Escribe tu nombre (mínimo 2 caracteres).")
      return
    }

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
      await registrarCuenta({ token, nombre: nombreLimpio, password })
      setEstado("creada")
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setEstado("invalida")
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

  if (estado === "cargando") {
    return (
      <AuthLayout>
        <h1
          id="titulo-auth"
          className="text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Validando invitación
        </h1>
        <p
          role="status"
          className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"
        >
          <LoaderCircle
            className="size-4 motion-safe:animate-spin"
            aria-hidden="true"
          />
          Un momento, estamos revisando tu enlace.
        </p>
      </AuthLayout>
    )
  }

  if (estado === "invalida" || estado === "fallo") {
    const sinConexion = estado === "fallo"

    return (
      <AuthLayout>
        <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <CircleAlert className="size-6" aria-hidden="true" />
        </span>

        <h1
          id="titulo-auth"
          className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          {sinConexion ? "No pudimos validar el enlace" : "Invitación no válida"}
        </h1>

        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {sinConexion
            ? "Hubo un problema de conexión. Vuelve a abrir el enlace desde tu correo para intentarlo de nuevo."
            : "La invitación está incompleta, ya se usó, fue revocada o venció. Pide una nueva al administrador de la tienda."}
        </p>

        <Link to="/login" className={CLASE_ENLACE}>
          Ir a iniciar sesión
        </Link>
      </AuthLayout>
    )
  }

  if (estado === "creada") {
    return (
      <AuthLayout>
        <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="size-6" aria-hidden="true" />
        </span>

        <h1
          id="titulo-auth"
          className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Cuenta creada
        </h1>

        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Ya puedes iniciar sesión con tu correo y la contraseña que acabas
          de elegir.
        </p>

        <Link to="/login" className={CLASE_ENLACE}>
          Ir a iniciar sesión
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <header>
        <p className="text-xs font-medium tracking-wide text-primary uppercase">
          Invitación
        </p>
        <h1
          id="titulo-auth"
          className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Crea tu cuenta
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Te invitaron a Inventario Visión. Completa tu nombre y elige una
          contraseña.
        </p>
      </header>

      {invitacion && (
        <div className="mt-5 rounded-xl border border-border bg-muted/50 p-4 text-sm">
          <p className="text-xs text-muted-foreground">Correo de la cuenta</p>
          <p className="mt-1 font-medium break-all">{invitacion.email}</p>

          <p className="mt-3 text-xs text-muted-foreground">Rol asignado</p>
          <p className="mt-1 flex items-center gap-1.5 font-medium">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            {ETIQUETA_ROL[invitacion.rol]}
          </p>
        </div>
      )}

      <form onSubmit={enviar} aria-busy={enviando} className="mt-6">
        <fieldset disabled={enviando} className="min-w-0 space-y-5">
          <legend className="sr-only">Datos de la cuenta</legend>

          <div className="grid gap-2">
            <Label htmlFor="nombre-registro">Nombre</Label>
            <Input
              id="nombre-registro"
              name="nombre"
              autoComplete="name"
              maxLength={120}
              required
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              aria-invalid={error !== null}
              aria-describedby={error ? "error-registro" : undefined}
              className="h-12 rounded-xl bg-background text-base"
            />
          </div>

          <CampoContrasena
            id="contrasena-registro"
            etiqueta="Contraseña"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            invalido={error !== null}
            descripcionId={error ? "error-registro" : undefined}
          />

          <CampoContrasena
            id="confirmacion-registro"
            etiqueta="Repite la contraseña"
            value={confirmacion}
            onChange={setConfirmacion}
            autoComplete="new-password"
            invalido={error !== null}
            descripcionId={error ? "error-registro" : undefined}
          />

          <p className="text-xs leading-5 text-muted-foreground">
            Mínimo 8 caracteres. Una frase larga es más segura y fácil de
            recordar.
          </p>

          {error && (
            <p
              id="error-registro"
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
                Creando cuenta…
              </>
            ) : (
              "Crear cuenta"
            )}
          </Button>
        </fieldset>
      </form>
    </AuthLayout>
  )
}
