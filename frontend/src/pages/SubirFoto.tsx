import { useEffect, useState } from "react"
import type { ChangeEvent, FormEvent } from "react"
import { Camera, ImagePlus, LoaderCircle } from "lucide-react"

import { analizarRecepcion } from "@/api/operaciones"
import { Button } from "@/components/ui/button"
import type { Operaciones } from "@/hooks/useOperaciones"
import { prepararImagenParaSubida } from "@/lib/imagenes"
import { mensajeError } from "@/lib/inventario"

export default function SubirFoto({
  operaciones,
}: {
  operaciones: Operaciones
}) {
  const { ocupado, escribir, setError, setMensaje } = operaciones

  const [archivo, setArchivo] = useState<File | null>(null)
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)

  useEffect(() => {
    if (!archivo) {
      setVistaPrevia(null)
      return
    }

    const url = URL.createObjectURL(archivo)
    setVistaPrevia(url)
    return () => URL.revokeObjectURL(url)
  }, [archivo])

  function seleccionarArchivo(event: ChangeEvent<HTMLInputElement>) {
    const seleccionado = event.target.files?.[0]
    if (seleccionado) setArchivo(seleccionado)
    event.target.value = ""
  }

  async function enviarFoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (ocupado) return

    setError(null)
    setMensaje(null)

    const imagen = archivo

    if (!imagen) {
      setError("Toma una foto o elige una imagen de la galería.")
      return
    }

    setSubiendo(true)

    const resultado = await escribir(
      async () => analizarRecepcion(await prepararImagenParaSubida(imagen)),
      (deteccion) => {
        setArchivo(null)
        setMensaje(
          `Foto procesada. La recepción #${deteccion.id} está pendiente de revisión; el stock aún no cambió.`,
        )
      },
    )

    setSubiendo(false)

    if (resultado.estado === "error") {
      setError(
        mensajeError(resultado.error, "No se pudo subir y procesar la foto."),
      )
    }
  }

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">Recibir mercancía por foto</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Fotografía, revisa y confirma. Las existencias no cambian al
          analizar la imagen.
        </p>
      </div>

      <form onSubmit={enviarFoto}>
        <fieldset disabled={ocupado} className="min-w-0 space-y-4">
          <legend className="sr-only">Fotografía de la mercancía</legend>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex min-h-16 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-center font-medium text-primary-foreground hover:opacity-90 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary">
              <Camera className="size-5" aria-hidden="true" />
              Tomar foto
              <input
                className="sr-only"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={seleccionarArchivo}
              />
            </label>

            <label className="flex min-h-16 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-center font-medium hover:bg-muted has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary">
              <ImagePlus className="size-5" aria-hidden="true" />
              Elegir de la galería
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={seleccionarArchivo}
              />
            </label>
          </div>

          {archivo && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="break-all text-muted-foreground">
                {archivo.name} ·{" "}
                {(archivo.size / (1024 * 1024)).toFixed(1)} MB
              </p>
              <button
                type="button"
                onClick={() => setArchivo(null)}
                className="rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
              >
                Quitar imagen
              </button>
            </div>
          )}

          {vistaPrevia && (
            <img
              src={vistaPrevia}
              alt="Vista previa de la mercancía"
              className="max-h-80 w-full rounded-xl border border-border bg-background object-contain"
            />
          )}

          <Button
            className="min-h-12 w-full sm:w-auto"
            type="submit"
            disabled={ocupado || !archivo}
          >
            {subiendo && (
              <LoaderCircle
                className="mr-2 size-4 motion-safe:animate-spin"
                aria-hidden="true"
              />
            )}
            {subiendo ? "Preparando y analizando…" : "Analizar recepción"}
          </Button>

          {subiendo && (
            <p role="status" className="text-sm text-primary">
              Estamos procesando la fotografía. Espera antes de volver a
              enviarla.
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            En teléfonos compatibles se ofrece la cámara trasera. También
            puedes seleccionar una imagen de la galería.
          </p>
        </fieldset>
      </form>
    </section>
  )
}
