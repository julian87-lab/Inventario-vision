import { useState } from "react"
import { RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useOperaciones } from "@/hooks/useOperaciones"
import Alertas from "@/pages/Alertas"
import ConfirmarDeteccion from "@/pages/ConfirmarDeteccion"
import Historial from "@/pages/Historial"
import RegistrarVenta from "@/pages/RegistrarVenta"
import SubirFoto from "@/pages/SubirFoto"

type PestañaOperacion = "recepcion" | "movimientos" | "alertas" | "historial"

export default function Inventario() {
  const operaciones = useOperaciones()
  const [pestaña, setPestaña] = useState<PestañaOperacion>("recepcion")

  const {
    pendientes,
    alertas,
    cargando,
    ocupado,
    error,
    mensaje,
    setError,
    setMensaje,
    recargar,
  } = operaciones

  const pestañas: {
    id: PestañaOperacion
    nombre: string
    contador?: number
  }[] = [
    {
      id: "recepcion",
      nombre: "Recibir mercancía",
      contador: pendientes.length,
    },
    { id: "movimientos", nombre: "Ventas y ajustes" },
    { id: "alertas", nombre: "Alertas", contador: alertas.length },
    { id: "historial", nombre: "Historial" },
  ]

  function cambiarPestaña(nueva: PestañaOperacion) {
    setPestaña(nueva)
    setMensaje(null)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">
            Gestión de mercancía
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Operaciones
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Recibe mercancía, registra salidas y consulta la actividad del
            inventario.
          </p>
        </div>

        <Button
          variant="outline"
          disabled={ocupado}
          onClick={() => {
            setError(null)
            void recargar()
          }}
        >
          <RefreshCw
            className={`mr-2 size-4 ${
              cargando ? "motion-safe:animate-spin" : ""
            }`}
            aria-hidden="true"
          />
          {cargando ? "Actualizando…" : "Actualizar datos"}
        </Button>
      </header>

      <nav
        aria-label="Secciones de operaciones"
        className="flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-2"
      >
        {pestañas.map((opcion) => (
          <button
            key={opcion.id}
            type="button"
            aria-current={pestaña === opcion.id ? "page" : undefined}
            onClick={() => cambiarPestaña(opcion.id)}
            className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:flex-none ${
              pestaña === opcion.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {opcion.nombre}
            {opcion.contador !== undefined && opcion.contador > 0 && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                  pestaña === opcion.id
                    ? "bg-primary-foreground/20"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {opcion.contador}
              </span>
            )}
          </button>
        ))}
      </nav>

      {cargando && (
        <p role="status" className="text-sm text-muted-foreground">
          Actualizando datos de operaciones…
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {mensaje && (
        <p
          role="status"
          className="rounded-xl border border-emerald-600/30 bg-emerald-600/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300"
        >
          {mensaje}
        </p>
      )}

      <div hidden={pestaña !== "recepcion"} className="space-y-6">
        <SubirFoto operaciones={operaciones} />
        <ConfirmarDeteccion operaciones={operaciones} />
      </div>

      <div hidden={pestaña !== "movimientos"}>
        <RegistrarVenta operaciones={operaciones} />
      </div>

      <div hidden={pestaña !== "alertas"}>
        <Alertas operaciones={operaciones} />
      </div>

      <div hidden={pestaña !== "historial"}>
        <Historial operaciones={operaciones} />
      </div>
    </div>
  )
}