import math
import shutil
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import pandas as pd
from PIL import Image, ImageOps

CLASES = [
    "coca_cola_1_5l", "doritos", "chocoramo", "aceite_ideal",
    "leche_alqueria", "detergente_fab", "harina_pan", "cafe_sello_rojo",
    "colgate_triple_accion", "dogchow_cachorro",
]
ID = {nombre: i for i, nombre in enumerate(CLASES)}
EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

xml_path = Path(sys.argv[1])
carpeta_imagenes = Path(sys.argv[2])
salida = Path(sys.argv[3])

if salida.exists() and any(salida.iterdir()):
    sys.exit(f"La carpeta de salida no esta vacia: {salida}")
(salida / "images").mkdir(parents=True, exist_ok=True)
(salida / "labels").mkdir(parents=True, exist_ok=True)

archivos = {}
for p in carpeta_imagenes.rglob("*"):
    if p.suffix.lower() in EXT:
        clave = p.stem.lower()
        if clave in archivos:
            sys.exit(f"Nombre de imagen repetido: {p.name}")
        archivos[clave] = p

raiz = ET.parse(xml_path).getroot()
filas, avisos = [], []
sin_cajas, sin_archivo, vistos = [], [], set()
rotadas_total, rotadas_img = 0, set()

for nodo in raiz.iter("image"):
    nombre = nodo.get("name")
    clave = Path(nombre).stem.lower()
    ancho, alto = float(nodo.get("width")), float(nodo.get("height"))
    ruta = archivos.get(clave)
    if ruta is None:
        sin_archivo.append(nombre)
        continue
    vistos.add(clave)

    with Image.open(ruta) as img:
        crudo = img.size
        girado = ImageOps.exif_transpose(img).size
    if (int(ancho), int(alto)) != crudo:
        avisos.append(f"{nombre}: tamano XML {int(ancho)}x{int(alto)} vs archivo {crudo}")
        continue
    if girado != crudo:
        avisos.append(f"{nombre}: tiene orientacion EXIF, revisar")

    lineas = []
    for forma in nodo:
        if forma.tag != "box":
            avisos.append(f"{nombre}: forma no soportada <{forma.tag}>")
            continue
        etiqueta = forma.get("label")
        if etiqueta not in ID:
            avisos.append(f"{nombre}: etiqueta desconocida {etiqueta}")
            continue
        xtl, ytl = float(forma.get("xtl")), float(forma.get("ytl"))
        xbr, ybr = float(forma.get("xbr")), float(forma.get("ybr"))
        angulo = float(forma.get("rotation", "0"))
        cx, cy = (xtl + xbr) / 2, (ytl + ybr) / 2
        w, h = xbr - xtl, ybr - ytl
        if angulo:
            a = math.radians(angulo)
            c, s = abs(math.cos(a)), abs(math.sin(a))
            w, h = w * c + h * s, w * s + h * c
            rotadas_total += 1
            rotadas_img.add(nombre)
        x1, y1 = max(0.0, cx - w / 2), max(0.0, cy - h / 2)
        x2, y2 = min(ancho, cx + w / 2), min(alto, cy + h / 2)
        if x2 - x1 < 2 or y2 - y1 < 2:
            avisos.append(f"{nombre}: caja demasiado pequena")
            continue
        lineas.append(
            f"{ID[etiqueta]} {(x1 + x2) / 2 / ancho:.6f} "
            f"{(y1 + y2) / 2 / alto:.6f} {(x2 - x1) / ancho:.6f} "
            f"{(y2 - y1) / alto:.6f}"
        )
        filas.append((ruta.stem, ID[etiqueta]))

    if not lineas:
        sin_cajas.append(nombre)
        continue
    shutil.copy2(ruta, salida / "images" / ruta.name)
    (salida / "labels" / f"{ruta.stem}.txt").write_text(
        "\n".join(lineas) + "\n", encoding="utf-8"
    )

df = pd.DataFrame(filas, columns=["imagen", "clase"])
resumen = (
    df.groupby("clase")
    .agg(cajas=("imagen", "size"), imagenes=("imagen", "nunique"))
    .reindex(range(10), fill_value=0)
)
resumen.insert(0, "nombre", CLASES)
print(resumen.to_string())
print(f"\nImagenes convertidas: {df['imagen'].nunique()}")
print(f"Cajas rotadas convertidas a rectas: {rotadas_total} en {len(rotadas_img)} imagenes")
print(f"Imagenes de la carpeta que no estan en el XML: {len(set(archivos) - vistos)}")
print(f"Imagenes del XML sin archivo: {len(sin_archivo)} {sin_archivo[:10]}")
print(f"Imagenes sin cajas validas: {len(sin_cajas)} {sin_cajas[:15]}")
print(f"Avisos: {len(avisos)}")
for aviso in avisos[:20]:
    print(" -", aviso)
resumen.to_csv(salida / "resumen_clases.csv", index=False)