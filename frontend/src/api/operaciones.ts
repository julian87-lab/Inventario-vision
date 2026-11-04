import { api, subirDeteccion } from "@/api/client"
import type {
  Alerta,
  Deteccion,
  Movimiento,
  Producto,
} from "@/types/api"

export type TipoMovimiento = "venta" | "ajuste"

export type ItemConfirmado = {
  producto_id: number
  cantidad_confirmada: number
}

export type DatosOperaciones = {
  productos: Producto[]
  movimientos: Movimiento[]
  alertas: Alerta[]
  detecciones: Deteccion[]
}

export type NuevoMovimiento = {
  producto_id: number
  tipo: TipoMovimiento
  cantidad: number
}

const LIMITE_CONSULTA = 100

export async function obtenerDatosOperaciones(): Promise<DatosOperaciones> {
  const [productos, movimientos, alertas, detecciones] = await Promise.all([
    api.get<Producto[]>("/productos"),
    api.get<Movimiento[]>(
      `/inventario/movimientos?limite=${LIMITE_CONSULTA}`,
    ),
    api.get<Alerta[]>("/alertas"),
    api.get<Deteccion[]>(`/detecciones?limite=${LIMITE_CONSULTA}`),
  ])

  return {
    productos,
    movimientos,
    alertas: alertas.filter((alerta) => !alerta.atendida),
    detecciones,
  }
}

export function analizarRecepcion(archivo: File): Promise<Deteccion> {
  return subirDeteccion(archivo)
}

export function confirmarRecepcion(
  deteccionId: number,
  items: ItemConfirmado[],
): Promise<Deteccion> {
  return api.post<Deteccion>(
    `/detecciones/${deteccionId}/confirmar`,
    JSON.stringify({ items }),
  )
}

export function descartarRecepcion(
  deteccionId: number,
): Promise<Deteccion> {
  return api.post<Deteccion>(
    `/detecciones/${deteccionId}/descartar`,
    JSON.stringify({
      motivo: "Descartada desde la pantalla de inventario",
    }),
  )
}

export function registrarMovimiento(
  movimiento: NuevoMovimiento,
): Promise<Movimiento> {
  return api.post<Movimiento>(
    "/inventario/movimientos",
    JSON.stringify(movimiento),
  )
}