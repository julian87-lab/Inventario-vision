import { InsigniaMovimiento } from "@/components/operaciones/InsigniaMovimiento"
import { VacioSeccion } from "@/components/operaciones/VacioSeccion"
import type { Operaciones } from "@/hooks/useOperaciones"
import { formatearFecha } from "@/lib/inventario"

export default function Historial({
  operaciones,
}: {
  operaciones: Operaciones
}) {
  const { movimientos, datosDisponibles, nombreProducto } = operaciones

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Historial de movimientos</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Consulta de hasta 100 movimientos.
        </p>
      </div>

      {movimientos.length === 0 ? (
        <VacioSeccion
          titulo={
            datosDisponibles
              ? "Todavía no hay movimientos"
              : "Historial no disponible"
          }
          texto="Las ventas, ajustes y recepciones confirmadas aparecerán aquí."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th scope="col" className="p-4 font-medium">
                  Fecha
                </th>
                <th scope="col" className="p-4 font-medium">
                  Producto
                </th>
                <th scope="col" className="p-4 font-medium">
                  Tipo
                </th>
                <th scope="col" className="p-4 text-right font-medium">
                  Cambio
                </th>
                <th scope="col" className="p-4 text-right font-medium">
                  Antes
                </th>
                <th scope="col" className="p-4 text-right font-medium">
                  Después
                </th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((movimiento) => (
                <tr key={movimiento.id} className="border-t border-border">
                  <td className="p-4 whitespace-nowrap text-muted-foreground">
                    {formatearFecha(movimiento.fecha_hora)}
                  </td>
                  <td className="p-4 font-medium">
                    {nombreProducto(movimiento.producto_id)}
                  </td>
                  <td className="p-4">
                    <InsigniaMovimiento tipo={movimiento.tipo} />
                  </td>
                  <td
                    className={`p-4 text-right font-medium tabular-nums ${
                      movimiento.cantidad > 0
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-red-700 dark:text-red-400"
                    }`}
                  >
                    {movimiento.cantidad > 0 ? "+" : ""}
                    {movimiento.cantidad}
                  </td>
                  <td className="p-4 text-right tabular-nums">
                    {movimiento.stock_antes}
                  </td>
                  <td className="p-4 text-right tabular-nums">
                    {movimiento.stock_despues}
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
