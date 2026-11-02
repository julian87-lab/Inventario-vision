import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw

base, salida = Path(sys.argv[1]), Path(sys.argv[2])
pedidas = {n.lower() for n in sys.argv[3:]}

todas = sorted((base / "images").iterdir())
if pedidas:
    elegidas = [r for r in todas if r.stem.lower() in pedidas]
else:
    random.seed(11)
    elegidas = random.sample(todas, min(12, len(todas)))

celdas = []
for ruta in elegidas:
    with Image.open(ruta) as img:
        img = img.convert("RGB")
        dibujo = ImageDraw.Draw(img)
        ancho, alto = img.size
        txt = base / "labels" / f"{ruta.stem}.txt"
        for linea in txt.read_text(encoding="utf-8").splitlines():
            p = linea.split()
            if len(p) < 5:
                continue
            cx, cy, w, h = (float(v) for v in p[1:5])
            x1, y1 = (cx - w / 2) * ancho, (cy - h / 2) * alto
            x2, y2 = (cx + w / 2) * ancho, (cy + h / 2) * alto
            dibujo.rectangle(
                [x1, y1, x2, y2], outline="red", width=max(4, ancho // 150)
            )
            dibujo.text((x1 + 6, y1 + 6), p[0], fill="yellow")
        img.thumbnail((520, 520))
        celdas.append(img.copy())

print(f"Imagenes en la hoja: {len(celdas)}")
cols = 4
filas = (len(celdas) + cols - 1) // cols
lienzo = Image.new("RGB", (cols * 520, filas * 520), "white")
for i, c in enumerate(celdas):
    lienzo.paste(c, ((i % cols) * 520, (i // cols) * 520))
lienzo.save(salida, quality=88)