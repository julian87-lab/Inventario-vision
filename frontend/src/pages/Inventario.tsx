import { useCallback, useEffect, useRef, useState } from "react"
import type { ChangeEvent, FormEvent } from "react"
import {
  Camera,
  Check,
  ClipboardCheck,
  ImagePlus,
  LoaderCircle,
  Minus,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react"

import { ApiError, api, getToken, subirDeteccion } from "@/api/client"
import { Button } from "@/components/ui/button"
import type {
  Alerta,
  Deteccion,
  Movimiento,
  Producto,
} from "@/types/api"

type TipoMovimiento = "venta" | "ajuste"
type PestañaOperacion = "recepcion" | "movimientos" | "alertas" | "historial"

type ItemConfirmado = {
  producto_id: number
  cantidad_confirmada: number
}

type AccionRecepcion =
  | {
      tipo: "confirmar"
      deteccionId: number
      items: ItemConfirmado[]
    }
  | {
      tipo: "descartar"
      deteccionId: number
    }

const MAX_UPLOAD_BYTES = 9 * 1024 * 1024
const MAX_IMAGE_SIDE = 1920

const CAMPO =
  "h-11 min-w-0 rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"

const ETIQUETAS_MOVIMIENTO: Record<string, string> = {
  venta: "Venta",
  ajuste: "Ajuste",
  entrada: "Recepción",
  recepcion: "Recepción",
}

function etiquetaMovimiento(tipo: string) {
  return (
    ETIQUETAS_MOVIMIENTO[tipo] ??
    tipo.charAt(0).toUpperCase() + tipo.slice(1).replace(/_/g, " ")
  )
}

function formatearFecha(fecha: string) {
  return new Date(fecha).toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function enteroNoNegativo(valor: string) {
  if (valor.trim() === "") return false
  const numero = Number(valor)
  return Number.isSafeInteger(numero) && numero >= 0
}

function mensajeError(error: unknown, alternativa: string) {
  return error instanceof ApiError || error instanceof Error
    ? error.message
    : alternativa
}

function estadoStock(producto: Producto) {
  if (producto.stock_actual === 0) {
    return { texto: "Sin stock", punto: "bg-red-500" }
  }

  if (producto.stock_actual <= producto.umbral_alerta) {
    return { texto: "Stock bajo", punto: "bg-amber-500" }
  }

  return { texto: "Disponible", punto: "bg-emerald-500" }
}

function InsigniaMovimiento({ tipo }: { tipo: string }) {
  const estilos: Record<string, string> = {
    venta: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
    ajuste: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
    entrada:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    recepcion:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  }

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
        estilos[tipo] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {etiquetaMovimiento(tipo)}
    </span>
  )
}

async function prepararImagenParaSubida(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecciona un archivo de imagen.")
  }

  if (file.size <= MAX_UPLOAD_BYTES) return file

  const image = new Image()
  const objectUrl = URL.createObjectURL(file)

  try {
    image.src = objectUrl
    await image.decode()

    const scale = Math.min(
      1,
      MAX_IMAGE_SIDE / Math.max(image.naturalWidth, image.naturalHeight),
    )

    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))

    const context = canvas.getContext("2d")
    if (!context) {
      throw new Error("El navegador no pudo preparar la imagen.")
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result)
          else reject(new Error("No se pudo comprimir la imagen."))
        },
        "image/jpeg",
        0.86,
      )
    })

    if (blob.size > MAX_UPLOAD_BYTES) {
      throw new Error(
        "La imagen sigue superando 9 MB después de prepararla. Elige una foto más pequeña.",
      )
    }

    const name = file.name.replace(/\.[^.]+$/, "") || "recepcion"

    return new File([blob], `${name}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function FotoDeteccion({ deteccionId }: { deteccionId: number }) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    let objectUrl: string | null = null

    setSrc(null)
    setError(false)

    async function cargar() {
      try {
        const token = getToken()
        const response = await fetch(
          `/api/detecciones/${deteccionId}/imagen`,
          {
            headers: token
              ? { Authorization: `Bearer ${token}` }
              : undefined,
            signal: controller.signal,
          },
        )

        if (!response.ok) throw new Error("No se pudo cargar la foto.")

        const blob = await response.blob()
        if (controller.signal.aborted) return

        objectUrl = URL.createObjectURL(blob)
        setSrc(objectUrl)
      } catch {
        if (!controller.signal.aborted) setError(true)
      }
    }

    void cargar()

    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [deteccionId])

  if (error) {
    return (
      <div className="flex min-h-56 items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        No se pudo cargar la foto. Puedes volver a abrir esta pestaña
        para intentarlo de nuevo.
      </div>
    )
  }

  if (!src) {
    return (
      <div
        role="status"
        className="h-64 rounded-xl bg-muted motion-safe:animate-pulse"
      >
        <span className="sr-only">Cargando foto…</span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={`Foto de la recepción ${deteccionId}`}
      className="max-h-96 w-full rounded-xl border border-border bg-background object-contain"
    />
  )
}

function VacioSeccion({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-5 py-12 text-center">
      <p className="font-medium">{titulo}</p>
      <p className="mt-2 text-sm text-muted-foreground">{texto}</p>
    </div>
  )
}

function DialogoRecepcion({
  accion,
  guardando,
  error,
  nombreProducto,
  cerrar,
  ejecutar,
}: {
  accion: AccionRecepcion
  guardando: boolean
  error: string | null
  nombreProducto: (id: number) => string
  cerrar: () => void
  ejecutar: () => void
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const confirmar = accion.tipo === "confirmar"
  const total =
    accion.tipo === "confirmar"
      ? accion.items.reduce((suma, item) => suma + item.cantidad_confirmada, 0)
      : 0

  useEffect(() => {
    const elemento = dialogo.current
    if (elemento && !elemento.open) elemento.showModal()

    return () => {
      if (elemento?.open) elemento.close()
    }
  }, [])

  return (
    <dialog
      ref={dialogo}
      aria-labelledby="titulo-confirmacion-recepcion"
      aria-describedby="descripcion-confirmacion-recepcion"
      onCancel={(event) => {
        event.preventDefault()
        if (!guardando) cerrar()
      }}
      className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/60"
    >
      <div className="space-y-5 p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-primary">
              Recepción #{accion.deteccionId}
            </p>
            <h2
              id="titulo-confirmacion-recepcion"
              className="mt-2 text-xl font-semibold"
            >
              {confirmar ? "Confirmar entrada de mercancía" : "Descartar recepción"}
            </h2>
          </div>

          <button
            type="button"
            aria-label="Cerrar confirmación"
            disabled={guardando}
            onClick={cerrar}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>

        <p
          id="descripcion-confirmacion-recepcion"
          className="text-sm leading-6 text-muted-foreground"
        >
          {confirmar
            ? "Estas cantidades se sumarán a las existencias. Revisa el resumen antes de continuar."
            : "La propuesta dejará de estar pendiente. Descartarla no modifica las existencias."}
        </p>

        {accion.tipo === "confirmar" && (
          <>
            <ul className="max-h-60 divide-y divide-border overflow-y-auto rounded-xl border border-border">
              {accion.items.map((item) => (
                <li
                  key={item.producto_id}
                  className="flex items-center justify-between gap-4 p-3 text-sm"
                >
                  <span>{nombreProducto(item.producto_id)}</span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    +{item.cantidad_confirmada}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between rounded-xl bg-primary/10 p-4 text-sm">
              <span>Total de unidades a añadir</span>
              <span className="text-xl font-semibold tabular-nums">
                {total}
              </span>
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            autoFocus
            disabled={guardando}
            onClick={cerrar}
          >
            Volver a revisar
          </Button>

          <Button
            type="button"
            disabled={guardando}
            onClick={ejecutar}
            className={
              confirmar
                ? ""
                : "bg-destructive text-white hover:bg-destructive/90"
            }
          >
            {guardando ? (
              <>
                <LoaderCircle
                  className="mr-2 size-4 motion-safe:animate-spin"
                  aria-hidden="true"
                />
                Guardando…
              </>
            ) : confirmar ? (
              "Confirmar y actualizar stock"
            ) : (
              "Sí, descartar"
            )}
          </Button>
        </div>
      </div>
    </dialog>
  )
}

export default function Inventario() {
  const [pestaña, setPestaña] = useState<PestañaOperacion>("recepcion")
  const [productos, setProductos] = useState<Producto[]>([])
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [detecciones, setDetecciones] = useState<Deteccion[]>([])

  const [productoId, setProductoId] = useState("")
  const [tipo, setTipo] = useState<TipoMovimiento>("venta")
  const [cantidad, setCantidad] = useState("")
  const [busquedaProducto, setBusquedaProducto] = useState("")

  const [archivo, setArchivo] = useState<File | null>(null)
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null)
  const [cantidadesEditadas, setCantidadesEditadas] = useState<
    Record<number, Record<number, string>>
  >({})

  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [datosDisponibles, setDatosDisponibles] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [accion, setAccion] = useState<AccionRecepcion | null>(null)
  const [errorDialogo, setErrorDialogo] = useState<string | null>(null)

  const bloqueoEscritura = useRef(false)
  const solicitudCarga = useRef<Promise<void> | null>(null)

  const cargarDatos = useCallback((): Promise<void> => {
    if (solicitudCarga.current) return solicitudCarga.current

    setCargando(true)

    const solicitud = (async () => {
      try {
        const [
          listaProductos,
          listaMovimientos,
          listaAlertas,
          listaDetecciones,
        ] = await Promise.all([
          api.get<Producto[]>("/productos"),
          api.get<Movimiento[]>("/inventario/movimientos?limite=100"),
          api.get<Alerta[]>("/alertas"),
          api.get<Deteccion[]>("/detecciones?limite=100"),
        ])

        setProductos(listaProductos)
        setMovimientos(listaMovimientos)
        setAlertas(listaAlertas.filter((alerta) => !alerta.atendida))
        setDetecciones(listaDetecciones)
        setDatosDisponibles(true)

        setProductoId((actual) =>
          listaProductos.some((producto) => String(producto.id) === actual)
            ? actual
            : String(listaProductos[0]?.id ?? ""),
        )
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
    void cargarDatos()
  }, [cargarDatos])

  useEffect(() => {
    if (!archivo) {
      setVistaPrevia(null)
      return
    }

    const url = URL.createObjectURL(archivo)
    setVistaPrevia(url)
    return () => URL.revokeObjectURL(url)
  }, [archivo])

  const ocupado = cargando || subiendo || guardando

  const pendientes = detecciones.filter(
    (deteccion) => deteccion.estado === "pendiente",
  )

  const nombreProducto = (id: number) =>
    productos.find((producto) => producto.id === id)?.nombre ??
    `Producto #${id}`

  const productoSeleccionado = productos.find(
    (producto) => String(producto.id) === productoId,
  )

  const productosFiltrados = productos.filter((producto) =>
    normalizar(producto.nombre).includes(normalizar(busquedaProducto)),
  )

  const unidadesMovimiento = Number(cantidad)
  const cantidadValida =
    cantidad.trim() !== "" &&
    Number.isSafeInteger(unidadesMovimiento) &&
    unidadesMovimiento !== 0 &&
    (tipo !== "venta" || unidadesMovimiento > 0)

  const stockResultante =
    productoSeleccionado && cantidadValida
      ? productoSeleccionado.stock_actual +
        (tipo === "venta" ? -unidadesMovimiento : unidadesMovimiento)
      : null

  const pestañas: {
    id: PestañaOperacion
    nombre: string
    contador?: number
  }[] = [
    { id: "recepcion", nombre: "Recibir mercancía", contador: pendientes.length },
    { id: "movimientos", nombre: "Ventas y ajustes" },
    { id: "alertas", nombre: "Alertas", contador: alertas.length },
    { id: "historial", nombre: "Historial" },
  ]

  function cambiarTipo(nuevo: TipoMovimiento) {
    setTipo(nuevo)
    if (nuevo === "venta" && Number(cantidad) < 0) setCantidad("")
  }

  function moverCantidad(delta: number) {
    const siguiente = (Number(cantidad) || 0) + delta
    setCantidad(String(tipo === "venta" ? Math.max(1, siguiente) : siguiente))
  }

  function cambiarPestaña(nueva: PestañaOperacion) {
    setPestaña(nueva)
    setMensaje(null)
  }

  function seleccionarArchivo(event: ChangeEvent<HTMLInputElement>) {
    const seleccionado = event.target.files?.[0]
    if (seleccionado) setArchivo(seleccionado)
    event.target.value = ""
  }

  function valorCantidad(deteccion: Deteccion, productoIdItem: number) {
    const item = deteccion.items.find(
      (elemento) => elemento.producto_id === productoIdItem,
    )

    return (
      cantidadesEditadas[deteccion.id]?.[productoIdItem] ??
      String(item?.cantidad_detectada ?? 0)
    )
  }

  function cambiarCantidadConfirmada(
    deteccionId: number,
    productoIdItem: number,
    valor: string,
  ) {
    setCantidadesEditadas((actuales) => ({
      ...actuales,
      [deteccionId]: {
        ...actuales[deteccionId],
        [productoIdItem]: valor,
      },
    }))
  }

  function prepararConfirmacion(deteccion: Deteccion) {
    setError(null)
    setMensaje(null)

    if (
      deteccion.items.length === 0 ||
      deteccion.items.some(
        (item) =>
          !enteroNoNegativo(valorCantidad(deteccion, item.producto_id)),
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
        valorCantidad(deteccion, item.producto_id),
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

  async function enviarFoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (bloqueoEscritura.current || cargando) return

    setError(null)
    setMensaje(null)

    if (!archivo) {
      setError("Toma una foto o elige una imagen de la galería.")
      return
    }

    bloqueoEscritura.current = true
    setSubiendo(true)

    try {
      const imagenLista = await prepararImagenParaSubida(archivo)
      const deteccion = await subirDeteccion(imagenLista)

      setArchivo(null)
      setMensaje(
        `Foto procesada. La recepción #${deteccion.id} está pendiente de revisión; el stock aún no cambió.`,
      )

      await cargarDatos()
    } catch (err) {
      setError(mensajeError(err, "No se pudo subir y procesar la foto."))
    } finally {
      bloqueoEscritura.current = false
      setSubiendo(false)
    }
  }

  async function ejecutarAccionRecepcion() {
    if (!accion || bloqueoEscritura.current || cargando) return

    bloqueoEscritura.current = true
    setGuardando(true)
    setErrorDialogo(null)
    setError(null)
    setMensaje(null)

    try {
      if (accion.tipo === "confirmar") {
        await api.post<Deteccion>(
          `/detecciones/${accion.deteccionId}/confirmar`,
          JSON.stringify({ items: accion.items }),
        )
      } else {
        await api.post<Deteccion>(
          `/detecciones/${accion.deteccionId}/descartar`,
          JSON.stringify({
            motivo: "Descartada desde la pantalla de inventario",
          }),
        )
      }
    } catch (err) {
      setErrorDialogo(
        mensajeError(
          err,
          "No se pudo completar la operación. Comprueba el estado antes de volver a intentarlo.",
        ),
      )
      bloqueoEscritura.current = false
      setGuardando(false)
      return
    }

    const completada = accion
    setAccion(null)

    setDetecciones((actuales) =>
      actuales.filter((deteccion) => deteccion.id !== completada.deteccionId),
    )

    setCantidadesEditadas((actuales) => {
      const siguientes = { ...actuales }
      delete siguientes[completada.deteccionId]
      return siguientes
    })

    setMensaje(
      completada.tipo === "confirmar"
        ? `Recepción #${completada.deteccionId} confirmada. El inventario fue actualizado.`
        : `Recepción #${completada.deteccionId} descartada. El stock no cambió.`,
    )

    await cargarDatos()
    bloqueoEscritura.current = false
    setGuardando(false)
  }

  async function registrarMovimiento(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (bloqueoEscritura.current || cargando) return

    setError(null)
    setMensaje(null)

    if (!productoSeleccionado || !cantidadValida) {
      setError(
        tipo === "venta"
          ? "Selecciona un producto e ingresa una cantidad entera positiva."
          : "Selecciona un producto e ingresa una cantidad entera distinta de cero.",
      )
      return
    }

    if (stockResultante === null || stockResultante < 0) {
      setError("El movimiento dejaría existencias negativas. Revisa la cantidad.")
      return
    }

    bloqueoEscritura.current = true
    setGuardando(true)

    try {
      await api.post<Movimiento>(
        "/inventario/movimientos",
        JSON.stringify({
          producto_id: Number(productoId),
          tipo,
          cantidad: unidadesMovimiento,
        }),
      )

      setCantidad("")
      setMensaje("Movimiento registrado correctamente.")
      await cargarDatos()
    } catch (err) {
      setError(mensajeError(err, "No fue posible registrar el movimiento."))
    } finally {
      bloqueoEscritura.current = false
      setGuardando(false)
    }
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
            Recibe mercancía, registra salidas y consulta la actividad del inventario.
          </p>
        </div>

        <Button
          variant="outline"
          disabled={ocupado}
          onClick={() => {
            setError(null)
            void cargarDatos()
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

      {pestaña === "recepcion" && (
        <>
          <section className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div>
              <h2 className="text-lg font-semibold">Recibir mercancía por foto</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Fotografía, revisa y confirma. Las existencias no cambian al analizar la imagen.
              </p>
            </div>

            <form onSubmit={enviarFoto}>
              <fieldset disabled={ocupado} className="min-w-0 space-y-4">
                <legend className="sr-only">Fotografía de la mercancía</legend>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex min-h-16 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-center font-medium text-primary-foreground hover:opacity-90 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary">
                    <Camera className="size-5" aria-hidden="true" />
                    Tomar foto
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={seleccionarArchivo}
                    />
                  </label>

                  <label className="flex min-h-16 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-center font-medium hover:bg-muted has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary">
                    <ImagePlus className="size-5" aria-hidden="true" />
                    Elegir de la galería
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={seleccionarArchivo}
                    />
                  </label>
                </div>

                {archivo && (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <p className="break-all text-muted-foreground">
                      {archivo.name} · {(archivo.size / (1024 * 1024)).toFixed(1)} MB
                    </p>
                    <button
                      type="button"
                      onClick={() => setArchivo(null)}
                      className="rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      Quitar imagen
                    </button>
                  </div>
                )}

                {vistaPrevia && (
                  <img
                    src={vistaPrevia}
                    alt="Vista previa de la mercancía"
                    className="max-h-80 w-full rounded-xl border border-border bg-background object-contain"
                  />
                )}

                <Button
                  className="min-h-12 w-full sm:w-auto"
                  type="submit"
                  disabled={ocupado || !archivo}
                >
                  {subiendo && (
                    <LoaderCircle
                      className="mr-2 size-4 motion-safe:animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  {subiendo ? "Preparando y analizando…" : "Analizar recepción"}
                </Button>

                {subiendo && (
                  <p role="status" className="text-sm text-primary">
                    Estamos procesando la fotografía. Espera antes de volver a enviarla.
                  </p>
                )}

                <p className="text-xs text-muted-foreground">
                  En teléfonos compatibles se ofrece la cámara trasera.
                  También puedes seleccionar una imagen de la galería.
                </p>
              </fieldset>
            </form>
          </section>

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
              pendientes.map((deteccion) => {
                const validas = deteccion.items.every((item) =>
                  enteroNoNegativo(valorCantidad(deteccion, item.producto_id)),
                )

                const total = validas
                  ? deteccion.items.reduce(
                      (suma, item) =>
                        suma + Number(valorCantidad(deteccion, item.producto_id)),
                      0,
                    )
                  : null

                const incluidos = deteccion.items.filter(
                  (item) =>
                    enteroNoNegativo(valorCantidad(deteccion, item.producto_id)) &&
                    Number(valorCantidad(deteccion, item.producto_id)) > 0,
                ).length

                return (
                  <article
                    key={deteccion.id}
                    className="overflow-hidden rounded-2xl border border-border bg-card"
                  >
                    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
                      <div>
                        <h3 className="font-semibold">Recepción #{deteccion.id}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatearFecha(deteccion.fecha_hora)}
                        </p>
                      </div>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                        Pendiente de revisión
                      </span>
                    </header>

                    <div className="grid gap-6 p-5 xl:grid-cols-2">
                      <div className="space-y-3">
                        <FotoDeteccion deteccionId={deteccion.id} />
                        <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                          Compara la foto con la mercancía recibida. La revisión
                          humana es necesaria antes de actualizar el inventario.
                        </p>
                      </div>

                      <div className="min-w-0 space-y-4">
                        <div>
                          <h4 className="font-medium">Revisa las cantidades</h4>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Puedes corregir cantidades de los productos detectados.
                            Escribe cero si un producto no debe sumarse.
                          </p>
                        </div>

                        {deteccion.items.length === 0 ? (
                          <VacioSeccion
                            titulo="No se identificaron productos"
                            texto="Descarta esta propuesta y prueba una foto más clara."
                          />
                        ) : (
                          <div className="space-y-3">
                            {deteccion.items.map((item) => {
                              const valor = valorCantidad(deteccion, item.producto_id)
                              const invalido = !enteroNoNegativo(valor)
                              const editado =
                                !invalido && Number(valor) !== item.cantidad_detectada
                              const idCampo = `cantidad-${deteccion.id}-${item.id}`

                              return (
                                <div
                                  key={item.id}
                                  className="rounded-xl border border-border bg-background p-4"
                                >
                                  <label htmlFor={idCampo} className="block text-sm font-medium">
                                    {nombreProducto(item.producto_id)}
                                  </label>

                                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                                    <div className="text-xs text-muted-foreground">
                                      <p>Detectadas: {item.cantidad_detectada}</p>
                                      {editado && (
                                        <span className="mt-1 inline-flex items-center gap-1 text-primary">
                                          <Check className="size-3" aria-hidden="true" />
                                          Cantidad corregida
                                        </span>
                                      )}
                                    </div>

                                    <div className="w-32">
                                      <label htmlFor={idCampo} className="mb-1 block text-xs text-muted-foreground">
                                        A confirmar
                                      </label>
                                      <input
                                        id={idCampo}
                                        className={`${CAMPO} w-full text-center font-semibold tabular-nums ${
                                          invalido ? "border-destructive" : ""
                                        }`}
                                        type="number"
                                        inputMode="numeric"
                                        min="0"
                                        step="1"
                                        disabled={ocupado}
                                        aria-invalid={invalido}
                                        aria-describedby={invalido ? `${idCampo}-error` : undefined}
                                        value={valor}
                                        onChange={(event) =>
                                          cambiarCantidadConfirmada(
                                            deteccion.id,
                                            item.producto_id,
                                            event.target.value,
                                          )
                                        }
                                      />
                                    </div>
                                  </div>

                                  {invalido && (
                                    <p id={`${idCampo}-error`} className="mt-2 text-xs text-destructive">
                                      Escribe un entero igual o mayor que cero.
                                    </p>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                          <p className="flex items-center gap-2 text-sm font-medium">
                            <ClipboardCheck className="size-4 text-primary" aria-hidden="true" />
                            Resumen de entrada
                          </p>
                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-muted-foreground">Productos con entrada</p>
                              <p className="mt-1 text-xl font-semibold tabular-nums">{incluidos}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Unidades a añadir</p>
                              <p className="mt-1 text-xl font-semibold tabular-nums">
                                {total === null ? "—" : `+${total}`}
                              </p>
                            </div>
                          </div>
                        </div>

                        <p className="text-xs leading-5 text-muted-foreground">
                          No puedes añadir aquí un producto que el modelo no
                          detectó. Si falta mercancía, no confirmes una propuesta
                          incompleta: descártala y prueba otra fotografía.
                        </p>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            className="min-h-11"
                            disabled={ocupado || total === null || total === 0}
                            onClick={() => prepararConfirmacion(deteccion)}
                          >
                            Revisar y confirmar
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-11"
                            disabled={ocupado}
                            onClick={() => {
                              setErrorDialogo(null)
                              setAccion({ tipo: "descartar", deteccionId: deteccion.id })
                            }}
                          >
                            Descartar
                          </Button>
                        </div>

                        {total === 0 && deteccion.items.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Todas las cantidades son cero. Descarta la propuesta
                            si no corresponde registrar una entrada.
                          </p>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })
            )}
          </section>
        </>
      )}

      {pestaña === "movimientos" && (
        <form onSubmit={registrarMovimiento}>
          <fieldset
            disabled={ocupado}
            className="grid min-w-0 gap-6 lg:grid-cols-[1.2fr_1fr]"
          >
            <legend className="sr-only">Registrar venta o ajuste</legend>

            <section className="min-w-0 space-y-4 rounded-2xl border border-border bg-card p-5">
              <div>
                <h2 className="text-lg font-semibold">1. Elige el producto</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Busca por nombre y selecciónalo de la lista.
                </p>
              </div>

              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <label htmlFor="buscar-producto-movimiento" className="sr-only">
                  Buscar producto
                </label>
                <input
                  id="buscar-producto-movimiento"
                  type="search"
                  value={busquedaProducto}
                  onChange={(event) => setBusquedaProducto(event.target.value)}
                  placeholder="Buscar producto…"
                  className={`${CAMPO} w-full pl-10`}
                />
              </div>

              <fieldset className="max-h-80 min-w-0 space-y-2 overflow-y-auto pr-1">
                <legend className="sr-only">Producto</legend>

                {productosFiltrados.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No hay productos que coincidan.
                  </p>
                ) : (
                  productosFiltrados.map((producto) => {
                    const activo = String(producto.id) === productoId
                    const estado = estadoStock(producto)

                    return (
                      <label key={producto.id} className="block cursor-pointer">
                        <input
                          type="radio"
                          name="producto-movimiento"
                          value={producto.id}
                          checked={activo}
                          onChange={() => setProductoId(String(producto.id))}
                          className="peer sr-only"
                        />
                        <span
                          className={`flex w-full items-center justify-between gap-4 rounded-xl border p-3.5 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary ${
                            activo
                              ? "border-primary bg-primary/10"
                              : "border-border hover:bg-muted"
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{producto.nombre}</span>
                            <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                              <span className={`size-2 rounded-full ${estado.punto}`} aria-hidden="true" />
                              {estado.texto}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block text-lg font-semibold tabular-nums">{producto.stock_actual}</span>
                            <span className="text-xs text-muted-foreground">unidades</span>
                          </span>
                        </span>
                      </label>
                    )
                  })
                )}
              </fieldset>
            </section>

            <section className="min-w-0 space-y-5 rounded-2xl border border-border bg-card p-5 lg:self-start">
              <div>
                <h2 className="text-lg font-semibold">2. Indica el movimiento</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Las recepciones de mercancía se registran desde su pestaña.
                </p>
              </div>

              <fieldset className="grid min-w-0 grid-cols-2 gap-2 rounded-2xl bg-muted p-1.5">
                <legend className="sr-only">Tipo de movimiento</legend>
                {([
                  { id: "venta", nombre: "Venta", detalle: "Resta unidades" },
                  { id: "ajuste", nombre: "Ajuste", detalle: "Suma o resta" },
                ] as const).map((opcion) => (
                  <label key={opcion.id} className="cursor-pointer">
                    <input
                      type="radio"
                      name="tipo-movimiento"
                      value={opcion.id}
                      checked={tipo === opcion.id}
                      onChange={() => cambiarTipo(opcion.id)}
                      className="peer sr-only"
                    />
                    <span
                      className={`block rounded-xl px-3 py-3 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-primary ${
                        tipo === opcion.id
                          ? "bg-card shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="block text-sm font-semibold">{opcion.nombre}</span>
                      <span className="block text-xs text-muted-foreground">{opcion.detalle}</span>
                    </span>
                  </label>
                ))}
              </fieldset>

              <div className="grid gap-1.5">
                <label htmlFor="cantidad-movimiento" className="text-sm font-medium">Cantidad</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Disminuir cantidad"
                    onClick={() => moverCantidad(-1)}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <Minus className="size-4" aria-hidden="true" />
                  </button>

                  <input
                    id="cantidad-movimiento"
                    className={`${CAMPO} w-full text-center text-lg font-semibold tabular-nums`}
                    type="number"
                    inputMode="numeric"
                    min={tipo === "venta" ? 1 : undefined}
                    step="1"
                    value={cantidad}
                    onChange={(event) => setCantidad(event.target.value)}
                    placeholder={tipo === "venta" ? "2" : "-2 o 5"}
                    required
                  />

                  <button
                    type="button"
                    aria-label="Aumentar cantidad"
                    onClick={() => moverCantidad(1)}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {tipo === "venta"
                    ? "Escribe las unidades vendidas como número positivo."
                    : "Usa un número positivo para sumar y uno negativo para restar."}
                </p>
              </div>

              <div aria-live="polite" className="rounded-xl border border-border bg-background p-4 text-sm">
                {productoSeleccionado ? (
                  <>
                    <p className="font-medium">{productoSeleccionado.nombre}</p>
                    <p className="mt-2 text-muted-foreground">
                      Stock actual:{" "}
                      <span className="font-semibold text-foreground tabular-nums">
                        {productoSeleccionado.stock_actual}
                      </span>
                      {stockResultante !== null && (
                        <>
                          {" → "}
                          <span className={`font-semibold tabular-nums ${stockResultante < 0 ? "text-destructive" : "text-foreground"}`}>
                            {stockResultante}
                          </span>
                        </>
                      )}
                    </p>
                    {stockResultante !== null && stockResultante < 0 && (
                      <p className="mt-2 text-destructive">
                        El resultado sería negativo; revisa la cantidad.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground">Selecciona un producto.</p>
                )}
              </div>

              <Button
                type="submit"
                className="min-h-12 w-full"
                disabled={
                  ocupado ||
                  !productoSeleccionado ||
                  !cantidadValida ||
                  stockResultante === null ||
                  stockResultante < 0
                }
              >
                {guardando ? "Guardando…" : "Registrar movimiento"}
              </Button>
            </section>
          </fieldset>
        </form>
      )}

      {pestaña === "alertas" && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Alertas pendientes</h2>

          {alertas.length === 0 ? (
            <VacioSeccion
              titulo={datosDisponibles ? "No hay alertas pendientes" : "Alertas no disponibles"}
              texto="Las alertas pendientes aparecerán aquí después de consultar los datos."
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th scope="col" className="p-4 font-medium">Producto</th>
                    <th scope="col" className="p-4 font-medium">Alerta</th>
                    <th scope="col" className="p-4 font-medium">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {alertas.map((alerta) => (
                    <tr key={alerta.id} className="border-t border-border">
                      <td className="p-4 font-medium">{nombreProducto(alerta.producto_id)}</td>
                      <td className="p-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                            alerta.tipo === "sin_stock"
                              ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
                              : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                          }`}
                        >
                          {alerta.tipo === "sin_stock" ? "Sin stock" : "Stock bajo"}
                        </span>
                      </td>
                      <td className="p-4 text-muted-foreground">{formatearFecha(alerta.fecha_hora)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {pestaña === "historial" && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Historial de movimientos</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Consulta de hasta 100 movimientos.
            </p>
          </div>

          {movimientos.length === 0 ? (
            <VacioSeccion
              titulo={datosDisponibles ? "Todavía no hay movimientos" : "Historial no disponible"}
              texto="Las ventas, ajustes y recepciones confirmadas aparecerán aquí."
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th scope="col" className="p-4 font-medium">Fecha</th>
                    <th scope="col" className="p-4 font-medium">Producto</th>
                    <th scope="col" className="p-4 font-medium">Tipo</th>
                    <th scope="col" className="p-4 text-right font-medium">Cambio</th>
                    <th scope="col" className="p-4 text-right font-medium">Antes</th>
                    <th scope="col" className="p-4 text-right font-medium">Después</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((movimiento) => (
                    <tr key={movimiento.id} className="border-t border-border">
                      <td className="p-4 whitespace-nowrap text-muted-foreground">
                        {formatearFecha(movimiento.fecha_hora)}
                      </td>
                      <td className="p-4 font-medium">{nombreProducto(movimiento.producto_id)}</td>
                      <td className="p-4"><InsigniaMovimiento tipo={movimiento.tipo} /></td>
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
                      <td className="p-4 text-right tabular-nums">{movimiento.stock_antes}</td>
                      <td className="p-4 text-right tabular-nums">{movimiento.stock_despues}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {accion && (
        <DialogoRecepcion
          accion={accion}
          guardando={guardando}
          error={errorDialogo}
          nombreProducto={nombreProducto}
          cerrar={() => {
            if (bloqueoEscritura.current) return
            setAccion(null)
            setErrorDialogo(null)
          }}
          ejecutar={() => void ejecutarAccionRecepcion()}
        />
      )}
    </div>
  )
}