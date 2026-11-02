import csv
import hashlib
import json
import math
import shutil
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from PIL import Image

DATOS = Path(r"C:\Users\Julia\inventario-vision-datos")
BASE = DATOS / "dataset_base_v3"
CSV_ESCENAS = DATOS / "revision_escenas" / "escenas-actualizado-1.csv"
SALIDA = DATOS / "dataset_entrenamiento" / "v3"
ZIP = SALIDA.parent / "inventario_vision_v3_para_colab.zip"

CLASES = [
    "coca_cola_1_5l", "doritos", "chocoramo", "aceite_ideal",
    "leche_alqueria", "detergente_fab", "harina_pan",
    "cafe_sello_rojo", "colgate_triple_accion", "dogchow_cachorro",
]
SPLITS = ("train", "val", "test")
PROPORCIONES = (0.70, 0.15, 0.15)
MIN_FOTOS_EVAL = 2
MIN_CAJAS_EVAL = 4
EXTENSIONES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def detener(mensaje):
    raise SystemExit(f"\nERROR: {mensaje}")


def escribir_csv(ruta, filas, campos):
    with ruta.open("w", newline="", encoding="utf-8-sig") as archivo:
        escritor = csv.DictWriter(
            archivo, fieldnames=campos, delimiter=";"
        )
        escritor.writeheader()
        escritor.writerows(filas)


if not BASE.is_dir() or not CSV_ESCENAS.is_file():
    detener("No se encuentra dataset_base_v3 o el CSV de escenas.")

if SALIDA.exists() or ZIP.exists():
    detener(
        "La salida v3 o su ZIP ya existen. No se sobrescribira nada. "
        "Revisa una ejecucion anterior antes de continuar."
    )

with CSV_ESCENAS.open(encoding="utf-8-sig", newline="") as archivo:
    lector = csv.DictReader(archivo, delimiter=";")
    if lector.fieldnames != ["imagen", "clase_principal", "escena"]:
        detener("La cabecera del CSV no coincide.")
    filas_csv = list(lector)

if len(filas_csv) != 309:
    detener(f"Se esperaban 309 filas y hay {len(filas_csv)}.")

imagenes = [
    p for p in (BASE / "images").iterdir()
    if p.is_file() and p.suffix.lower() in EXTENSIONES
]
por_nombre = {}
stems = set()

for ruta in imagenes:
    clave = ruta.name.casefold()
    if clave in por_nombre or ruta.stem.casefold() in stems:
        detener(f"Nombre de imagen ambiguo: {ruta.name}")
    por_nombre[clave] = ruta
    stems.add(ruta.stem.casefold())

nombres_csv = [fila["imagen"].casefold() for fila in filas_csv]
if len(set(nombres_csv)) != len(nombres_csv):
    detener("Hay nombres de imagen duplicados en el CSV.")

if set(nombres_csv) != set(por_nombre):
    faltan = set(nombres_csv) - set(por_nombre)
    extras = set(por_nombre) - set(nombres_csv)
    detener(f"CSV e imagenes no coinciden. Faltan: {faltan}. Extras: {extras}")

registros = []
clases_escena = defaultdict(set)

for fila in filas_csv:
    escena = fila["escena"]
    if not escena.strip() or escena != escena.strip():
        detener(f"Escena vacia o con espacios exteriores: {fila['imagen']}")

    if fila["clase_principal"] not in CLASES:
        detener(f"Clase principal desconocida: {fila}")

    ruta = por_nombre[fila["imagen"].casefold()]
    txt = BASE / "labels" / f"{ruta.stem}.txt"
    if not txt.is_file():
        detener(f"Falta la etiqueta: {txt.name}")

    conteo = Counter()
    for numero, linea in enumerate(
        txt.read_text(encoding="utf-8-sig").splitlines(), start=1
    ):
        if not linea.strip():
            continue
        partes = linea.split()
        if len(partes) != 5:
            detener(f"{txt.name}, linea {numero}: formato incorrecto.")
        try:
            clase = int(partes[0])
            cx, cy, w, h = map(float, partes[1:])
        except ValueError:
            detener(f"{txt.name}, linea {numero}: valores invalidos.")

        valores = (cx, cy, w, h)
        if clase not in range(10) or not all(map(math.isfinite, valores)):
            detener(f"{txt.name}, linea {numero}: clase o valores invalidos.")

        if (
            w <= 0 or h <= 0
            or cx - w / 2 < -0.00001
            or cy - h / 2 < -0.00001
            or cx + w / 2 > 1.00001
            or cy + h / 2 > 1.00001
        ):
            detener(f"{txt.name}, linea {numero}: caja invalida.")

        conteo[clase] += 1

    principal = CLASES.index(fila["clase_principal"])
    if not conteo or principal not in conteo:
        detener(f"La clase principal no aparece en {txt.name}.")

    with Image.open(ruta) as imagen:
        rgb = imagen.convert("RGB")
        digest = hashlib.sha256()
        digest.update(str(rgb.size).encode())
        digest.update(rgb.tobytes())
        hash_pixeles = digest.hexdigest()

    registros.append({
        "ruta": ruta,
        "txt": txt,
        "escena": escena,
        "principal": principal,
        "conteo": conteo,
        "hash": hash_pixeles,
    })
    clases_escena[escena].add(principal)

if any(len(clases) != 1 for clases in clases_escena.values()):
    detener(
        "Hay escenas compartidas por distintas clases principales. "
        "Este reparto por clase requiere revisar ese caso."
    )

padre = {escena: escena for escena in clases_escena}


def raiz(escena):
    while padre[escena] != escena:
        padre[escena] = padre[padre[escena]]
        escena = padre[escena]
    return escena


def unir(a, b):
    ra, rb = raiz(a), raiz(b)
    if ra != rb:
        padre[max(ra, rb)] = min(ra, rb)


por_hash = defaultdict(list)
for registro in registros:
    por_hash[registro["hash"]].append(registro)

duplicados = []
for hash_imagen, grupo in por_hash.items():
    if len(grupo) < 2:
        continue
    if len({r["principal"] for r in grupo}) != 1:
        detener("Imagenes identicas tienen clases principales diferentes.")
    for registro in grupo[1:]:
        unir(grupo[0]["escena"], registro["escena"])
    duplicados.append({
        "hash_pixeles": hash_imagen,
        "imagenes": [r["ruta"].name for r in grupo],
    })

grupos = defaultdict(list)
for registro in registros:
    grupos[raiz(registro["escena"])].append(registro)

# ---------------------------------------------------------------
# Reparto por busqueda exhaustiva de escenas
# ---------------------------------------------------------------
def enumerar_mitad(escenas):
    k = len(escenas)
    total = 3 ** k
    resto = np.arange(total)
    digitos = np.zeros((total, k), dtype=np.int8)
    for j in range(k):
        digitos[:, j] = resto % 3
        resto //= 3
    fotos = np.array([e[0] for e in escenas], dtype=float)
    cajas_e = np.array([e[1] for e in escenas], dtype=float)
    sumas = np.zeros((total, 6))
    for s in range(3):
        mascara = digitos == s
        sumas[:, s] = mascara @ fotos
        sumas[:, 3 + s] = mascara @ cajas_e
    return sumas, digitos


objetivo = np.array(PROPORCIONES)
asignacion = {}

for clase in range(10):
    ids = sorted(
        gid for gid, grupo in grupos.items()
        if grupo[0]["principal"] == clase
    )
    if len(ids) < 3:
        detener(
            f"{CLASES[clase]} tiene menos de tres grupos independientes "
            "despues de unir duplicados."
        )

    escenas = [
        (
            len(grupos[gid]),
            sum(r["conteo"][clase] for r in grupos[gid]),
        )
        for gid in ids
    ]
    total_fotos = sum(e[0] for e in escenas)
    total_cajas = sum(e[1] for e in escenas)

    if total_fotos == 0 or total_cajas == 0:
        detener(f"{CLASES[clase]} no tiene datos suficientes para repartir.")

    mitad = len(escenas) // 2
    sumas_a, dig_a = enumerar_mitad(escenas[:mitad])
    sumas_b, dig_b = enumerar_mitad(escenas[mitad:])

    mejor_puntaje = float("inf")
    mejor_combinacion = None

    for inicio in range(0, len(sumas_a), 200):
        total = sumas_a[inicio:inicio + 200, None, :] + sumas_b[None, :, :]
        prop_fotos = total[:, :, 0:3] / total_fotos
        prop_cajas = total[:, :, 3:6] / total_cajas
        error = (
            0.5 * ((prop_fotos - objetivo) ** 2).sum(axis=2)
            + 0.5 * ((prop_cajas - objetivo) ** 2).sum(axis=2)
        )
        invalido = (
            (total[:, :, 0] < 1)
            | (total[:, :, 1] < MIN_FOTOS_EVAL)
            | (total[:, :, 2] < MIN_FOTOS_EVAL)
            | (total[:, :, 4] < MIN_CAJAS_EVAL)
            | (total[:, :, 5] < MIN_CAJAS_EVAL)
        )
        error = np.where(invalido, np.inf, error)
        pos = np.unravel_index(np.argmin(error), error.shape)
        if error[pos] < mejor_puntaje:
            mejor_puntaje = error[pos]
            mejor_combinacion = np.concatenate(
                [dig_a[inicio + pos[0]], dig_b[pos[1]]]
            )

    if mejor_combinacion is None:
        detener(f"No hay reparto valido para {CLASES[clase]}.")

    for gid, indice in zip(ids, mejor_combinacion):
        asignacion[gid] = SPLITS[int(indice)]

# ---------------------------------------------------------------
cajas = {split: Counter() for split in SPLITS}
manifest = []
for registro in registros:
    grupo = raiz(registro["escena"])
    split = asignacion[grupo]
    cajas[split].update(registro["conteo"])
    manifest.append({
        "imagen": registro["ruta"].name,
        "clase_principal": CLASES[registro["principal"]],
        "escena": registro["escena"],
        "grupo_reparto": grupo,
        "split": split,
        "cajas": sum(registro["conteo"].values()),
        "hash_pixeles": registro["hash"],
    })

for clase in range(10):
    for split in SPLITS:
        if cajas[split][clase] == 0:
            detener(f"{CLASES[clase]} no tiene cajas en {split}.")

for split in SPLITS:
    (SALIDA / "images" / split).mkdir(parents=True)
    (SALIDA / "labels" / split).mkdir(parents=True)

for registro, fila in zip(registros, manifest):
    split = fila["split"]
    shutil.copy2(
        registro["ruta"],
        SALIDA / "images" / split / registro["ruta"].name,
    )
    shutil.copy2(
        registro["txt"],
        SALIDA / "labels" / split / registro["txt"].name,
    )

escribir_csv(SALIDA / "manifest.csv", manifest, list(manifest[0]))

resumen = []
for clase, nombre in enumerate(CLASES):
    fila = {"clase": clase, "nombre": nombre}
    for split in SPLITS:
        fila[f"imagenes_{split}"] = sum(
            1 for r, m in zip(registros, manifest)
            if m["split"] == split and r["conteo"][clase] > 0
        )
        fila[f"cajas_{split}"] = cajas[split][clase]
    resumen.append(fila)

escribir_csv(
    SALIDA / "resumen_por_clase.csv",
    resumen,
    list(resumen[0]),
)

configuracion = [
    "path: /content/dataset",
    "train: images/train",
    "val: images/val",
    "test: images/test",
    "names:",
] + [f"  {i}: {nombre}" for i, nombre in enumerate(CLASES)]

(SALIDA / "data.yaml").write_text(
    "\n".join(configuracion) + "\n", encoding="utf-8"
)

informe = {
    "metodo": (
        "busqueda exhaustiva de asignaciones de escenas por clase; "
        "error = 50% proporcion de imagenes + 50% proporcion de cajas"
    ),
    "proporciones_objetivo": dict(zip(SPLITS, PROPORCIONES)),
    "minimos_evaluacion": {
        "fotos_por_clase": MIN_FOTOS_EVAL,
        "cajas_por_clase": MIN_CAJAS_EVAL,
    },
    "imagenes": len(registros),
    "escenas_originales": len(clases_escena),
    "grupos_reparto": len(grupos),
    "imagenes_por_split": dict(Counter(m["split"] for m in manifest)),
    "duplicados_pixeles": duplicados,
    "nota": (
        "Las imagenes duplicadas se conservaron pero sus escenas "
        "se unieron para impedir que crucen conjuntos. "
        "La similitud visual no exacta depende del CSV revisado."
    ),
}
(SALIDA / "informe_division.json").write_text(
    json.dumps(informe, ensure_ascii=False, indent=2),
    encoding="utf-8",
)

shutil.make_archive(str(ZIP.with_suffix("")), "zip", root_dir=SALIDA)

print("\n=== IMAGENES POR CONJUNTO ===")
for split in SPLITS:
    cantidad = sum(m["split"] == split for m in manifest)
    print(f"{split}: {cantidad} ({cantidad / len(manifest):.1%})")

print("\n=== CAJAS POR CLASE ===")
print(f"{'Clase':24} {'train':>7} {'val':>7} {'test':>7}")
for i, nombre in enumerate(CLASES):
    print(
        f"{nombre:24} {cajas['train'][i]:7} "
        f"{cajas['val'][i]:7} {cajas['test'][i]:7}"
    )

print(f"\nEscenas originales: {len(clases_escena)}")
print(f"Grupos de reparto: {len(grupos)}")
print(f"Grupos con imagenes identicas: {len(duplicados)}")
print("Clases presentes en los tres conjuntos: SI")
print("Escenas compartidas entre conjuntos: 0")
print(f"Dataset: {SALIDA}")
print(f"ZIP: {ZIP}")
print(f"Tamano ZIP: {ZIP.stat().st_size / (1024 ** 2):.1f} MB")