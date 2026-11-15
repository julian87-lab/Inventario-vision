import { useEffect, useState } from "react"

import {
  clearToken,
  getToken,
  SESION_VENCIDA_EVENTO,
} from "@/api/client"

export function FotoDeteccion({ deteccionId }: { deteccionId: number }) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    let objectUrl: string | null = null

    setSrc(null)
    setError(false)

    async function cargar() {
      try {
        const token = getToken()

        if (!token) {
          throw new Error("No hay una sesión disponible.")
        }

        const response = await fetch(
          `/api/detecciones/${deteccionId}/imagen`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
            signal: controller.signal,
          },
        )

        if (controller.signal.aborted) return

        if (response.status === 401) {
          // No elimina una sesión nueva si esta petición pertenece
          // a un token anterior.
          if (getToken() === token) {
            clearToken()
            window.dispatchEvent(new Event(SESION_VENCIDA_EVENTO))
          }

          throw new Error("La sesión ya no es válida.")
        }

        if (!response.ok) {
          throw new Error("No se pudo cargar la foto.")
        }

        const blob = await response.blob()

        if (controller.signal.aborted) return

        objectUrl = URL.createObjectURL(blob)
        setSrc(objectUrl)
      } catch {
        if (!controller.signal.aborted) {
          setError(true)
        }
      }
    }

    void cargar()

    return () => {
      controller.abort()

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [deteccionId])

  if (error) {
    return (
      <div className="flex min-h-56 items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No se pudo cargar la foto. Puedes volver a abrir esta pestaña para
        intentarlo de nuevo.
      </div>
    )
  }

  if (!src) {
    return (
      <div
        role="status"
        className="h-64 rounded-xl bg-muted motion-safe:animate-pulse"
      >
        <span className="sr-only">Cargando foto…</span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={`Foto de la recepción ${deteccionId}`}
      className="max-h-96 w-full rounded-xl border border-border bg-background object-contain"
    />
  )
}
