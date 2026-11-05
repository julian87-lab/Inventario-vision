import { VacioSeccion } from "@/components/operaciones/VacioSeccion"
import type { Operaciones } from "@/hooks/useOperaciones"
import { formatearFecha } from "@/lib/inventario"

export default function Alertas({
  operaciones,
}: {
  operaciones: Operaciones
}) {
  const { alertas, datosDisponibles, nombreProducto } = operaciones

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Alertas pendientes</h2>

      {alertas.length === 0 ? (
        <VacioSeccion
          titulo={
            datosDisponibles
              ? "No hay alertas pendientes"
              : "Alertas no disponibles"
          }
          texto="Las alertas pendientes aparecerán aquí después de consultar los datos."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th scope="col" className="p-4 font-medium">
                  Producto
                </th>
                <th scope="col" className="p-4 font-medium">
                  Alerta
                </th>
                <th scope="col" className="p-4 font-medium">
                  Fecha
                </th>
              </tr>
            </thead>
            <tbody>
              {alertas.map((alerta) => (
                <tr key={alerta.id} className="border-t border-border">
                  <td className="p-4 font-medium">
                    {nombreProducto(alerta.producto_id)}
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                        alerta.tipo === "sin_stock"
                          ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
                          : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                      }`}
                    >
                      {alerta.tipo === "sin_stock"
                        ? "Sin stock"
                        : "Stock bajo"}
                    </span>
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {formatearFecha(alerta.fecha_hora)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

