import { useState } from "react"
import { Check, ClipboardCheck, Plus, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FotoDeteccion } from "@/components/operaciones/FotoDeteccion"
import { VacioSeccion } from "@/components/operaciones/VacioSeccion"
import {
  CAMPO,
  cantidadAConfirmar,
  enteroNoNegativo,
  formatearFecha,
} from "@/lib/inventario"
import type { Deteccion, Producto } from "@/types/api"

export function TarjetaRecepcion({
  deteccion,
  productos,
  ediciones,
  nombreProducto,
  ocupado,
  onCambiarCantidad,
  onAgregarProducto,
  onRevisar,
  onDescartar,
}: {
  deteccion: Deteccion
  productos: Producto[]
  ediciones: Record<number, string> | undefined
  nombreProducto: (id: number) => string
  ocupado: boolean
  onCambiarCantidad: (productoId: number, valor: string) => void
  onAgregarProducto: (productoId: number, cantidad: number) => void
  onRevisar: () => void
  onDescartar: () => void
}) {
  const [productoManual, setProductoManual] = useState("")
  const [cantidadManual, setCantidadManual] = useState("1")

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

  const productosDisponibles = productos.filter(
    (producto) =>
      producto.activo &&
      !deteccion.items.some((item) => item.producto_id === producto.id),
  )

  const productoElegido = productosDisponibles.some(
    (producto) => String(producto.id) === productoManual,
  )
    ? productoManual
    : ""

  const cantidadManualValida =
    cantidadManual !== "" &&
    Number.isInteger(Number(cantidadManual)) &&
    Number(cantidadManual) >= 1

  const puedeAgregar =
    productoElegido !== "" && cantidadManualValida && !ocupado

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
              texto="Puedes añadir manualmente los productos que faltan antes de confirmar."
            />
          ) : (
            <div className="space-y-3">
              {deteccion.items.map((item) => {
                const valor = valorDe(item.producto_id)
                const invalido = !enteroNoNegativo(valor)
                const editado =
                  !invalido && Number(valor) !== item.cantidad_detectada
                const manual = item.confianza === null
                const idCampo = `cantidad-${deteccion.id}-${item.id}`

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-border bg-background p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <label
                        htmlFor={idCampo}
                        className="block text-sm font-medium"
                      >
                        {nombreProducto(item.producto_id)}
                      </label>

                      {manual && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          Añadido manualmente
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-muted-foreground">
                        <p>
                          {manual
                            ? `Cantidad indicada: ${item.cantidad_detectada}`
                            : `Detectadas: ${item.cantidad_detectada}`}
                        </p>
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

          <div className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-center gap-2">
              <Plus className="size-4 text-primary" aria-hidden="true" />
              <h4 className="text-sm font-medium">Añadir producto omitido</h4>
            </div>

            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Si el modelo no identificó una mercancía visible en la foto,
              añádela manualmente. Quedará marcada como corrección humana y
              registrada en auditoría.
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
              <div>
                <label
                  htmlFor={`producto-manual-${deteccion.id}`}
                  className="mb-1 block text-xs text-muted-foreground"
                >
                  Producto
                </label>

                <select
                  id={`producto-manual-${deteccion.id}`}
                  className={`${CAMPO} w-full`}
                  value={productoElegido}
                  disabled={ocupado || productosDisponibles.length === 0}
                  onChange={(event) => setProductoManual(event.target.value)}
                >
                  <option value="">Selecciona un producto</option>

                  {productosDisponibles.map((producto) => (
                    <option key={producto.id} value={producto.id}>
                      {producto.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor={`cantidad-manual-${deteccion.id}`}
                  className="mb-1 block text-xs text-muted-foreground"
                >
                  Cantidad
                </label>

                <input
                  id={`cantidad-manual-${deteccion.id}`}
                  className={`${CAMPO} w-full text-center font-semibold tabular-nums`}
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  disabled={ocupado}
                  value={cantidadManual}
                  onChange={(event) => setCantidadManual(event.target.value)}
                />
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="mt-3 min-h-11 w-full"
              disabled={!puedeAgregar}
              onClick={() =>
                onAgregarProducto(
                  Number(productoElegido),
                  Number(cantidadManual),
                )
              }
            >
              Añadir a la recepción
            </Button>

            {productosDisponibles.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Todos los productos activos ya están incluidos en esta
                recepción.
              </p>
            )}
          </div>

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
