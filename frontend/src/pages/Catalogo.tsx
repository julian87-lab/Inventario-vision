import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Package, RefreshCw, Search } from "lucide-react"

import { api, ApiError } from "@/api/client"
import { useAuth } from "@/auth/context"
import type { Producto } from "@/types/api"

type Filtro = "todos" | "disponible" | "bajo" | "agotado"

function estadoProducto(producto: Producto) {
  if (producto.stock_actual === 0) {
    return {
      clave: "agotado",
      texto: "Sin stock",
      estilo:
        "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
    }
  }

  if (producto.stock_actual <= producto.umbral_alerta) {
    return {
      clave: "bajo",
      texto: "Stock bajo",
      estilo:
        "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
    }
  }

  return {
    clave: "disponible",
    texto: "Disponible",
    estilo:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  }
}

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

export default function Catalogo() {
  const { signOut } = useAuth()
  const [productos, setProductos] = useState<Producto[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [filtro, setFiltro] = useState<Filtro>("todos")
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let activo = true

    async function cargar() {
      setCargando(true)
      setError(null)

      try {
        const datos = await api.get<Producto[]>("/productos")

        if (activo) {
          setProductos(datos.filter((producto) => producto.activo))
        }
      } catch (err) {
        if (!activo) return

        if (err instanceof ApiError && err.status === 401) {
          signOut()
          return
        }

        setError(
          err instanceof Error
            ? err.message
            : "No se pudo cargar el inventario.",
        )
      } finally {
        if (activo) setCargando(false)
      }
    }

    void cargar()

    return () => {
      activo = false
    }
  }, [revision, signOut])

  const resultados = productos
    .filter((producto) => {
      const coincideNombre = normalizar(producto.nombre).includes(
        normalizar(busqueda),
      )
      const coincideEstado =
        filtro === "todos" || estadoProducto(producto).clave === filtro

      return coincideNombre && coincideEstado
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))

  const unidades = productos.reduce(
    (total, producto) => total + producto.stock_actual,
    0,
  )
  const bajos = productos.filter(
    (producto) => estadoProducto(producto).clave === "bajo",
  ).length
  const agotados = productos.filter(
    (producto) => estadoProducto(producto).clave === "agotado",
  ).length

  const resumen = [
    { titulo: "Productos activos", valor: productos.length },
    { titulo: "Unidades disponibles", valor: unidades },
    { titulo: "Stock bajo", valor: bajos },
    { titulo: "Sin existencias", valor: agotados },
  ]

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Existencias</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Inventario
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Consulta tus productos y detecta qué mercancía necesita reposición.
          </p>
        </div>

        <Link
          to="/operaciones"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Recibir mercancía
        </Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {resumen.map(({ titulo, valor }) => (
          <section
            key={titulo}
            className="rounded-2xl border border-border bg-card p-5"
          >
            <h2 className="text-sm text-muted-foreground">{titulo}</h2>
            <p className="mt-3 text-3xl font-semibold tabular-nums">
              {cargando || error ? "—" : valor.toLocaleString("es-CO")}
            </p>
          </section>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Las unidades disponibles suman cantidades de productos distintos.
        Stock bajo no incluye los productos sin existencias.
      </p>

      <section
        aria-label="Listado de productos"
        aria-busy={cargando}
        className="overflow-hidden rounded-2xl border border-border bg-card"
      >
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <label htmlFor="buscar-producto" className="sr-only">
              Buscar producto
            </label>
            <input
              id="buscar-producto"
              type="search"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar por nombre…"
              className="h-11 w-full rounded-xl border border-input bg-background pr-3 pl-10 text-sm focus-visible:outline-2 focus-visible:outline-primary"
            />
          </div>

          <label htmlFor="filtro-stock" className="sr-only">
            Filtrar por estado
          </label>
          <select
            id="filtro-stock"
            value={filtro}
            onChange={(event) => setFiltro(event.target.value as Filtro)}
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary"
          >
            <option value="todos">Todos los estados</option>
            <option value="disponible">Disponible</option>
            <option value="bajo">Stock bajo</option>
            <option value="agotado">Sin stock</option>
          </select>

          <button
            type="button"
            disabled={cargando}
            onClick={() => setRevision((valor) => valor + 1)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Actualizar
          </button>
        </div>

        {cargando ? (
          <div role="status" className="space-y-3 p-5">
            <span className="sr-only">Cargando inventario…</span>
            {[0, 1, 2, 3].map((fila) => (
              <div
                key={fila}
                className="h-14 rounded-xl bg-muted motion-safe:animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <div role="alert" className="p-6 text-sm">
            <p className="font-medium text-destructive">
              No se pudo mostrar el inventario.
            </p>
            <p className="mt-2 text-muted-foreground">{error}</p>
            <p className="mt-2 text-muted-foreground">
              Pulsa Actualizar para volver a intentarlo.
            </p>
          </div>
        ) : resultados.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Package
              className="mx-auto size-8 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="mt-4 font-medium">
              {productos.length === 0
                ? "No hay productos activos."
                : "No hay productos que coincidan con la búsqueda."}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {productos.length === 0
                ? "El catálogo no contiene productos activos para mostrar."
                : "Prueba otro nombre o cambia el filtro de estado."}
            </p>
          </div>
        ) : (
          <>
            <p
              role="status"
              className="px-4 pt-4 text-xs text-muted-foreground"
            >
              {resultados.length} de {productos.length} productos
            </p>

            <ul className="divide-y divide-border">
              {resultados.map((producto) => {
                const estado = estadoProducto(producto)

                return (
                  <li
                    key={producto.id}
                    className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <h3 className="font-medium">{producto.nombre}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Umbral de alerta: {producto.umbral_alerta} unidades
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-5 sm:justify-end">
                      <div className="text-right">
                        <p className="text-2xl font-semibold tabular-nums">
                          {producto.stock_actual.toLocaleString("es-CO")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          unidades
                        </p>
                      </div>

                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${estado.estilo}`}
                      >
                        {estado.texto}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}