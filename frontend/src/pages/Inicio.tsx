import { useEffect, useState } from "react"
import {
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  Camera,
  CircleAlert,
  ClipboardCheck,
  Package,
  RefreshCw,
} from "lucide-react"
import { Link } from "react-router-dom"

import { api } from "@/api/client"
import { useAuth } from "@/auth/context"
import type { Deteccion, Movimiento, Producto } from "@/types/api"

type DatosInicio = {
  productos: Producto[]
  movimientos: Movimiento[]
  detecciones: Deteccion[]
}

function fechaCorta(fecha: string) {
  return new Date(fecha).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function nombreMovimiento(tipo: string) {
  const nombres: Record<string, string> = {
    venta: "Venta",
    ajuste: "Ajuste",
    entrada: "Recepción",
    recepcion: "Recepción",
  }

  return nombres[tipo] ?? tipo.replace(/_/g, " ")
}

export default function Inicio() {
  const { user } = useAuth()

  const [datos, setDatos] = useState<DatosInicio | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [actualizado, setActualizado] = useState<Date | null>(null)

  useEffect(() => {
    let activo = true

    async function cargar() {
      setCargando(true)
      setError(null)

      try {
        const [productos, movimientos, detecciones] = await Promise.all([
          api.get<Producto[]>("/productos"),
          api.get<Movimiento[]>("/inventario/movimientos?limite=100"),
          api.get<Deteccion[]>("/detecciones?limite=100"),
        ])

        if (!activo) return

        setDatos({
          productos: productos.filter((producto) => producto.activo),
          movimientos,
          detecciones,
        })
        setActualizado(new Date())
      } catch (err) {
        if (!activo) return

        setError(
          err instanceof Error
            ? err.message
            : "No fue posible cargar el resumen.",
        )
      } finally {
        if (activo) setCargando(false)
      }
    }

    void cargar()

    return () => {
      activo = false
    }
  }, [revision])

  const productos = datos?.productos ?? []
  const movimientos = datos?.movimientos ?? []
  const detecciones = datos?.detecciones ?? []

  const unidades = productos.reduce(
    (total, producto) => total + producto.stock_actual,
    0,
  )

  const pendientes = detecciones.filter(
    (deteccion) => deteccion.estado === "pendiente",
  ).length

  const porReponer = productos
    .filter(
      (producto) => producto.stock_actual <= producto.umbral_alerta,
    )
    .sort(
      (a, b) =>
        a.stock_actual - b.stock_actual ||
        a.nombre.localeCompare(b.nombre, "es"),
    )

  const recientes = [...movimientos]
    .sort(
      (a, b) =>
        new Date(b.fecha_hora).getTime() -
        new Date(a.fecha_hora).getTime(),
    )
    .slice(0, 5)

  const nombreProducto = (id: number) =>
    productos.find((producto) => producto.id === id)?.nombre ??
    `Producto #${id}`

  const indicadores = [
    {
      nombre: "Productos activos",
      valor: productos.length,
      descripcion: "Referencias en tu inventario",
      icono: Package,
    },
    {
      nombre: "Unidades en stock",
      valor: unidades,
      descripcion: "Suma de productos distintos",
      icono: Boxes,
    },
    {
      nombre: "Necesitan reposición",
      valor: porReponer.length,
      descripcion: "Stock bajo o sin existencias",
      icono: CircleAlert,
    },
    {
      nombre: "Recepciones pendientes",
      valor: pendientes,
      descripcion: "En la consulta de recepciones",
      icono: ClipboardCheck,
    },
  ]

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">
            Tu tienda, de un vistazo
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Hola, {user?.nombre ?? "bienvenido"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Revisa tus existencias y continúa con la gestión del día.
          </p>
        </div>

        <button
          type="button"
          disabled={cargando}
          onClick={() => setRevision((valor) => valor + 1)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
        >
          <RefreshCw
            className={`size-4 ${
              cargando ? "motion-safe:animate-spin" : ""
            }`}
            aria-hidden="true"
          />
          {cargando ? "Actualizando…" : "Actualizar"}
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <p className="font-medium">No se pudo actualizar el resumen.</p>
          <p className="mt-1">{error}</p>
          {datos && (
            <p className="mt-2">
              Se conservan los últimos datos cargados. Pulsa Actualizar
              para volver a intentarlo.
            </p>
          )}
        </div>
      )}

      <section
        aria-label="Resumen del inventario"
        aria-busy={cargando}
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {indicadores.map(({ nombre, valor, descripcion, icono: Icono }) => (
          <article
            key={nombre}
            className="rounded-2xl border border-border bg-card p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                {nombre}
              </h2>
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icono className="size-4" aria-hidden="true" />
              </span>
            </div>

            <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">
              {datos ? valor.toLocaleString("es-CO") : "—"}
            </p>

            <p className="mt-2 text-xs text-muted-foreground">
              {descripcion}
            </p>
          </article>
        ))}
      </section>

      <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
              <Camera className="size-4" aria-hidden="true" />
              Recepción asistida
            </span>

            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              ¿Llegó mercancía nueva?
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Analiza una fotografía y revisa la propuesta. Las existencias
              solo cambian cuando confirmas las cantidades.
            </p>
          </div>

          <Link
            to="/operaciones"
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Abrir operaciones
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
            <div>
              <h2 className="font-semibold">Prioridad de reposición</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Productos con stock bajo o agotado.
              </p>
            </div>

            <Link
              to="/inventario"
              className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary"
            >
              Ver inventario
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </header>

          {!datos ? (
            <p role="status" className="p-6 text-sm text-muted-foreground">
              {cargando ? "Cargando existencias…" : "Resumen no disponible."}
            </p>
          ) : porReponer.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <span className="mx-auto inline-flex size-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                <ClipboardCheck className="size-5" aria-hidden="true" />
              </span>
              <p className="mt-3 font-medium">
                {productos.length === 0
                  ? "Todavía no hay productos activos"
                  : "Sin productos por debajo del nivel de reposición"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {productos.length === 0
                  ? "El resumen aparecerá cuando el catálogo tenga productos."
                  : "Todos los productos activos superan su umbral de alerta."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {porReponer.slice(0, 5).map((producto) => (
                <li
                  key={producto.id}
                  className="flex items-center justify-between gap-4 p-5"
                >
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium">
                      {producto.nombre}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Umbral: {producto.umbral_alerta} unidades
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-lg font-semibold tabular-nums">
                      {producto.stock_actual}
                    </p>
                    <span
                      className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                        producto.stock_actual === 0
                          ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
                          : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                      }`}
                    >
                      {producto.stock_actual === 0 ? "Sin stock" : "Stock bajo"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {porReponer.length > 5 && (
            <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
              Mostrando 5 de {porReponer.length} productos por reponer.
            </p>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <header className="border-b border-border p-5">
            <h2 className="font-semibold">Actividad reciente</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Últimos cinco movimientos de la consulta.
            </p>
          </header>

          {!datos ? (
            <p role="status" className="p-6 text-sm text-muted-foreground">
              {cargando ? "Cargando actividad…" : "Actividad no disponible."}
            </p>
          ) : recientes.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="font-medium">Aún no hay movimientos</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Las ventas, los ajustes y las recepciones confirmadas
                aparecerán aquí.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recientes.map((movimiento) => {
                const suma = movimiento.cantidad > 0
                const Icono = suma ? ArrowDownLeft : ArrowUpRight

                return (
                  <li
                    key={movimiento.id}
                    className="flex items-center gap-3 p-5"
                  >
                    <span
                      className={`inline-flex size-10 shrink-0 items-center justify-center rounded-xl ${
                        suma
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                      }`}
                    >
                      <Icono className="size-5" aria-hidden="true" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium">
                        {nombreProducto(movimiento.producto_id)}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {nombreMovimiento(movimiento.tipo)} ·{" "}
                        {fechaCorta(movimiento.fecha_hora)}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 text-lg font-semibold tabular-nums ${
                        suma
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-rose-700 dark:text-rose-300"
                      }`}
                    >
                      {suma ? "+" : ""}
                      {movimiento.cantidad}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        {actualizado
          ? `Última actualización: ${actualizado.toLocaleTimeString("es-CO", {
              hour: "2-digit",
              minute: "2-digit",
            })}. `
          : ""}
        Existencias de productos activos. Recepciones y movimientos
        consultados con un límite de 100 registros por listado.
        Este panel no se actualiza automáticamente.
      </p>
    </div>
  )
}