import { Monitor, Moon, Sun } from "lucide-react"

import { useTheme } from "@/components/theme-provider"

const opciones = [
  { valor: "light", nombre: "Claro", icono: Sun },
  { valor: "dark", nombre: "Oscuro", icono: Moon },
  { valor: "system", nombre: "Sistema", icono: Monitor },
] as const

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()

  return (
    <div
      role="radiogroup"
      aria-label="Tema de la aplicación"
      className="inline-flex rounded-full border border-border bg-card p-1"
    >
      {opciones.map(({ valor, nombre, icono: Icono }) => (
        <button
          key={valor}
          type="button"
          role="radio"
          aria-checked={theme === valor}
          aria-label={nombre}
          title={nombre}
          onClick={() => setTheme(valor)}
          className={`inline-flex size-9 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
            theme === valor
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Icono className="size-4" aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}