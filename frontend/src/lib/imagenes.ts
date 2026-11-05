const MAX_UPLOAD_BYTES = 9 * 1024 * 1024
const MAX_IMAGE_SIDE = 1920

export async function prepararImagenParaSubida(file: File): Promise<File> {
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