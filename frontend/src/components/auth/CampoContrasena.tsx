import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function CampoContrasena({
  id,
  etiqueta,
  value,
  onChange,
  autoComplete,
  invalido = false,
  descripcionId,
}: {
  id: string
  etiqueta: string
  value: string
  onChange: (valor: string) => void
  autoComplete: string
  invalido?: boolean
  descripcionId?: string
}) {
  const [mostrar, setMostrar] = useState(false)

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{etiqueta}</Label>

      <div className="relative">
        <Input
          id={id}
          name={id}
          type={mostrar ? "text" : "password"}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalido}
          aria-describedby={descripcionId}
          className="h-12 rounded-xl bg-background pr-12 text-base"
        />

        <button
          type="button"
          aria-label={mostrar ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={mostrar}
          aria-controls={id}
          onClick={() => setMostrar((valor) => !valor)}
          className="absolute top-0.5 right-0.5 inline-flex size-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        >
          {mostrar ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  )
}
