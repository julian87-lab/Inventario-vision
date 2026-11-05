import { ApiError } from "@/api/client"
import type { Deteccion, Producto } from "@/types/api"

export const CAMPO =
  "h-11 min-w-0 rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"

const ETIQUETAS_MOVIMIENTO: Record<string, string> = {
  venta: "Venta",
  ajuste: "Ajuste",
  entrada: "Recepción",
  recepcion: "Recepción",
}

export function etiquetaMovimiento(tipo: string) {
  return (
    ETIQUETAS_MOVIMIENTO[tipo] ??
    tipo.charAt(0).toUpperCase() + tipo.slice(1).replace(/_/g, " ")
  )
}

export function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

export function enteroNoNegativo(valor: string) {
  if (valor.trim() === "") return false
  const numero = Number(valor)
  return Number.isSafeInteger(numero) && numero >= 0
}

export function mensajeError(error: unknown, alternativa: string) {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : alternativa
}

export function estadoStock(producto: Producto) {
  if (producto.stock_actual === 0) {
    return { texto: "Sin stock", punto: "bg-red-500" }
  }

  if (producto.stock_actual <= producto.umbral_alerta) {
    return { texto: "Stock bajo", punto: "bg-amber-500" }
  }

  return { texto: "Disponible", punto: "bg-emerald-500" }
}

export function cantidadAConfirmar(
  deteccion: Deteccion,
  ediciones: Record<number, string> | undefined,
  productoId: number,
) {
  const item = deteccion.items.find(
    (elemento) => elemento.producto_id === productoId,
  )

  return ediciones?.[productoId] ?? String(item?.cantidad_detectada ?? 0)
}