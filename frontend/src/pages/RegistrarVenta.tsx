import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { Minus, Plus, Search } from "lucide-react"

import { registrarMovimiento } from "@/api/operaciones"
import type { TipoMovimiento } from "@/api/operaciones"
import { useAuth } from "@/auth/context"
import { Button } from "@/components/ui/button"
import type { Operaciones } from "@/hooks/useOperaciones"
import {
  CAMPO,
  estadoStock,
  mensajeError,
  normalizar,
} from "@/lib/inventario"

export default function RegistrarVenta({
  operaciones,
}: {
  operaciones: Operaciones
}) {
  const { user } = useAuth()
  const { productos, ocupado, escribir, setError, setMensaje } = operaciones

  // Solo el administrador puede registrar ajustes. El servidor también
  // lo exige; aquí evitamos ofrecer una acción que sería rechazada.
  const puedeAjustar = user?.rol === "administrador"

  const [productoId, setProductoId] = useState("")
  const [tipoElegido, setTipoElegido] = useState<TipoMovimiento>("venta")
  const [cantidad, setCantidad] = useState("")
  const [busquedaProducto, setBusquedaProducto] = useState("")
  const [guardando, setGuardando] = useState(false)

  const tipo: TipoMovimiento = puedeAjustar ? tipoElegido : "venta"

  useEffect(() => {
    setProductoId((actual) =>
      productos.some((producto) => String(producto.id) === actual)
        ? actual
        : String(productos[0]?.id ?? ""),
    )
  }, [productos])

  const productoSeleccionado = productos.find(
    (producto) => String(producto.id) === productoId,
  )

  const productosFiltrados = productos.filter((producto) =>
    normalizar(producto.nombre).includes(normalizar(busquedaProducto)),
  )

  const unidadesMovimiento = Number(cantidad)
  const cantidadValida =
    cantidad.trim() !== "" &&
    Number.isSafeInteger(unidadesMovimiento) &&
    unidadesMovimiento !== 0 &&
    (tipo !== "venta" || unidadesMovimiento > 0)

  const stockResultante =
    productoSeleccionado && cantidadValida
      ? productoSeleccionado.stock_actual +
        (tipo === "venta" ? -unidadesMovimiento : unidadesMovimiento)
      : null

  const opcionesTipo = (
    [
      { id: "venta", nombre: "Venta", detalle: "Resta unidades" },
      { id: "ajuste", nombre: "Ajuste", detalle: "Suma o resta" },
    ] as const
  ).filter((opcion) => opcion.id === "venta" || puedeAjustar)

  function cambiarTipo(nuevo: TipoMovimiento) {
    setTipoElegido(nuevo)
    if (nuevo === "venta" && Number(cantidad) < 0) setCantidad("")
  }

  function moverCantidad(delta: number) {
    const siguiente = (Number(cantidad) || 0) + delta
    setCantidad(String(tipo === "venta" ? Math.max(1, siguiente) : siguiente))
  }

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (ocupado) return

    setError(null)
    setMensaje(null)

    if (!productoSeleccionado || !cantidadValida) {
      setError(
        tipo === "venta"
          ? "Selecciona un producto e ingresa una cantidad entera positiva."
          : "Selecciona un producto e ingresa una cantidad entera distinta de cero.",
      )
      return
    }

    if (stockResultante === null || stockResultante < 0) {
      setError(
        "El movimiento dejaría existencias negativas. Revisa la cantidad.",
      )
      return
    }

    setGuardando(true)

    const resultado = await escribir(
      () =>
        registrarMovimiento({
          producto_id: Number(productoId),
          tipo,
          cantidad: unidadesMovimiento,
        }),
      () => {
        setCantidad("")
        setMensaje("Movimiento registrado correctamente.")
      },
    )

    setGuardando(false)

    if (resultado.estado === "error") {
      setError(
        mensajeError(
          resultado.error,
          "No fue posible registrar el movimiento.",
        ),
      )
    }
  }

  return (
    <form onSubmit={enviar}>
      <fieldset
        disabled={ocupado}
        className="grid min-w-0 gap-6 lg:grid-cols-[1.2fr_1fr]"
      >
        <legend className="sr-only">
          {puedeAjustar ? "Registrar venta o ajuste" : "Registrar venta"}
        </legend>

        <section className="min-w-0 space-y-4 rounded-2xl border border-border bg-card p-5">
          <div>
            <h2 className="text-lg font-semibold">1. Elige el producto</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Busca por nombre y selecciónalo de la lista.
            </p>
          </div>

          <div className="relative">
            <Search
              className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <label htmlFor="buscar-producto-movimiento" className="sr-only">
              Buscar producto
            </label>
            <input
              id="buscar-producto-movimiento"
              type="search"
              value={busquedaProducto}
              onChange={(event) => setBusquedaProducto(event.target.value)}
              placeholder="Buscar producto…"
              className={`${CAMPO} w-full pl-10`}
            />
          </div>

          <fieldset className="max-h-80 min-w-0 space-y-2 overflow-y-auto pr-1">
            <legend className="sr-only">Producto</legend>

            {productosFiltrados.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No hay productos que coincidan.
              </p>
            ) : (
              productosFiltrados.map((producto) => {
                const activo = String(producto.id) === productoId
                const estado = estadoStock(producto)

                return (
                  <label key={producto.id} className="block cursor-pointer">
                    <input
                      type="radio"
                      name="producto-movimiento"
                      value={producto.id}
                      checked={activo}
                      onChange={() => setProductoId(String(producto.id))}
                      className="peer sr-only"
                    />
                    <span
                      className={`flex w-full items-center justify-between gap-4 rounded-xl border p-3.5 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary ${
                        activo
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {producto.nombre}
                        </span>
                        <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span
                            className={`size-2 rounded-full ${estado.punto}`}
                            aria-hidden="true"
                          />
                          {estado.texto}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-lg font-semibold tabular-nums">
                          {producto.stock_actual}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          unidades
                        </span>
                      </span>
                    </span>
                  </label>
                )
              })
            )}
          </fieldset>
        </section>

        <section className="min-w-0 space-y-5 rounded-2xl border border-border bg-card p-5 lg:self-start">
          <div>
            <h2 className="text-lg font-semibold">
              2. Indica {puedeAjustar ? "el movimiento" : "la venta"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Las recepciones de mercancía se registran desde su pestaña.
              {!puedeAjustar &&
                " Los ajustes de inventario los realiza un administrador."}
            </p>
          </div>

          {puedeAjustar ? (
            <fieldset className="grid min-w-0 grid-cols-2 gap-2 rounded-2xl bg-muted p-1.5">
              <legend className="sr-only">Tipo de movimiento</legend>
              {opcionesTipo.map((opcion) => (
                <label key={opcion.id} className="cursor-pointer">
                  <input
                    type="radio"
                    name="tipo-movimiento"
                    value={opcion.id}
                    checked={tipo === opcion.id}
                    onChange={() => cambiarTipo(opcion.id)}
                    className="peer sr-only"
                  />
                  <span
                    className={`block rounded-xl px-3 py-3 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-primary ${
                      tipo === opcion.id
                        ? "bg-card shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="block text-sm font-semibold">
                      {opcion.nombre}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {opcion.detalle}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : (
            <p className="rounded-xl bg-muted px-4 py-3 text-sm">
              <span className="font-semibold">Venta</span>
              <span className="text-muted-foreground">
                {" "}
                · Resta unidades del inventario
              </span>
            </p>
          )}

          <div className="grid gap-1.5">
            <label
              htmlFor="cantidad-movimiento"
              className="text-sm font-medium"
            >
              Cantidad
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Disminuir cantidad"
                onClick={() => moverCantidad(-1)}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
              >
                <Minus className="size-4" aria-hidden="true" />
              </button>

              <input
                id="cantidad-movimiento"
                className={`${CAMPO} w-full text-center text-lg font-semibold tabular-nums`}
                type="number"
                inputMode="numeric"
                min={tipo === "venta" ? 1 : undefined}
                step="1"
                value={cantidad}
                onChange={(event) => setCantidad(event.target.value)}
                placeholder={tipo === "venta" ? "2" : "-2 o 5"}
                required
              />

              <button
                type="button"
                aria-label="Aumentar cantidad"
                onClick={() => moverCantidad(1)}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
              >
                <Plus className="size-4" aria-hidden="true" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {tipo === "venta"
                ? "Escribe las unidades vendidas como número positivo."
                : "Usa un número positivo para sumar y uno negativo para restar."}
            </p>
          </div>

          <div
            aria-live="polite"
            className="rounded-xl border border-border bg-background p-4 text-sm"
          >
            {productoSeleccionado ? (
              <>
                <p className="font-medium">{productoSeleccionado.nombre}</p>
                <p className="mt-2 text-muted-foreground">
                  Stock actual:{" "}
                  <span className="font-semibold text-foreground tabular-nums">
                    {productoSeleccionado.stock_actual}
                  </span>
                  {stockResultante !== null && (
                    <>
                      {" → "}
                      <span
                        className={`font-semibold tabular-nums ${
                          stockResultante < 0
                            ? "text-destructive"
                            : "text-foreground"
                        }`}
                      >
                        {stockResultante}
                      </span>
                    </>
                  )}
                </p>
                {stockResultante !== null && stockResultante < 0 && (
                  <p className="mt-2 text-destructive">
                    El resultado sería negativo; revisa la cantidad.
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Selecciona un producto.</p>
            )}
          </div>

          <Button
            type="submit"
            className="min-h-12 w-full"
            disabled={
              ocupado ||
              !productoSeleccionado ||
              !cantidadValida ||
              stockResultante === null ||
              stockResultante < 0
            }
          >
            {guardando
              ? "Guardando…"
              : puedeAjustar
                ? "Registrar movimiento"
                : "Registrar venta"}
          </Button>
        </section>
      </fieldset>
    </form>
  )
}
