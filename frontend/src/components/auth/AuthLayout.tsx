import type { ReactNode } from "react"
import { Boxes, Camera, ClipboardCheck, ScanLine } from "lucide-react"

const PASOS = [
  {
    icono: Camera,
    titulo: "Fotografía",
    texto: "Toma una foto de la mercancía que llegó.",
  },
  {
    icono: ClipboardCheck,
    titulo: "Revisa",
    texto: "Comprueba los productos y corrige las cantidades.",
  },
  {
    icono: Boxes,
    titulo: "Confirma",
    texto: "Las existencias cambian solo cuando tú lo apruebas.",
  },
]

function Marca() {
  return (
    <div className="relative flex items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary-foreground text-primary sm:size-11">
        <ScanLine className="size-6" aria-hidden="true" />
      </span>

      <span>
        <span className="block text-base font-semibold tracking-tight">
          Inventario Visión
        </span>
        <span className="block text-xs opacity-85">
          Gestión de mercancía
        </span>
      </span>
    </div>
  )
}

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground lg:grid lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative overflow-hidden bg-primary text-primary-foreground">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1.5 bg-[repeating-linear-gradient(90deg,#fbbf24_0_24px,transparent_24px_48px)]"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -right-20 size-64 rounded-full border-[32px] border-primary-foreground/5 lg:top-auto lg:-bottom-24 lg:size-96 lg:border-[48px]"
        />

        <div className="relative mx-auto flex h-full max-w-lg flex-col px-6 pt-7 pb-12 sm:px-8 lg:max-w-none lg:justify-between lg:gap-12 lg:p-12 xl:p-16">
          <Marca />

          <div className="mt-6 lg:mt-0 lg:max-w-lg">
            <p className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              Tu inventario,
              <br className="hidden lg:block" /> a la vista.
            </p>

            <p className="mt-3 max-w-sm text-sm leading-6 opacity-90 lg:mt-5 lg:max-w-lg lg:text-lg lg:leading-8">
              <span className="lg:hidden">
                Fotografía tu mercancía. Tú revisas y decides.
              </span>
              <span className="hidden lg:inline">
                Fotografía tu mercancía, revisa las cantidades y confirma
                la entrada. Tú mantienes el control del inventario.
              </span>
            </p>

            <ol
              aria-label="Cómo funciona"
              className="mt-5 flex flex-wrap gap-x-4 gap-y-2 lg:mt-10 lg:block lg:space-y-5"
            >
              {PASOS.map(({ icono: Icono, titulo, texto }, indice) => (
                <li
                  key={titulo}
                  className="flex items-center gap-1.5 lg:items-start lg:gap-4"
                >
                  <span className="inline-flex shrink-0 items-center justify-center lg:size-10 lg:rounded-xl lg:bg-primary-foreground/15">
                    <Icono
                      className="size-3.5 lg:size-5"
                      aria-hidden="true"
                    />
                  </span>

                  <span>
                    <span className="block text-xs font-medium lg:text-base">
                      <span className="hidden lg:inline">
                        {indice + 1}.{" "}
                      </span>
                      {titulo}
                    </span>
                    <span className="hidden text-sm opacity-90 lg:block">
                      {texto}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <p className="hidden text-xs leading-5 opacity-85 lg:block">
            Tecnología como apoyo. Revisión humana antes de actualizar
            las existencias.
          </p>
        </div>
      </aside>

      <main
        aria-labelledby="titulo-auth"
        className="relative mx-auto -mt-5 w-full max-w-lg px-4 pb-6 sm:px-6 lg:m-0 lg:flex lg:max-w-none lg:items-center lg:justify-center lg:px-10 lg:py-12"
      >
        <div className="w-full rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8 lg:max-w-md lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          {children}

          <footer className="mt-6 border-t border-border pt-4 text-center text-xs leading-5 text-muted-foreground">
            Inventario Visión · Proyecto académico
            <span className="block lg:hidden">
              Detección con revisión humana
            </span>
          </footer>
        </div>
      </main>
    </div>
  )
}
