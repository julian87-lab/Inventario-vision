import csv
from collections import Counter, defaultdict
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

BASE = Path(r"C:\Users\Julia\inventario-vision-datos\dataset_base_v3")
SALIDA = Path(r"C:\Users\Julia\inventario-vision-datos\revision_escenas")
CLASES = [
    "coca_cola_1_5l", "doritos", "chocoramo", "aceite_ideal",
    "leche_alqueria", "detergente_fab", "harina_pan",
    "cafe_sello_rojo", "colgate_triple_accion", "dogchow_cachorro",
]
EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

if SALIDA.exists():
    raise SystemExit(
        "revision_escenas ya existe. No se sobrescribira el trabajo."
    )

registros = []
por_clase = defaultdict(list)

for imagen in sorted((BASE / "images").iterdir()):
    if imagen.suffix.lower() not in EXT:
        continue

    etiqueta = BASE / "labels" / f"{imagen.stem}.txt"
    lineas = [
        linea.split()
        for linea in etiqueta.read_text(encoding="utf-8").splitlines()
        if linea.strip()
    ]
    if not lineas:
        raise SystemExit(f"Etiqueta vacia: {etiqueta.name}")

    conteo = Counter(int(linea[0]) for linea in lineas)
    dominante = min(conteo, key=lambda c: (-conteo[c], c))
    registro = {
        "imagen": imagen.name,
        "clase_principal": CLASES[dominante],
        "escena": "",
    }
    registros.append(registro)
    por_clase[dominante].append(imagen)

SALIDA.mkdir(parents=True)

with (SALIDA / "escenas.csv").open(
    "w", newline="", encoding="utf-8-sig"
) as archivo:
    escritor = csv.DictWriter(
        archivo,
        fieldnames=["imagen", "clase_principal", "escena"],
        delimiter=";",
    )
    escritor.writeheader()
    escritor.writerows(registros)

for clase, imagenes in sorted(por_clase.items()):
    for inicio in range(0, len(imagenes), 12):
        lote = imagenes[inicio:inicio + 12]
        hoja = Image.new("RGB", (1200, 990), "white")
        dibujo = ImageDraw.Draw(hoja)

        for posicion, ruta in enumerate(lote):
            x = (posicion % 4) * 300
            y = (posicion // 4) * 330

            with Image.open(ruta) as original:
                miniatura = ImageOps.exif_transpose(original).convert("RGB")
                miniatura.thumbnail((290, 290))
                hoja.paste(miniatura, (x + 5, y + 5))

            dibujo.text((x + 5, y + 300), ruta.name, fill="black")

        pagina = inicio // 12 + 1
        nombre = f"{clase:02d}_{CLASES[clase]}_{pagina:02d}.jpg"
        hoja.save(SALIDA / nombre, quality=90)

print(f"Imagenes registradas: {len(registros)}")
print(f"CSV: {SALIDA / 'escenas.csv'}")
print(f"Hojas visuales: {SALIDA}")