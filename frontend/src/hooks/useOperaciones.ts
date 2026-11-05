import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { obtenerDatosOperaciones } from "@/api/operaciones"
import type { DatosOperaciones } from "@/api/operaciones"
import { mensajeError } from "@/lib/inventario"

const DATOS_VACIOS: DatosOperaciones = {
  productos: [],
  movimientos: [],
  alertas: [],
  detecciones: [],
}

export type ResultadoEscritura<T> =
  | { estado: "ok"; valor: T }
  | { estado: "error"; error: unknown }
  | { estado: "bloqueado" }

export function useOperaciones() {
  const [datos, setDatos] = useState<DatosOperaciones>(DATOS_VACIOS)
  const [datosDisponibles, setDatosDisponibles] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [escribiendo, setEscribiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)

  const bloqueoEscritura = useRef(false)
  const solicitudCarga = useRef<Promise<void> | null>(null)

  const recargar = useCallback((): Promise<void> => {
    if (solicitudCarga.current) return solicitudCarga.current

    setCargando(true)

    const solicitud = (async () => {
      try {
        setDatos(await obtenerDatosOperaciones())
        setDatosDisponibles(true)
      } catch (err) {
        setError(
          mensajeError(
            err,
            "No se pudieron actualizar los datos. Pulsa Actualizar datos para volver a intentarlo.",
          ),
        )
      } finally {
        setCargando(false)
        solicitudCarga.current = null
      }
    })()

    solicitudCarga.current = solicitud
    return solicitud
  }, [])

  useEffect(() => {
    void recargar()
  }, [recargar])

  const escribir = useCallback(
    async <T>(
      tarea: () => Promise<T>,
      alExito?: (valor: T) => void,
    ): Promise<ResultadoEscritura<T>> => {
      if (bloqueoEscritura.current || solicitudCarga.current) {
        return { estado: "bloqueado" }
      }

      bloqueoEscritura.current = true
      setEscribiendo(true)
      setError(null)
      setMensaje(null)

      let valor: T

      try {
        valor = await tarea()
      } catch (err) {
        bloqueoEscritura.current = false
        setEscribiendo(false)
        return { estado: "error", error: err }
      }

      try {
        alExito?.(valor)
        await recargar()
      } finally {
        bloqueoEscritura.current = false
        setEscribiendo(false)
      }

      return { estado: "ok", valor }
    },
    [recargar],
  )

  const quitarDeteccion = useCallback((deteccionId: number) => {
    setDatos((actuales) => ({
      ...actuales,
      detecciones: actuales.detecciones.filter(
        (deteccion) => deteccion.id !== deteccionId,
      ),
    }))
  }, [])

  const nombreProducto = useCallback(
    (id: number) =>
      datos.productos.find((producto) => producto.id === id)?.nombre ??
      `Producto #${id}`,
    [datos.productos],
  )

  const pendientes = useMemo(
    () =>
      datos.detecciones.filter(
        (deteccion) => deteccion.estado === "pendiente",
      ),
    [datos.detecciones],
  )

  return {
    productos: datos.productos,
    movimientos: datos.movimientos,
    alertas: datos.alertas,
    detecciones: datos.detecciones,
    pendientes,
    datosDisponibles,
    cargando,
    escribiendo,
    ocupado: cargando || escribiendo,
    error,
    mensaje,
    setError,
    setMensaje,
    recargar,
    escribir,
    quitarDeteccion,
    nombreProducto,
  }
}

export type Operaciones = ReturnType<typeof useOperaciones>