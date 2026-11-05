import { etiquetaMovimiento } from "@/lib/inventario"

const ESTILOS: Record<string, string> = {
  venta: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  ajuste:
    "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  entrada:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  recepcion:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
}

export function InsigniaMovimiento({ tipo }: { tipo: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
        ESTILOS[tipo] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {etiquetaMovimiento(tipo)}
    </span>
  )
}