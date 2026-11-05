import { useEffect, useRef } from "react"
import { LoaderCircle, X } from "lucide-react"

import type { ItemConfirmado } from "@/api/operaciones"
import { Button } from "@/components/ui/button"

export type AccionRecepcion =
  | {
      tipo: "confirmar"
      deteccionId: number
      items: ItemConfirmado[]
    }
  | {
      tipo: "descartar"
      deteccionId: number
    }

export function DialogoRecepcion({
  accion,
  guardando,
  error,
  nombreProducto,
  cerrar,
  ejecutar,
}: {
  accion: AccionRecepcion
  guardando: boolean
  error: string | null
  nombreProducto: (id: number) => string
  cerrar: () => void
  ejecutar: () => void
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const confirmar = accion.tipo === "confirmar"
  const total =
    accion.tipo === "confirmar"
      ? accion.items.reduce((suma, item) => suma + item.cantidad_confirmada, 0)
      : 0

  useEffect(() => {
    const elemento = dialogo.current
    if (elemento && !elemento.open) elemento.showModal()

    return () => {
      if (elemento?.open) elemento.close()
    }
  }, [])

  return (
    <dialog
      ref={dialogo}
      aria-labelledby="titulo-confirmacion-recepcion"
      aria-describedby="descripcion-confirmacion-recepcion"
      onCancel={(event) => {
        event.preventDefault()
        if (!guardando) cerrar()
      }}
      className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/60"
    >
      <div className="space-y-5 p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-primary">
              Recepción #{accion.deteccionId}
            </p>
            <h2
              id="titulo-confirmacion-recepcion"
              className="mt-2 text-xl font-semibold"
            >
              {confirmar
                ? "Confirmar entrada de mercancía"
                : "Descartar recepción"}
            </h2>
          </div>

          <button
            type="button"
            aria-label="Cerrar confirmación"
            disabled={guardando}
            onClick={cerrar}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>

        <p
          id="descripcion-confirmacion-recepcion"
          className="text-sm leading-6 text-muted-foreground"
        >
          {confirmar
            ? "Estas cantidades se sumarán a las existencias. Revisa el resumen antes de continuar."
            : "La propuesta dejará de estar pendiente. Descartarla no modifica las existencias."}
        </p>

        {accion.tipo === "confirmar" && (
          <>
            <ul className="max-h-60 divide-y divide-border overflow-y-auto rounded-xl border border-border">
              {accion.items.map((item) => (
                <li
                  key={item.producto_id}
                  className="flex items-center justify-between gap-4 p-3 text-sm"
                >
                  <span>{nombreProducto(item.producto_id)}</span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    +{item.cantidad_confirmada}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between rounded-xl bg-primary/10 p-4 text-sm">
              <span>Total de unidades a añadir</span>
              <span className="text-xl font-semibold tabular-nums">
                {total}
              </span>
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            autoFocus
            disabled={guardando}
            onClick={cerrar}
          >
            Volver a revisar
          </Button>

          <Button
            type="button"
            disabled={guardando}
            onClick={ejecutar}
            className={
              confirmar
                ? ""
                : "bg-destructive text-white hover:bg-destructive/90"
            }
          >
            {guardando ? (
              <>
                <LoaderCircle
                  className="mr-2 size-4 motion-safe:animate-spin"
                  aria-hidden="true"
                />
                Guardando…
              </>
            ) : confirmar ? (
              "Confirmar y actualizar stock"
            ) : (
              "Sí, descartar"
            )}
          </Button>
        </div>
      </div>
    </dialog>
  )
}