import {
  ArrowUpRight,
  LayoutDashboard,
  LogOut,
  Monitor,
  Moon,
  Package,
  ScanLine,
  ShieldCheck,
  Sun,
  UserRound,
} from "lucide-react"
import { NavLink, Outlet } from "react-router-dom"

import { useAuth } from "@/auth/context"
import { useTheme } from "@/components/theme-provider"

const enlaces = [
  {
    to: "/inicio",
    nombre: "Inicio",
    icono: LayoutDashboard,
  },
  {
    to: "/inventario",
    nombre: "Inventario",
    icono: Package,
  },
  {
    to: "/operaciones",
    nombre: "Operaciones",
    icono: ScanLine,
  },
  {
    to: "/perfil",
    nombre: "Perfil",
    icono: UserRound,
  },
]

const temas = [
  {
    valor: "light",
    nombre: "Claro",
    icono: Sun,
  },
  {
    valor: "dark",
    nombre: "Oscuro",
    icono: Moon,
  },
  {
    valor: "system",
    nombre: "Sistema",
    icono: Monitor,
  },
] as const

function SelectorTema() {
  const { theme, setTheme } = useTheme()

  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">
        Tema de la aplicación
      </legend>

      <div className="inline-flex items-center gap-1 rounded-full border border-border bg-background p-1">
        {temas.map(({ valor, nombre, icono: Icono }) => (
          <label
            key={valor}
            className="relative cursor-pointer"
            title={nombre}
          >
            <input
              type="radio"
              name="tema-aplicacion"
              value={valor}
              checked={theme === valor}
              onChange={() => setTheme(valor)}
              className="peer sr-only"
            />

            <span
              className={[
                "inline-flex size-9 items-center justify-center rounded-full",
                "text-muted-foreground transition-colors",
                "hover:bg-muted hover:text-foreground",
                "peer-checked:bg-primary peer-checked:text-primary-foreground",
                "peer-focus-visible:outline-2",
                "peer-focus-visible:outline-offset-2",
                "peer-focus-visible:outline-primary",
              ].join(" ")}
            >
              <Icono
                className="size-4"
                aria-hidden="true"
              />

              <span className="sr-only">{nombre}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export default function AppLayout() {
  const { user, signOut } = useAuth()

  const enlacesVisibles =
    user?.rol === "administrador"
      ? [
          ...enlaces,
          {
            to: "/administracion",
            nombre: "Administración",
            icono: ShieldCheck,
          },
        ]
      : enlaces

  const etiquetaRol =
    user?.rol === "administrador"
      ? "Administrador"
      : user?.rol === "operador"
        ? "Operador"
        : "Usuario"

  function renderEnlaces() {
    return enlacesVisibles.map(
      ({ to, nombre, icono: Icono }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            [
              "flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-4 py-3",
              "text-sm font-medium transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2",
              "focus-visible:outline-primary",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            ].join(" ")
          }
        >
          <Icono
            className="size-5 shrink-0"
            aria-hidden="true"
          />

          {nombre}
        </NavLink>
      ),
    )
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#contenido-principal"
        className="sr-only z-50 rounded-lg bg-primary p-3 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Ir al contenido
      </a>

      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col overflow-y-auto border-r border-border bg-card lg:flex">
        <NavLink
          to="/inicio"
          className="flex items-center gap-3 px-6 py-7 focus-visible:outline-2 focus-visible:outline-primary"
          aria-label="Inventario Visión: ir al inicio"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <ScanLine
              className="size-6"
              aria-hidden="true"
            />
          </span>

          <span>
            <span className="block text-base font-semibold tracking-tight">
              Inventario Visión
            </span>

            <span className="block text-xs text-muted-foreground">
              Gestión de mercancía
            </span>
          </span>
        </NavLink>

        <nav
          aria-label="Navegación principal"
          className="space-y-2 px-4 pb-5"
        >
          {renderEnlaces()}
        </nav>

        <div className="mt-auto border-t border-border p-5">
          <p className="text-sm font-medium">
            Recepción asistida
          </p>

          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Revisa los productos y las cantidades antes de
            actualizar el inventario.
          </p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Panel de gestión
              </p>

              <NavLink
                to="/perfil"
                className="mt-1 inline-flex max-w-full items-center gap-2 rounded-lg py-1 text-sm font-medium transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                aria-label={`Ver perfil de ${user?.nombre ?? "mi cuenta"}`}
              >
                <UserRound
                  className="size-4 shrink-0"
                  aria-hidden="true"
                />

                <span className="truncate">
                  {user?.nombre ?? "Mi cuenta"}
                </span>
              </NavLink>

              <p className="mt-0.5 text-xs text-muted-foreground">
                {etiquetaRol}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <SelectorTema />

              <button
                type="button"
                onClick={signOut}
                title="Cerrar sesión"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border px-3 text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-4"
              >
                <LogOut
                  className="size-4"
                  aria-hidden="true"
                />

                <span className="hidden sm:inline">
                  Cerrar sesión
                </span>

                <span className="sr-only sm:hidden">
                  Cerrar sesión
                </span>
              </button>
            </div>
          </div>
        </header>

        <nav
          aria-label="Navegación móvil"
          className="flex gap-2 overflow-x-auto border-b border-border bg-card p-2 lg:hidden"
        >
          {renderEnlaces()}
        </nav>

        <main
          id="contenido-principal"
          tabIndex={-1}
          className="mx-auto max-w-7xl px-4 py-6 focus:outline-none sm:px-6 lg:px-8 lg:py-8"
        >
          <Outlet />
        </main>

        <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-muted-foreground sm:px-6 lg:px-8">
          <span>
            Inventario Visión · Proyecto académico
          </span>

          <span className="flex items-center gap-1">
            Detección con revisión humana
            <ArrowUpRight
              className="size-3"
              aria-hidden="true"
            />
          </span>
        </footer>
      </div>
    </div>
  )
}

