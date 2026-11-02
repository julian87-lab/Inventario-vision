from pathlib import Path
from threading import Lock

from ultralytics import YOLO

from .base import ResultadoDetector


CLASES_ESPERADAS = (
    "coca_cola_1_5l",
    "doritos",
    "chocoramo",
    "aceite_ideal",
    "leche_alqueria",
    "detergente_fab",
    "harina_pan",
    "cafe_sello_rojo",
    "colgate_triple_accion",
    "dogchow_cachorro",
)


class YoloDetector:
    def __init__(
        self,
        model_path: str,
        confianza: float = 0.50,
        version: str = "yolo11n-v3",
    ) -> None:
        ruta = Path(model_path)
        if not ruta.is_file():
            raise FileNotFoundError(
                f"No se encontró el modelo YOLO en: {ruta.resolve()}"
            )

        self._model = YOLO(str(ruta))

        nombres = tuple(
            self._model.names[i] for i in range(len(self._model.names))
        )
        if nombres != CLASES_ESPERADAS:
            raise ValueError(
                "Las clases del modelo no coinciden con las esperadas. "
                f"Modelo: {nombres}"
            )

        self._confianza = confianza
        self._lock = Lock()
        self.version = version

    def detectar(self, image_path: str) -> list[ResultadoDetector]:
        # Una sola predicción a la vez sobre el mismo modelo.
        with self._lock:
            resultados = self._model.predict(
                source=image_path,
                conf=self._confianza,
                device="cpu",
                verbose=False,
            )

        cajas = resultados[0].boxes
        return [
            ResultadoDetector(
                clase_yolo=int(clase),
                confianza=float(confianza),
                x1=float(x1),
                y1=float(y1),
                x2=float(x2),
                y2=float(y2),
            )
            for clase, confianza, (x1, y1, x2, y2) in zip(
                cajas.cls.tolist(),
                cajas.conf.tolist(),
                cajas.xyxyn.tolist(),
            )
        ]

    