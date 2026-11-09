import { useState } from "react"
import { Package } from "lucide-react"

const IMAGENES: Record<number, string> = {
  0: "/productos/0.png",
  1: "/productos/1.png",
  2: "/productos/2.png",
  3: "/productos/3.png",
  4: "/productos/4.png",
  5: "/productos/5.png",
  6: "/productos/6.png",
  7: "/productos/7.png",
  8: "/productos/8.png",
  9: "/productos/9.png",
}

export function ProductoImagen({
  claseYolo,
}: {
  claseYolo: number
}) {
  const src = IMAGENES[claseYolo]

  return (
    <div
      aria-hidden="true"
      className="flex h-24 w-16 shrink-0 items-center justify-center sm:h-28 sm:w-20"
    >
      {src ? (
        <ImagenRecortada key={src} src={src} />
      ) : (
        <Package className="size-7 text-muted-foreground/50" />
      )}
    </div>
  )
}

function ImagenRecortada({ src }: { src: string }) {
  const [fallo, setFallo] = useState(false)

  if (fallo) {
    return <Package className="size-7 text-muted-foreground/50" />
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFallo(true)}
      className="max-h-full max-w-full object-contain drop-shadow-[0_4px_3px_rgba(0,0,0,0.18)]"
    />
  )
}