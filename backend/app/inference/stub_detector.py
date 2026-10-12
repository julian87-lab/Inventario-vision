from .base import ResultadoDetector


class StubDetector:
    version = "stub-v1"

    def detectar(self, image_path: str) -> list[ResultadoDetector]:
        # Resultado fijo y predecible solo para probar el flujo.
        return [
            ResultadoDetector(
                clase_yolo=0,
                confianza=0.95,
                x1=0.10,
                y1=0.10,
                x2=0.30,
                y2=0.40,
            ),
            ResultadoDetector(
                clase_yolo=0,
                confianza=0.90,
                x1=0.35,
                y1=0.12,
                x2=0.55,
                y2=0.42,
            ),
            ResultadoDetector(
                clase_yolo=1,
                confianza=0.88,
                x1=0.60,
                y1=0.15,
                x2=0.85,
                y2=0.50,
            ),
        ]