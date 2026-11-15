import { useState } from "react"

import {
  agregarProductoManual,
  confirmarRecepcion,
  descartarRecepcion,
} from "@/api/operaciones"
import { DialogoRecepcion } from "@/components/operaciones/DialogoRecepcion"
import type { AccionRecepcion } from "@/components/operaciones/DialogoRecepcion"
import { TarjetaRecepcion } from "@/components/operaciones/TarjetaRecepcion"
import { VacioSeccion } from "@/components/operaciones/VacioSeccion"
import type { Operaciones } from "@/hooks/useOperaciones"
import {
  cantidadAConfirmar,
  enteroNoNegativo,
  mensajeError,
} from "@/lib/inventario"
import type { Deteccion } from "@/types/api"

export default function ConfirmarDeteccion({
  operaciones,
}: {
  operaciones: Operaciones
}) {
  const {
    pendientes,
    productos,
    datosDisponibles,
    cargando,
    ocupado,
    nombreProducto,
    escribir,
    quitarDeteccion,
    setError,
    setMensaje,
  } = operaciones

  const [cantidadesEditadas, setCantidadesEditadas] = useState<
    Record<number, Record<number, string>>
  >({})
  const [accion, setAccion] = useState<AccionRecepcion | null>(null)
  const [errorDialogo, setErrorDialogo] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  function cambiarCantidad(
    deteccionId: number,
    productoId: number,
    valor: string,
  ) {
    setCantidadesEditadas((actuales) => ({
      ...actuales,
      [deteccionId]: {
        ...actuales[deteccionId],
        [productoId]: valor,
      },
    }))
  }

  async function agregarProducto(
    deteccion: Deteccion,
    productoId: number,
    cantidad: number,
  ) {
    setError(null)
    setMensaje(null)

    const resultado = await escribir(
      () =>
        agregarProductoManual(deteccion.id, {
          producto_id: productoId,
          cantidad,
        }),
      () => {
        setMensaje(
          `Producto añadido manualmente a la recepción #${deteccion.id}. Confirma la recepción para actualizar el inventario.`,
        )
      },
    )

    if (resultado.estado === "error") {
      setError(
        mensajeError(
          resultado.error,
          "No se pudo añadir el producto a la recepción.",
        ),
      )
    }
  }

  function prepararConfirmacion(deteccion: Deteccion) {
    setError(null)
    setMensaje(null)

    const ediciones = cantidadesEditadas[deteccion.id]

    if (
      deteccion.items.length === 0 ||
      deteccion.items.some(
        (item) =>
          !enteroNoNegativo(
            cantidadAConfirmar(deteccion, ediciones, item.producto_id),
          ),
      )
    ) {
      setError(
        "Completa las cantidades con enteros iguales o mayores que cero. No dejes campos vacíos.",
      )
      return
    }

    const items = deteccion.items.map((item) => ({
      producto_id: item.producto_id,
      cantidad_confirmada: Number(
        cantidadAConfirmar(deteccion, ediciones, item.producto_id),
      ),
    }))

    if (!items.some((item) => item.cantidad_confirmada > 0)) {
      setError(
        "Todas las cantidades son cero. Si no corresponde registrar una entrada, descarta la recepción.",
      )
      return
    }

    setErrorDialogo(null)
    setAccion({ tipo: "confirmar", deteccionId: deteccion.id, items })
  }

  async function ejecutarAccion() {
    if (!accion || ocupado) return

    const actual = accion

    setGuardando(true)
    setErrorDialogo(null)

    const resultado = await escribir(
      () =>
        actual.tipo === "confirmar"
          ? confirmarRecepcion(actual.deteccionId, actual.items)
          : descartarRecepcion(actual.deteccionId),
      () => {
        setAccion(null)
        quitarDeteccion(actual.deteccionId)

        setCantidadesEditadas((actuales) => {
          const siguientes = { ...actuales }
          delete siguientes[actual.deteccionId]
          return siguientes
        })

        setMensaje(
          actual.tipo === "confirmar"
            ? `Recepción #${actual.deteccionId} confirmada. El inventario fue actualizado.`
            : `Recepción #${actual.deteccionId} descartada. El stock no cambió.`,
        )
      },
    )

    setGuardando(false)

    if (resultado.estado === "error") {
      setErrorDialogo(
        mensajeError(
          resultado.error,
          "No se pudo completar la operación. Comprueba el estado antes de volver a intentarlo.",
        ),
      )
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Recepciones pendientes</h2>
        <span className="text-xs text-muted-foreground">
          En la consulta de hasta 100 recepciones
        </span>
      </div>

      {!datosDisponibles ? (
        <VacioSeccion
          titulo={cargando ? "Cargando recepciones…" : "Datos no disponibles"}
          texto="Cuando termine la consulta, podrás revisar las propuestas."
        />
      ) : pendientes.length === 0 ? (
        <VacioSeccion
          titulo="No hay recepciones pendientes"
          texto="Analiza una foto para generar una propuesta de entrada."
        />
      ) : (
        pendientes.map((deteccion) => (
          <TarjetaRecepcion
            key={deteccion.id}
            deteccion={deteccion}
            productos={productos}
            ediciones={cantidadesEditadas[deteccion.id]}
            nombreProducto={nombreProducto}
            ocupado={ocupado}
            onCambiarCantidad={(productoId, valor) =>
              cambiarCantidad(deteccion.id, productoId, valor)
            }
            onAgregarProducto={(productoId, cantidad) =>
              void agregarProducto(deteccion, productoId, cantidad)
            }
            onRevisar={() => prepararConfirmacion(deteccion)}
            onDescartar={() => {
              setErrorDialogo(null)
              setAccion({ tipo: "descartar", deteccionId: deteccion.id })
            }}
          />
        ))
      )}

      {accion && (
        <DialogoRecepcion
          accion={accion}
          guardando={guardando}
          error={errorDialogo}
          nombreProducto={nombreProducto}
          cerrar={() => {
            if (guardando) return
            setAccion(null)
            setErrorDialogo(null)
          }}
          ejecutar={() => void ejecutarAccion()}
        />
      )}
    </section>
  )
}
