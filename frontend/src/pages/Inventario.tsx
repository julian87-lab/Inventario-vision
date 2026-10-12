import { useCallback, useEffect, useState } from "react"

import { useAuth } from "@/auth/context"
import { Button } from "@/components/ui/button"
import { ApiError, api, subirDeteccion } from "@/api/client"
import type {
  Alerta,
  Deteccion,
  Movimiento,
  Producto,
} from "@/types/api"


type TipoMovimiento = "venta" | "ajuste"


export default function Inventario() {
  const { user, signOut } = useAuth()

  const [productos, setProductos] = useState<Producto[]>([])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [detecciones, setDetecciones] = useState<Deteccion[]>([])

  const [productoId, setProductoId] = useState("")
  const [tipo, setTipo] = useState<TipoMovimiento>("venta")
  const [cantidad, setCantidad] = useState("")

  const [archivo, setArchivo] = useState<File | null>(null)
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null)
  const [cantidadesEditadas, setCantidadesEditadas] = useState<
    Record<number, Record<number, string>>
  >({})

  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)


  const cargarDatos = useCallback(async () => {
    setError(null)

    try {
      const [
        listaProductos,
        listaMovimientos,
        listaAlertas,
        listaDetecciones,
      ] = await Promise.all([
        api.get<Producto[]>("/productos"),
        api.get<Movimiento[]>("/inventario/movimientos?limite=100"),
        api.get<Alerta[]>("/alertas"),
        api.get<Deteccion[]>("/detecciones?limite=100"),
      ])

      setProductos(listaProductos)
      setMovimientos(listaMovimientos)
      setAlertas(listaAlertas)
      setDetecciones(listaDetecciones)

      if (!productoId && listaProductos.length > 0) {
        setProductoId(String(listaProductos[0].id))
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No fue posible cargar los datos del inventario.",
      )
    } finally {
      setCargando(false)
    }
  }, [productoId])


  useEffect(() => {
    void cargarDatos()
  }, [cargarDatos])


  useEffect(() => {
    if (!archivo) {
      setVistaPrevia(null)
      return
    }

    const url = URL.createObjectURL(archivo)
    setVistaPrevia(url)

    return () => URL.revokeObjectURL(url)
  }, [archivo])


  const nombreProducto = (id: number) =>
    productos.find((producto) => producto.id === id)?.nombre ??
    `Producto #${id}`


  function cambiarCantidadConfirmada(
    deteccionId: number,
    productoIdDeteccion: number,
    valor: string,
  ) {
    setCantidadesEditadas((actuales) => ({
      ...actuales,
      [deteccionId]: {
        ...actuales[deteccionId],
        [productoIdDeteccion]: valor,
      },
    }))
  }


  async function enviarFoto(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMensaje(null)

    if (!archivo) {
      setError("Selecciona primero una foto.")
      return
    }

    setSubiendo(true)

    try {
      const deteccion = await subirDeteccion(archivo)

      setArchivo(null)
      setVistaPrevia(null)
      setMensaje(
        `Foto procesada. La detección #${deteccion.id} está pendiente de revisión; el stock todavía no cambió.`,
      )

      await cargarDatos()
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudo subir y procesar la foto.",
      )
    } finally {
      setSubiendo(false)
    }
  }


  async function confirmarDeteccion(deteccion: Deteccion) {
    setError(null)
    setMensaje(null)

    const items = deteccion.items.map((item) => {
      const valorEditado =
        cantidadesEditadas[deteccion.id]?.[item.producto_id]
      const cantidad = Number(
        valorEditado ?? String(item.cantidad_detectada),
      )

      return {
        producto_id: item.producto_id,
        cantidad_confirmada: cantidad,
      }
    })

    if (
      items.some(
        (item) =>
          !Number.isInteger(item.cantidad_confirmada) ||
          item.cantidad_confirmada < 0,
      )
    ) {
      setError("Las cantidades confirmadas deben ser enteros iguales o mayores que cero.")
      return
    }

    setGuardando(true)

    try {
      await api.post<Deteccion>(
        `/detecciones/${deteccion.id}/confirmar`,
        JSON.stringify({ items }),
      )

      setMensaje(
        `Recepción #${deteccion.id} confirmada. El inventario fue actualizado.`,
      )
      await cargarDatos()
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudo confirmar la recepción.",
      )
    } finally {
      setGuardando(false)
    }
  }


  async function descartarDeteccion(deteccionId: number) {
    setError(null)
    setMensaje(null)
    setGuardando(true)

    try {
      await api.post<Deteccion>(
        `/detecciones/${deteccionId}/descartar`,
        JSON.stringify({ motivo: "Descartada desde la pantalla de inventario" }),
      )

      setMensaje(`Detección #${deteccionId} descartada. El stock no cambió.`)
      await cargarDatos()
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudo descartar la detección.",
      )
    } finally {
      setGuardando(false)
    }
  }


  async function registrarMovimiento(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setError(null)
    setMensaje(null)

    const unidades = Number(cantidad)

    if (!productoId || !Number.isInteger(unidades) || unidades === 0) {
      setError(
        "Selecciona un producto e ingresa una cantidad entera distinta de cero.",
      )
      return
    }

    if (tipo === "venta" && unidades < 1) {
      setError("Para una venta, ingresa las unidades como número positivo.")
      return
    }

    setGuardando(true)

    try {
      await api.post<Movimiento>(
        "/inventario/movimientos",
        JSON.stringify({
          producto_id: Number(productoId),
          tipo,
          cantidad: unidades,
        }),
      )

      setCantidad("")
      setMensaje("Movimiento registrado correctamente.")
      await cargarDatos()
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No fue posible registrar el movimiento.",
      )
    } finally {
      setGuardando(false)
    }
  }


  return (
    <main className="min-h-svh space-y-8 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Inventario</h1>
          <p className="text-sm text-muted-foreground">
            Sesión iniciada como {user?.nombre} ({user?.email})
          </p>
        </div>

        <Button variant="outline" onClick={signOut}>
          Cerrar sesión
        </Button>
      </header>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {mensaje && <p className="text-sm text-green-700">{mensaje}</p>}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Productos</h2>

        {cargando ? (
          <p>Cargando inventario…</p>
        ) : productos.length === 0 ? (
          <p>No hay productos activos para mostrar.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3">Clase YOLO</th>
                  <th className="p-3">Producto</th>
                  <th className="p-3">Stock</th>
                  <th className="p-3">Umbral</th>
                  <th className="p-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {productos.map((producto) => (
                  <tr key={producto.id} className="border-t">
                    <td className="p-3">{producto.clase_yolo}</td>
                    <td className="p-3">{producto.nombre}</td>
                    <td className="p-3">{producto.stock_actual}</td>
                    <td className="p-3">{producto.umbral_alerta}</td>
                    <td className="p-3">
                      {producto.stock_actual === 0
                        ? "Sin stock"
                        : producto.stock_actual <= producto.umbral_alerta
                          ? "Stock bajo"
                          : "Disponible"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-md border p-4">
        <div>
          <h2 className="text-lg font-medium">Recibir mercancía por foto</h2>
          <p className="text-sm text-muted-foreground">
            La foto generará una propuesta pendiente. No cambiará el stock
            hasta que revises y confirmes las cantidades.
          </p>
        </div>

        <form className="space-y-3" onSubmit={enviarFoto}>
          <label className="grid gap-2 text-sm">
            Foto de la mercancía recibida
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) =>
                setArchivo(event.target.files?.[0] ?? null)
              }
              required
            />
          </label>

          {vistaPrevia && (
            <img
              src={vistaPrevia}
              alt="Vista previa de la mercancía"
              className="max-h-80 rounded-md border object-contain"
            />
          )}

          <Button type="submit" disabled={subiendo || !archivo}>
            {subiendo ? "Analizando foto…" : "Analizar foto"}
          </Button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Detecciones pendientes</h2>

        {detecciones.filter((d) => d.estado === "pendiente").length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay recepciones pendientes de revisar.
          </p>
        ) : (
          detecciones
            .filter((deteccion) => deteccion.estado === "pendiente")
            .map((deteccion) => (
              <article
                key={deteccion.id}
                className="space-y-4 rounded-md border p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-medium">
                      Recepción #{deteccion.id}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {new Date(deteccion.fecha_hora).toLocaleString()} ·{" "}
                      {deteccion.modelo_version}
                    </p>
                  </div>

                  <a
                    className="text-sm underline"
                    href={deteccion.imagen_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir foto original
                  </a>
                </div>

                <div className="space-y-3">
                  {deteccion.items.map((item) => (
                    <label
                      key={item.id}
                      className="grid gap-1 text-sm sm:max-w-md"
                    >
                      {nombreProducto(item.producto_id)} — detectadas{" "}
                      {item.cantidad_detectada}
                      {item.confianza !== null &&
                        ` · confianza ${(item.confianza * 100).toFixed(1)}%`}
                      <input
                        className="h-10 rounded-md border bg-background px-3"
                        type="number"
                        min="0"
                        step="1"
                        value={
                          cantidadesEditadas[deteccion.id]?.[
                            item.producto_id
                          ] ?? String(item.cantidad_detectada)
                        }
                        onChange={(event) =>
                          cambiarCantidadConfirmada(
                            deteccion.id,
                            item.producto_id,
                            event.target.value,
                          )
                        }
                      />
                    </label>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={guardando}
                    onClick={() => void confirmarDeteccion(deteccion)}
                  >
                    {guardando ? "Guardando…" : "Confirmar recepción"}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={guardando}
                    onClick={() => void descartarDeteccion(deteccion.id)}
                  >
                    Descartar
                  </Button>
                </div>
              </article>
            ))
        )}
      </section>

      <section className="space-y-3 rounded-md border p-4">
        <h2 className="text-lg font-medium">Registrar venta o ajuste</h2>

        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={registrarMovimiento}
        >
          <label className="grid gap-1 text-sm">
            Producto
            <select
              className="h-10 rounded-md border bg-background px-3"
              value={productoId}
              onChange={(event) => setProductoId(event.target.value)}
              required
            >
              {productos.map((producto) => (
                <option key={producto.id} value={producto.id}>
                  {producto.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            Movimiento
            <select
              className="h-10 rounded-md border bg-background px-3"
              value={tipo}
              onChange={(event) =>
                setTipo(event.target.value as TipoMovimiento)
              }
            >
              <option value="venta">Venta (resta stock)</option>
              <option value="ajuste">Ajuste (+ suma / − resta)</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            Cantidad
            <input
              className="h-10 rounded-md border bg-background px-3"
              type="number"
              step="1"
              value={cantidad}
              onChange={(event) => setCantidad(event.target.value)}
              placeholder={tipo === "venta" ? "Ej. 2" : "Ej. -2 o 5"}
              required
            />
          </label>

          <div className="flex items-end">
            <Button
              type="submit"
              disabled={guardando || productos.length === 0}
            >
              {guardando ? "Guardando…" : "Registrar"}
            </Button>
          </div>
        </form>

        <p className="text-xs text-muted-foreground">
          Venta: ingresa unidades positivas. Ajuste: positivo para sumar y
          negativo para restar. Las entradas de mercancía se registran al
          confirmar una detección.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Alertas pendientes</h2>

        {alertas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay alertas pendientes.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3">Producto</th>
                  <th className="p-3">Alerta</th>
                  <th className="p-3">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {alertas.map((alerta) => (
                  <tr key={alerta.id} className="border-t">
                    <td className="p-3">
                      {nombreProducto(alerta.producto_id)}
                    </td>
                    <td className="p-3">
                      {alerta.tipo === "sin_stock"
                        ? "Sin stock"
                        : "Stock bajo"}
                    </td>
                    <td className="p-3">
                      {new Date(alerta.fecha_hora).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Historial de movimientos</h2>

        {movimientos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay movimientos registrados.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Producto</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Cambio</th>
                  <th className="p-3">Antes</th>
                  <th className="p-3">Después</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((movimiento) => (
                  <tr key={movimiento.id} className="border-t">
                    <td className="p-3">
                      {new Date(movimiento.fecha_hora).toLocaleString()}
                    </td>
                    <td className="p-3">
                      {nombreProducto(movimiento.producto_id)}
                    </td>
                    <td className="p-3">{movimiento.tipo}</td>
                    <td className="p-3">
                      {movimiento.cantidad > 0 ? "+" : ""}
                      {movimiento.cantidad}
                    </td>
                    <td className="p-3">{movimiento.stock_antes}</td>
                    <td className="p-3">{movimiento.stock_despues}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div>
        <Button variant="outline" onClick={() => void cargarDatos()}>
          Actualizar datos
        </Button>
      </div>
    </main>
  )
}
