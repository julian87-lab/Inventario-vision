import random
import re
import sys
from pathlib import Path

import pandas as pd
from PIL import Image, ImageDraw

EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
ESPERADAS = [
    "coca_cola_1_5l", "doritos", "chocoramo", "aceite_ideal",
    "leche_alqueria", "detergente_fab", "harina_pan", "cafe_sello_rojo",
    "colgate_triple_accion", "dogchow_cachorro",
]

raiz = Path(sys.argv[1])
yamls = list(raiz.rglob("data.yaml"))
if len(yamls) != 1:
    sys.exit(f"Se esperaba un data.yaml y hay {len(yamls)}")

texto = yamls[0].read_text(encoding="utf-8")
print("=== data.yaml ===")
print(texto[:1500])

nombres, en_names = {}, False
for linea in texto.splitlines():
    if linea.strip().startswith("names:"):
        en_names = True
        continue
    if en_names:
        m = re.match(r"^\s+(\d+):\s*(.+?)\s*$", linea)
        if m:
            nombres[int(m.group(1))] = m.group(2).strip("'\"")
        elif linea.strip():
            break

lista = [nombres.get(i) for i in range(10)]
print("Orden coincide con el catalogo:", lista == ESPERADAS)
if lista != ESPERADAS:
    print("Encontrado:", lista)

imagenes = [p for p in raiz.rglob("*") if p.suffix.lower() in EXT]
etiquetas = [p for p in raiz.rglob("*.txt") if "labels" in p.parts]
print(f"Imagenes: {len(imagenes)} | Archivos de etiquetas: {len(etiquetas)}")

sin_etiqueta = {p.stem for p in imagenes} - {p.stem for p in etiquetas}
sin_imagen = {p.stem for p in etiquetas} - {p.stem for p in imagenes}
print("Imagenes sin archivo de etiqueta:", len(sin_etiqueta))
print("Etiquetas sin imagen:", len(sin_imagen))

filas, problemas, vacias = [], [], []
for txt in etiquetas:
    lineas = [
        l.split()
        for l in txt.read_text(encoding="utf-8").splitlines()
        if l.strip()
    ]
    if not lineas:
        vacias.append(txt.stem)
    for p in lineas:
        try:
            clase = int(p[0])
            cx, cy, w, h = map(float, p[1:5])
        except (ValueError, IndexError):
            problemas.append(f"{txt.name}: linea invalida {p}")
            continue
        if clase not in range(10):
            problemas.append(f"{txt.name}: clase {clase} fuera de 0-9")
        if (w <= 0 or h <= 0 or cx - w / 2 < -0.001 or cy - h / 2 < -0.001
                or cx + w / 2 > 1.001 or cy + h / 2 > 1.001):
            problemas.append(f"{txt.name}: caja invalida o fuera de imagen")
        filas.append((txt.stem, clase))

df = pd.DataFrame(filas, columns=["imagen", "clase"])
resumen = (
    df.groupby("clase")
    .agg(cajas=("imagen", "size"), imagenes=("imagen", "nunique"))
    .reindex(range(10), fill_value=0)
)
resumen.insert(0, "nombre", ESPERADAS)
print("\n=== Cajas por clase ===")
print(resumen.to_string())
print(f"\nImagenes con etiqueta vacia: {len(vacias)}")
print(f"Problemas en cajas: {len(problemas)}")
for p in problemas[:20]:
    print(" -", p)

resumen.to_csv(raiz.parent / "resumen_clases.csv", index=False)

random.seed(7)
muestra = random.sample(imagenes, min(12, len(imagenes)))
indice = {t.stem: t for t in etiquetas}
celdas = []
for ruta in muestra:
    with Image.open(ruta) as img:
        img = img.convert("RGB")
        dibujo = ImageDraw.Draw(img)
        ancho, alto = img.size
        txt = indice.get(ruta.stem)
        if txt:
            for linea in txt.read_text(encoding="utf-8").splitlines():
                p = linea.split()
                if len(p) < 5:
                    continue
                c = int(p[0])
                cx, cy, w, h = (float(v) for v in p[1:5])
                x1, y1 = (cx - w / 2) * ancho, (cy - h / 2) * alto
                x2, y2 = (cx + w / 2) * ancho, (cy + h / 2) * alto
                dibujo.rectangle(
                    [x1, y1, x2, y2], outline="red", width=max(3, ancho // 200)
                )
                dibujo.text((x1 + 4, y1 + 4), str(c), fill="yellow")
        img.thumbnail((480, 480))
        celdas.append(img.copy())

cols = 4
filas_n = (len(celdas) + cols - 1) // cols
lienzo = Image.new("RGB", (cols * 480, filas_n * 480), "white")
for i, c in enumerate(celdas):
    lienzo.paste(c, ((i % cols) * 480, (i // cols) * 480))
lienzo.save(raiz.parent / "revision_visual.jpg", quality=85)
print("Guardado: resumen_clases.csv y revision_visual.jpg")