import { useCallback, useEffect, useState } from "react"

import { useAuth } from "@/auth/context"
import { Button } from "@/components/ui/button"
import { ApiError, api } from "@/api/client"
import type { Alerta, Movimiento, Producto } from "@/types/api"

type TipoMovimiento = "venta" | "ajuste"

export default function Inventario() {
  const { user, signOut } = useAuth()

  const [productos, setProductos] = useState<Producto[]>([])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [productoId, setProductoId] = useState("")
  const [tipo, setTipo] = useState<TipoMovimiento>("venta")
  const [cantidad, setCantidad] = useState("")
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)

  const cargarDatos = useCallback(async () => {
    setError(null)

    try {
      const [listaProductos, listaMovimientos, listaAlertas] =
        await Promise.all([
          api.get<Producto[]>("/productos"),
          api.get<Movimiento[]>("/inventario/movimientos?limite=100"),
          api.get<Alerta[]>("/alertas"),
        ])

      setProductos(listaProductos)
      setMovimientos(listaMovimientos)
      setAlertas(listaAlertas)

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

  async function registrarMovimiento(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setError(null)
    setMensaje(null)

    const unidades = Number(cantidad)

    if (!productoId || !Number.isInteger(unidades) || unidades === 0) {
      setError("Selecciona un producto e ingresa una cantidad entera distinta de cero.")
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

  const nombreProducto = (id: number) =>
    productos.find((producto) => producto.id === id)?.nombre ??
    `Producto #${id}`

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
          negativo para restar. Las entradas de nueva mercancía se harán al
          confirmar detecciones, no con este formulario.
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
                      {alerta.tipo === "sin_stock" ? "Sin stock" : "Stock bajo"}
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