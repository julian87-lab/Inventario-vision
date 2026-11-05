import { Check, ClipboardCheck, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FotoDeteccion } from "@/components/operaciones/FotoDeteccion"
import { VacioSeccion } from "@/components/operaciones/VacioSeccion"
import {
  CAMPO,
  cantidadAConfirmar,
  enteroNoNegativo,
  formatearFecha,
} from "@/lib/inventario"
import type { Deteccion } from "@/types/api"

export function TarjetaRecepcion({
  deteccion,
  ediciones,
  nombreProducto,
  ocupado,
  onCambiarCantidad,
  onRevisar,
  onDescartar,
}: {
  deteccion: Deteccion
  ediciones: Record<number, string> | undefined
  nombreProducto: (id: number) => string
  ocupado: boolean
  onCambiarCantidad: (productoId: number, valor: string) => void
  onRevisar: () => void
  onDescartar: () => void
}) {
  const valorDe = (productoId: number) =>
    cantidadAConfirmar(deteccion, ediciones, productoId)

  const validas = deteccion.items.every((item) =>
    enteroNoNegativo(valorDe(item.producto_id)),
  )

  const total = validas
    ? deteccion.items.reduce(
        (suma, item) => suma + Number(valorDe(item.producto_id)),
        0,
      )
    : null

  const incluidos = deteccion.items.filter(
    (item) =>
      enteroNoNegativo(valorDe(item.producto_id)) &&
      Number(valorDe(item.producto_id)) > 0,
  ).length

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
        <div>
          <h3 className="font-semibold">Recepción #{deteccion.id}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatearFecha(deteccion.fecha_hora)}
          </p>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Pendiente de revisión
        </span>
      </header>

      <div className="grid gap-6 p-5 xl:grid-cols-2">
        <div className="space-y-3">
          <FotoDeteccion deteccionId={deteccion.id} />
          <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <ShieldCheck
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            Compara la foto con la mercancía recibida. La revisión humana es
            necesaria antes de actualizar el inventario.
          </p>
        </div>

        <div className="min-w-0 space-y-4">
          <div>
            <h4 className="font-medium">Revisa las cantidades</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Puedes corregir cantidades de los productos detectados. Escribe
              cero si un producto no debe sumarse.
            </p>
          </div>

          {deteccion.items.length === 0 ? (
            <VacioSeccion
              titulo="No se identificaron productos"
              texto="Descarta esta propuesta y prueba una foto más clara."
            />
          ) : (
            <div className="space-y-3">
              {deteccion.items.map((item) => {
                const valor = valorDe(item.producto_id)
                const invalido = !enteroNoNegativo(valor)
                const editado =
                  !invalido && Number(valor) !== item.cantidad_detectada
                const idCampo = `cantidad-${deteccion.id}-${item.id}`

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-border bg-background p-4"
                  >
                    <label
                      htmlFor={idCampo}
                      className="block text-sm font-medium"
                    >
                      {nombreProducto(item.producto_id)}
                    </label>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-muted-foreground">
                        <p>Detectadas: {item.cantidad_detectada}</p>
                        {editado && (
                          <span className="mt-1 inline-flex items-center gap-1 text-primary">
                            <Check className="size-3" aria-hidden="true" />
                            Cantidad corregida
                          </span>
                        )}
                      </div>

                      <div className="w-32">
                        <label
                          htmlFor={idCampo}
                          className="mb-1 block text-xs text-muted-foreground"
                        >
                          A confirmar
                        </label>
                        <input
                          id={idCampo}
                          className={`${CAMPO} w-full text-center font-semibold tabular-nums ${
                            invalido ? "border-destructive" : ""
                          }`}
                          type="number"
                          inputMode="numeric"
                          min="0"
                          step="1"
                          disabled={ocupado}
                          aria-invalid={invalido}
                          aria-describedby={
                            invalido ? `${idCampo}-error` : undefined
                          }
                          value={valor}
                          onChange={(event) =>
                            onCambiarCantidad(
                              item.producto_id,
                              event.target.value,
                            )
                          }
                        />
                      </div>
                    </div>

                    {invalido && (
                      <p
                        id={`${idCampo}-error`}
                        className="mt-2 text-xs text-destructive"
                      >
                        Escribe un entero igual o mayor que cero.
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <ClipboardCheck
                className="size-4 text-primary"
                aria-hidden="true"
              />
              Resumen de entrada
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">
                  Productos con entrada
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {incluidos}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Unidades a añadir
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {total === null ? "—" : `+${total}`}
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs leading-5 text-muted-foreground">
            No puedes añadir aquí un producto que el modelo no detectó. Si
            falta mercancía, no confirmes una propuesta incompleta: descártala
            y prueba otra fotografía.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="min-h-11"
              disabled={ocupado || total === null || total === 0}
              onClick={onRevisar}
            >
              Revisar y confirmar
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={ocupado}
              onClick={onDescartar}
            >
              Descartar
            </Button>
          </div>

          {total === 0 && deteccion.items.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Todas las cantidades son cero. Descarta la propuesta si no
              corresponde registrar una entrada.
            </p>
          )}
        </div>
      </div>
    </article>
  )
}